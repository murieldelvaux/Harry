import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, RecordScope } from '../../../../packages/shared/src';

@Injectable()
export class TaskReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskReminderService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando serviço de lembretes proativos (Tarefas e Eventos da Agenda)...');
    this.timer = setInterval(() => this.checkPendingReminders(), 30000);
    setTimeout(() => this.checkPendingReminders(), 5000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async checkPendingReminders() {
    try {
      const now = new Date();
      await this.checkTaskReminders(now);
      await this.checkCalendarEventReminders(now);
    } catch (error: any) {
      if (!error?.message?.includes("Can't reach database server")) {
        this.logger.error('Erro ao verificar lembretes pendentes', error);
      }
    }
  }

  private async checkTaskReminders(now: Date) {
    const tasks = await this.prisma.task.findMany({
      where: {
        isCompleted: false,
        reminderSent: false,
        dueDate: { not: null },
      },
      include: {
        user: true,
      },
    });

    for (const task of tasks) {
      if (!task.dueDate) continue;
      const due = new Date(task.dueDate);
      const diffMs = due.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      let shouldRemind = false;
      let detailTime = '';

      if (task.hasSpecificTime) {
        const totalWindowMinutes = (due.getTime() - task.createdAt.getTime()) / (1000 * 60);

        if (totalWindowMinutes <= 75) {
          if (diffMinutes <= 2 && diffMinutes >= -15) {
            shouldRemind = true;
            detailTime = '⏳ O horário limite está chegando ou é agora!';
          }
        } else {
          if (diffMinutes <= 60 && diffMinutes >= -15) {
            shouldRemind = true;
            detailTime = `⏰ Falta cerca de ${Math.max(1, Math.round(diffMinutes))} minuto(s) para o horário marcado!`;
          }
        }
      } else {
        const dueDayStr = due.toISOString().slice(0, 10);
        const nowDayStr = now.toISOString().slice(0, 10);
        const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;

        if (nowDayStr >= dueDayStr && brasiliaHour >= 8) {
          shouldRemind = true;
          detailTime = '📅 Hoje é o dia deste compromisso!';
        }
      }

      if (shouldRemind) {
        this.logger.log(`Disparando lembrete multi-canal para tarefa "${task.title}" (ID: ${task.id})`);

        const recipients = await this.resolveTaskOrEventRecipients(
          task.userId,
          task.householdId,
          task.scope as RecordScope,
        );

        for (const recipient of recipients) {
          const firstName = recipient.name ? recipient.name.split(' ')[0] : 'aí';
          const isShared = task.scope === 'SHARED';
          const scopeTag = isShared ? '🏠 Lembrete Compartilhado' : '🔒 Lembrete Pessoal';

          const waMessage = `🔔 *Lembrete Harry!*\n\nOlá, ${firstName}! Vim te lembrar do compromisso:\n👉 *${task.title}*\n${scopeTag}\n\n${detailTime}\n\n✅ Não se esqueça! Você pode visualizá-lo e marcar como concluído pelo app Harry.`;

          await this.notificationsService.dispatchNotification({
            recipientId: recipient.id,
            actorId: task.userId,
            householdId: task.householdId,
            type: NotificationType.TASK_REMINDER,
            title: `⏰ Lembrete: ${task.title}`,
            body: `${detailTime} (${isShared ? 'Compartilhado com o casal' : 'Pessoal'})`,
            deepLink: '/(tabs)/tasks',
            metadata: { taskId: task.id },
            whatsappMessage: waMessage,
          });
        }

        await this.prisma.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        });
      }
    }
  }

  private async checkCalendarEventReminders(now: Date) {
    const windowEnd = new Date(now.getTime() + 45 * 60 * 1000);
    const windowStart = new Date(now.getTime() - 10 * 60 * 1000);

    const upcomingEvents = await this.prisma.calendarEvent.findMany({
      where: {
        reminderSent: false,
        startDate: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    });

    for (const ev of upcomingEvents) {
      const diffMinutes = Math.max(0, Math.round((ev.startDate.getTime() - now.getTime()) / 60000));
      const recipients = await this.resolveTaskOrEventRecipients(
        ev.userId,
        ev.householdId,
        ev.scope as RecordScope,
      );

      for (const recipient of recipients) {
        await this.notificationsService.dispatchNotification({
          recipientId: recipient.id,
          actorId: ev.userId,
          householdId: ev.householdId,
          type: NotificationType.EVENT_REMINDER,
          title: `📅 Compromisso em breve: ${ev.title}`,
          body:
            diffMinutes <= 2
              ? `Começa agora! ${ev.location ? `Local: ${ev.location}` : ''}`
              : `Começa em aproximadamente ${diffMinutes} min.${ev.location ? ` Local: ${ev.location}` : ''}`,
          deepLink: '/(tabs)/calendar',
          metadata: { eventId: ev.id },
        });
      }

      await this.prisma.calendarEvent.update({
        where: { id: ev.id },
        data: { reminderSent: true },
      });
    }
  }

  private async resolveTaskOrEventRecipients(
    ownerId: string,
    householdId: string | null,
    scope: RecordScope,
  ) {
    if (scope === RecordScope.SHARED && householdId) {
      return this.prisma.user.findMany({
        where: { householdId },
        select: { id: true, name: true, phoneNumber: true },
      });
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, phoneNumber: true },
    });
    return owner ? [owner] : [];
  }
}
