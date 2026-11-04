import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import {
  NotificationType,
  NotificationCategory,
  NotificationDto,
  NotificationPreferenceDto,
  UpdateNotificationPreferencesDto,
} from '../../../../packages/shared/src';

const DEFAULT_CATEGORIES = [
  NotificationCategory.FINANCES,
  NotificationCategory.CALENDAR,
  NotificationCategory.SHOPPING,
  NotificationCategory.WORKOUTS,
];

function mapTypeToCategory(type: NotificationType): NotificationCategory {
  switch (type) {
    case NotificationType.SHARED_EXPENSE_CREATED:
    case NotificationType.ACCOUNT_CLOSING_CREATED:
    case NotificationType.ACCOUNT_CLOSING_SETTLED:
      return NotificationCategory.FINANCES;
    case NotificationType.SHARED_EVENT_CREATED:
    case NotificationType.SHARED_TASK_CREATED:
    case NotificationType.EVENT_REMINDER:
    case NotificationType.TASK_REMINDER:
      return NotificationCategory.CALENDAR;
    case NotificationType.WORKOUT_LOGGED:
    case NotificationType.WORKOUT_CHEER:
      return NotificationCategory.WORKOUTS;
    default:
      return NotificationCategory.CALENDAR;
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private realtimeService: RealtimeService,
    private whatsappService: WhatsappService,
  ) {}

  async listForUser(userId: string): Promise<{
    unreadCount: number;
    items: NotificationDto[];
  }> {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        include: {
          actor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return {
      unreadCount,
      items: notifications.map((n) => this.mapNotification(n)),
    };
  }

  async markAsRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async registerPushToken(userId: string, expoPushToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken },
    });
    return { success: true, expoPushToken };
  }

  async getPreferences(userId: string): Promise<NotificationPreferenceDto[]> {
    const saved = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const map = new Map(saved.map((p) => [p.category, p]));

    return DEFAULT_CATEGORIES.map((cat) => {
      const existing = map.get(cat);
      return {
        id: existing?.id,
        category: cat,
        enableInApp: existing ? existing.enableInApp : true,
        enablePush: existing ? existing.enablePush : true,
        enableWhatsapp: existing ? existing.enableWhatsapp : true,
      };
    });
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceDto[]> {
    for (const pref of dto.preferences || []) {
      await this.prisma.notificationPreference.upsert({
        where: {
          userId_category: {
            userId,
            category: pref.category,
          },
        },
        update: {
          enableInApp: pref.enableInApp,
          enablePush: pref.enablePush,
          enableWhatsapp: pref.enableWhatsapp,
        },
        create: {
          userId,
          category: pref.category,
          enableInApp: pref.enableInApp,
          enablePush: pref.enablePush,
          enableWhatsapp: pref.enableWhatsapp,
        },
      });
    }
    return this.getPreferences(userId);
  }

  /**
   * Despacha notificação multi-canal (In-App + Push + WhatsApp) respeitando as preferências do destinatário
   */
  async dispatchNotification(params: {
    recipientId: string;
    actorId?: string | null;
    householdId?: string | null;
    type: NotificationType;
    title: string;
    body: string;
    deepLink?: string;
    metadata?: Record<string, any>;
    whatsappMessage?: string;
  }) {
    try {
      const recipient = await this.prisma.user.findUnique({
        where: { id: params.recipientId },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          expoPushToken: true,
          householdId: true,
        },
      });

      if (!recipient) return null;

      const category = mapTypeToCategory(params.type);
      const pref = await this.prisma.notificationPreference.findUnique({
        where: {
          userId_category: {
            userId: recipient.id,
            category,
          },
        },
      });

      const enableInApp = pref ? pref.enableInApp : true;
      const enablePush = pref ? pref.enablePush : true;
      const enableWhatsapp = pref ? pref.enableWhatsapp : true;

      const channelsSent: string[] = [];
      if (enableInApp) channelsSent.push('IN_APP');
      if (enablePush && recipient.expoPushToken) channelsSent.push('PUSH');
      if (enableWhatsapp && recipient.phoneNumber) channelsSent.push('WHATSAPP');

      let created: any = null;
      if (enableInApp) {
        created = await this.prisma.notification.create({
          data: {
            userId: recipient.id,
            actorId: params.actorId || null,
            householdId: params.householdId || recipient.householdId || null,
            type: params.type as any,
            title: params.title,
            body: params.body,
            deepLink: params.deepLink || null,
            metadata: params.metadata || undefined,
            channels: channelsSent,
          },
          include: {
            actor: { select: { id: true, name: true } },
          },
        });

        this.realtimeService.emit({
          type: 'NOTIFICATION_CREATED',
          userId: recipient.id,
          householdId: params.householdId || recipient.householdId,
          data: this.mapNotification(created),
        });
      }

      // Push via Expo Push API
      if (enablePush && recipient.expoPushToken && recipient.expoPushToken.startsWith('ExponentPushToken')) {
        axios
          .post(
            'https://exp.host/--/api/v2/push/send',
            {
              to: recipient.expoPushToken,
              sound: 'default',
              title: params.title,
              body: params.body,
              data: {
                url: params.deepLink || '/(tabs)',
                type: params.type,
                ...(params.metadata || {}),
              },
            },
            {
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
            },
          )
          .catch((err) => {
            this.logger.warn(`Expo Push error for user ${recipient.id}: ${err?.message}`);
          });
      }

      // WhatsApp proativo
      if (enableWhatsapp && recipient.phoneNumber) {
        const waText = params.whatsappMessage || `🔔 *${params.title}*\n\n${params.body}`;
        this.whatsappService
          .sendWhatsAppMessage(recipient.phoneNumber, waText)
          .catch((err) => {
            this.logger.warn(`WhatsApp notification error for user ${recipient.id}: ${err?.message}`);
          });
      }

      return created ? this.mapNotification(created) : null;
    } catch (err: any) {
      this.logger.error(`Erro ao despachar notificação: ${err?.message}`);
      return null;
    }
  }

  /**
   * Notifica todos os parceiros do casal (exceto quem realizou a ação)
   */
  async notifyHouseholdPartners(params: {
    actorUserId: string;
    householdId?: string | null;
    type: NotificationType;
    title: string;
    body: string;
    deepLink?: string;
    metadata?: Record<string, any>;
    whatsappMessage?: string;
  }) {
    if (!params.householdId) return [];

    const partners = await this.prisma.user.findMany({
      where: {
        householdId: params.householdId,
        id: { not: params.actorUserId },
      },
      select: { id: true },
    });

    const results = [];
    for (const partner of partners) {
      const res = await this.dispatchNotification({
        recipientId: partner.id,
        actorId: params.actorUserId,
        householdId: params.householdId,
        type: params.type,
        title: params.title,
        body: params.body,
        deepLink: params.deepLink,
        metadata: params.metadata,
        whatsappMessage: params.whatsappMessage,
      });
      if (res) results.push(res);
    }

    return results;
  }

  private mapNotification(n: any): NotificationDto {
    return {
      id: n.id,
      userId: n.userId,
      actorId: n.actorId,
      actorName: n.actor?.name || null,
      householdId: n.householdId,
      type: n.type,
      title: n.title,
      body: n.body,
      deepLink: n.deepLink,
      metadata: (n.metadata as Record<string, any>) || null,
      channels: n.channels || ['IN_APP'],
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}

