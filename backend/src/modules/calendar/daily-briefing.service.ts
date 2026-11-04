import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecordScope, NotificationType } from '../../../../packages/shared/src';

@Injectable()
export class DailyBriefingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyBriefingService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando serviço de resumos diários e periódicos com controle de timezone e horário exato...');
    // Roda a cada 45 segundos
    this.timer = setInterval(() => this.checkDailyBriefings(), 45000);
    setTimeout(() => this.checkDailyBriefings(), 7000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private getLocalDateParts(now: Date, timeZone: string = 'America/Sao_Paulo') {
    try {
      const dateStr = now.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
      const timeStr = now.toLocaleTimeString('pt-BR', {
        timeZone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
      const [hStr, mStr] = timeStr.split(':');
      const hour = parseInt(hStr || '0', 10);
      const minute = parseInt(mStr || '0', 10);

      // Obter dia da semana no timezone do usuário (0 = Dom ... 6 = Sáb)
      const [y, mo, d] = dateStr.split('-').map((n) => parseInt(n, 10));
      const dayOfWeek = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();

      return { dateStr, hour, minute, dayOfWeek };
    } catch {
      const brasiliaDate = new Date(now.getTime() - 3 * 3600 * 1000);
      return {
        dateStr: brasiliaDate.toISOString().slice(0, 10),
        hour: brasiliaDate.getUTCHours(),
        minute: brasiliaDate.getUTCMinutes(),
        dayOfWeek: brasiliaDate.getUTCDay(),
      };
    }
  }

  async checkDailyBriefings() {
    try {
      const now = new Date();

      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { phoneNumber: { not: null } },
            { enableDailySummary: true },
          ],
        },
      });

      for (const user of users) {
        const tz = user.timezone || 'America/Sao_Paulo';
        const { dateStr: todayStr, hour: currHour, minute: currMin, dayOfWeek: currDayOfWeek } =
          this.getLocalDateParts(now, tz);

        // 1. Resumo Diário no Horário Exato configurado (ex.: "07:30")
        if (user.enableDailySummary !== false) {
          const targetTime = user.dailySummaryTime || '06:00';
          const [targetHourStr, targetMinStr] = targetTime.split(':');
          const targetHour = parseInt(targetHourStr || '6', 10);
          const targetMin = parseInt(targetMinStr || '0', 10);

          const isTimeForDaily =
            currHour > targetHour || (currHour === targetHour && currMin >= targetMin);

          const alreadySentDailyToday =
            user.lastDailySummaryDate === todayStr ||
            (user.lastDailySentAt &&
              this.getLocalDateParts(new Date(user.lastDailySentAt), tz).dateStr === todayStr);

          if (isTimeForDaily && !alreadySentDailyToday) {
            try {
              await this.sendDailyBriefing(user, todayStr);
              await this.prisma.user.update({
                where: { id: user.id },
                data: {
                  lastDailySummaryDate: todayStr,
                  lastDailySentAt: now,
                },
              });
            } catch (err: any) {
              this.logger.error(`Falha ao disparar resumo diário para usuário ${user.id} (${user.name}): ${err.message}`);
            }
          }
        }

        // 2. Resumo Estendido (Semanal ou Quinzenal) no Dia da Semana e Horário Exato configurado
        const rawSummaryType = (user.periodicSummaryType || 'none').toLowerCase();
        const isWeekly = rawSummaryType === 'weekly';
        const isBiweekly = rawSummaryType === 'biweekly';

        if (isWeekly || isBiweekly) {
          const summaryDay = user.periodicSummaryDay ?? 1; // 0 = Domingo, 1 = Segunda...
          const periodicTime = user.periodicSummaryTime || '08:00';
          const [pHourStr, pMinStr] = periodicTime.split(':');
          const pTargetHour = parseInt(pHourStr || '8', 10);
          const pTargetMin = parseInt(pMinStr || '0', 10);

          const isTimeForPeriodic =
            currDayOfWeek === summaryDay &&
            (currHour > pTargetHour || (currHour === pTargetHour && currMin >= pTargetMin));

          if (isTimeForPeriodic) {
            const alreadySentPeriodicToday =
              user.lastPeriodicDate === todayStr ||
              (user.lastDigestSentAt &&
                this.getLocalDateParts(new Date(user.lastDigestSentAt), tz).dateStr === todayStr);

            let canSendPeriodic = !alreadySentPeriodicToday;

            if (canSendPeriodic && isBiweekly) {
              const refDate = user.lastDigestSentAt
                ? new Date(user.lastDigestSentAt)
                : user.lastPeriodicDate
                  ? new Date(user.lastPeriodicDate)
                  : null;
              if (refDate) {
                const diffDays = (now.getTime() - refDate.getTime()) / (1000 * 3600 * 24);
                if (diffDays < 12) {
                  canSendPeriodic = false;
                }
              }
            }

            if (canSendPeriodic) {
              try {
                await this.sendPeriodicBriefing(user, isBiweekly ? 'biweekly' : 'weekly');
                await this.prisma.user.update({
                  where: { id: user.id },
                  data: {
                    lastPeriodicDate: todayStr,
                    lastDigestSentAt: now,
                  },
                });
              } catch (err: any) {
                this.logger.error(`Falha ao disparar resumo periódico para usuário ${user.id}: ${err.message}`);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (!error?.message?.includes("Can't reach database server")) {
        this.logger.error('Erro ao processar resumos diários/periódicos:', error);
      }
    }
  }

  public async triggerUserDailyBriefing(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const now = new Date();
    const { dateStr: todayStr } = this.getLocalDateParts(now, user.timezone || 'America/Sao_Paulo');

    const { message, eventsCount, tasksCount, shoppingCount } = await this.buildDailyBriefing(user, todayStr);

    let whatsappSent = false;
    let whatsappStatus = 'Sem telefone cadastrado';

    if (user.phoneNumber) {
      try {
        await this.whatsappService.sendWhatsAppMessage(user.phoneNumber, message);
        whatsappSent = true;
        whatsappStatus = 'Mensagem enviada com sucesso para o WhatsApp!';
      } catch (err: any) {
        whatsappStatus = `Tentativa de envio ao WhatsApp falhou: ${err.message}`;
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailySummaryDate: todayStr,
        lastDailySentAt: now,
      },
    });

    return {
      success: true,
      message: 'Resumo diário processado com sucesso!',
      summary: message,
      whatsappSent,
      whatsappStatus,
      phoneNumber: user.phoneNumber,
      stats: {
        eventsCount,
        tasksCount,
        shoppingCount,
      },
    };
  }

  private async buildDailyBriefing(user: any, todayStr: string) {
    const startOfDay = new Date(`${todayStr}T00:00:00-03:00`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999-03:00`);

    // 1. Buscar Eventos de hoje
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        OR: [
          { userId: user.id },
          ...(user.householdId
            ? [{ householdId: user.householdId, scope: RecordScope.SHARED }]
            : []),
        ],
        AND: [
          { startDate: { lte: endOfDay } },
          {
            OR: [
              { endDate: { gte: startOfDay } },
              { endDate: null, startDate: { gte: startOfDay } },
            ],
          },
        ],
      },
      orderBy: { startDate: 'asc' },
    });

    // 2. Buscar Tarefas e Lembretes de hoje (ou pendentes atrasadas)
    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [
          { userId: user.id },
          ...(user.householdId
            ? [{ householdId: user.householdId, scope: RecordScope.SHARED }]
            : []),
        ],
        isCompleted: false,
        dueDate: { lte: endOfDay },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 3. Buscar Itens pendentes da lista de compras
    const shoppingItems = await this.prisma.shoppingItem.findMany({
      where: {
        OR: [
          { userId: user.id },
          ...(user.householdId
            ? [{ householdId: user.householdId, scope: RecordScope.SHARED }]
            : []),
        ],
        isCompleted: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const totalShoppingCount = await this.prisma.shoppingItem.count({
      where: {
        OR: [
          { userId: user.id },
          ...(user.householdId
            ? [{ householdId: user.householdId, scope: RecordScope.SHARED }]
            : []),
        ],
        isCompleted: false,
      },
    });

    const firstName = user.name ? user.name.split(' ')[0] : 'aí';

    let eventsBlock = '• _Nenhum compromisso agendado para hoje. Aproveite o dia livre!_';
    if (events.length > 0) {
      eventsBlock = events
        .map((ev: any) => {
          const time = ev.isAllDay
            ? 'Dia inteiro'
            : ev.startDate.toLocaleTimeString('pt-BR', {
                timeZone: user.timezone || 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
              });
          const loc = ev.location ? ` (${ev.location})` : '';
          const scope = ev.scope === RecordScope.SHARED ? ' 🏠' : '';
          return `• *${time}* - ${ev.title}${loc}${scope}`;
        })
        .join('\n');
    }

    let tasksBlock = '• _Nenhuma tarefa ou lembrete pendente para hoje!_';
    if (tasks.length > 0) {
      tasksBlock = tasks
        .map((tk: any) => {
          const dueTime = tk.hasSpecificTime && tk.dueDate
            ? ` [às ${tk.dueDate.toLocaleTimeString('pt-BR', { timeZone: user.timezone || 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}]`
            : '';
          const scope = tk.scope === RecordScope.SHARED ? ' 🏠' : '';
          return `• ${tk.title}${dueTime}${scope}`;
        })
        .join('\n');
    }

    let shoppingBlock = '• _Nenhum item pendente na lista de compras._';
    if (shoppingItems.length > 0) {
      shoppingBlock = shoppingItems
        .map((item: any) => {
          const qty = item.quantity && item.quantity !== '1' ? ` (${item.quantity})` : '';
          const scope = item.scope === RecordScope.SHARED ? ' 🏠' : '';
          return `• ${item.name}${qty}${scope}`;
        })
        .join('\n');
      if (totalShoppingCount > shoppingItems.length) {
        shoppingBlock += `\n_... e mais ${totalShoppingCount - shoppingItems.length} item(ns) no app._`;
      }
    }

    const message = `🌅 *Bom dia, ${firstName}! Aqui está seu Resumo Harry de Hoje*

📅 *Compromissos & Agenda:*
${eventsBlock}

📌 *Lembretes & Tarefas:*
${tasksBlock}

🛒 *Lista de Compras:*
${shoppingBlock}

Tenha um dia muito produtivo e abençoado! ✨📱`;

    return {
      message,
      eventsCount: events.length,
      tasksCount: tasks.length,
      shoppingCount: totalShoppingCount,
    };
  }

  private async sendDailyBriefing(user: any, todayStr: string) {
    this.logger.log(`Enviando resumo matinal diário para ${user.name || user.email} (${user.phoneNumber})`);
    const { message, eventsCount, tasksCount } = await this.buildDailyBriefing(user, todayStr);
    if (user.phoneNumber) {
      await this.whatsappService.sendWhatsAppMessage(user.phoneNumber, message);
    }
    await this.notificationsService.dispatchNotification({
      recipientId: user.id,
      householdId: user.householdId,
      type: NotificationType.SYSTEM,
      title: '🌅 Seu Resumo Diário está pronto',
      body: `Você tem ${eventsCount} compromisso(s) e ${tasksCount} lembrete(s) para hoje.`,
      deepLink: '/(tabs)/calendar',
    });
  }

  private async sendPeriodicBriefing(user: any, type: string) {
    const isBiweekly = type === 'biweekly';
    const label = isBiweekly ? 'Quinzenal' : 'Semanal';
    const horizonDays = isBiweekly ? 14 : 7;
    this.logger.log(`Enviando resumo ${label} para ${user.name || user.email} (${user.phoneNumber})`);

    const now = new Date();
    const { dateStr: startStr } = this.getLocalDateParts(now, user.timezone || 'America/Sao_Paulo');
    const startOfPeriod = new Date(`${startStr}T00:00:00-03:00`);
    const endOfPeriod = new Date(startOfPeriod.getTime() + horizonDays * 24 * 3600 * 1000);

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        OR: [
          { userId: user.id },
          ...(user.householdId
            ? [{ householdId: user.householdId, scope: RecordScope.SHARED }]
            : []),
        ],
        startDate: { gte: startOfPeriod, lte: endOfPeriod },
      },
      orderBy: { startDate: 'asc' },
    });

    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [
          { userId: user.id },
          ...(user.householdId
            ? [{ householdId: user.householdId, scope: RecordScope.SHARED }]
            : []),
        ],
        isCompleted: false,
        dueDate: { gte: startOfPeriod, lte: endOfPeriod },
      },
      orderBy: { dueDate: 'asc' },
    });

    const firstName = user.name ? user.name.split(' ')[0] : 'aí';

    let eventsBlock = '• _Nenhum compromisso marcado para os próximos dias._';
    if (events.length > 0) {
      eventsBlock = events
        .map((ev: any) => {
          const dateStr = ev.startDate.toLocaleDateString('pt-BR', {
            timeZone: user.timezone || 'America/Sao_Paulo',
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          });
          const time = ev.isAllDay
            ? 'Dia todo'
            : ev.startDate.toLocaleTimeString('pt-BR', {
                timeZone: user.timezone || 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
              });
          return `• ${dateStr} às ${time}: *${ev.title}*`;
        })
        .join('\n');
    }

    let tasksBlock = '• _Nenhuma tarefa pendente com prazo neste período._';
    if (tasks.length > 0) {
      tasksBlock = tasks
        .map((tk: any) => {
          const dateStr = tk.dueDate
            ? tk.dueDate.toLocaleDateString('pt-BR', {
                timeZone: user.timezone || 'America/Sao_Paulo',
                weekday: 'short',
                day: '2-digit',
              })
            : '';
          return `• ${dateStr ? `[${dateStr}] ` : ''}${tk.title}`;
        })
        .join('\n');
    }

    const message = `🗓️ *Seu Resumo ${label} Harry!*

Olá, ${firstName}! Aqui está o panorama dos próximos ${horizonDays} dias:

📅 *Eventos & Compromissos:*
${eventsBlock}

📌 *Tarefas & Prazos:*
${tasksBlock}

Planeje sua rotina com tranquilidade no app Harry! 🚀`;

    if (user.phoneNumber) {
      await this.whatsappService.sendWhatsAppMessage(user.phoneNumber, message);
    }

    await this.notificationsService.dispatchNotification({
      recipientId: user.id,
      householdId: user.householdId,
      type: NotificationType.SYSTEM,
      title: `🗓️ Resumo ${label} Disponível`,
      body: `Confira seus ${events.length} compromisso(s) e ${tasks.length} tarefa(s) dos próximos ${horizonDays} dias.`,
      deepLink: '/(tabs)/calendar',
    });
  }
}
