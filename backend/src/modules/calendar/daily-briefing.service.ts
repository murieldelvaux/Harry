import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RecordScope } from '../../../../packages/shared/src';

@Injectable()
export class DailyBriefingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyBriefingService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando serviço de resumos diários e periódicos no WhatsApp...');
    // Roda a cada 45 segundos
    this.timer = setInterval(() => this.checkDailyBriefings(), 45000);
    setTimeout(() => this.checkDailyBriefings(), 7000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async checkDailyBriefings() {
    try {
      const now = new Date();
      // Fuso horário de Brasília (UTC-3)
      const brasiliaDate = new Date(now.getTime() - 3 * 3600 * 1000);
      const currHour = brasiliaDate.getUTCHours();
      const currMin = brasiliaDate.getUTCMinutes();
      const currDayOfWeek = brasiliaDate.getUTCDay(); // 0 = Domingo, 1 = Segunda...
      const todayStr = brasiliaDate.toISOString().slice(0, 10);

      // Busca usuários com telefone cadastrado e resumo diário ativado (ou null que é padrão true)
      const users = await this.prisma.user.findMany({
        where: {
          phoneNumber: { not: null },
          enableDailySummary: { not: false },
        },
      });

      for (const user of users) {
        if (!user.phoneNumber) continue;

        // Horário configurado (default: "06:00")
        const targetTime = user.dailySummaryTime || '06:00';
        const [targetHourStr, targetMinStr] = targetTime.split(':');
        const targetHour = parseInt(targetHourStr || '6', 10);
        const targetMin = parseInt(targetMinStr || '0', 10);

        const isTimeForDaily =
          currHour > targetHour || (currHour === targetHour && currMin >= targetMin);

        // 1. Resumo Diário
        if (isTimeForDaily && user.lastDailySummaryDate !== todayStr) {
          try {
            await this.sendDailyBriefing(user, todayStr);
            await this.prisma.user.update({
              where: { id: user.id },
              data: { lastDailySummaryDate: todayStr },
            });
          } catch (err: any) {
            this.logger.error(`Falha ao disparar resumo diário para usuário ${user.id} (${user.name}): ${err.message}`);
          }
        }

        // 2. Resumo Periódico (Semanal ou Quinzenal)
        const summaryType = user.periodicSummaryType || 'none';
        const summaryDay = user.periodicSummaryDay ?? 1; // 1 = Segunda-feira por padrão

        if (summaryType !== 'none' && currDayOfWeek === summaryDay && currHour >= 6) {
          let canSendPeriodic = user.lastPeriodicDate !== todayStr;

          if (canSendPeriodic && summaryType === 'biweekly' && user.lastPeriodicDate) {
            const lastDate = new Date(user.lastPeriodicDate);
            const diffDays =
              (brasiliaDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
            if (diffDays < 12) {
              canSendPeriodic = false;
            }
          }

          if (canSendPeriodic) {
            try {
              await this.sendPeriodicBriefing(user, summaryType);
              await this.prisma.user.update({
                where: { id: user.id },
                data: { lastPeriodicDate: todayStr },
              });
            } catch (err: any) {
              this.logger.error(`Falha ao disparar resumo periódico para usuário ${user.id}: ${err.message}`);
            }
          }
        }
      }
    } catch (error: any) {
      if (!error?.message?.includes('Can\'t reach database server')) {
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
    const brasiliaDate = new Date(now.getTime() - 3 * 3600 * 1000);
    const todayStr = brasiliaDate.toISOString().slice(0, 10);

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

    // Montar texto
    const firstName = user.name ? user.name.split(' ')[0] : 'aí';

    let eventsBlock = '• _Nenhum compromisso agendado para hoje. Aproveite o dia livre!_';
    if (events.length > 0) {
      eventsBlock = events
        .map((ev: any) => {
          const time = ev.isAllDay
            ? 'Dia inteiro'
            : ev.startDate.toLocaleTimeString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
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
            ? ` [às ${tk.dueDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}]`
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
    const { message } = await this.buildDailyBriefing(user, todayStr);
    await this.whatsappService.sendWhatsAppMessage(user.phoneNumber, message);
  }

  private async sendPeriodicBriefing(user: any, type: string) {
    const label = type === 'biweekly' ? 'Quinzenal' : 'Semanal';
    this.logger.log(`Enviando resumo ${label} para ${user.name || user.email} (${user.phoneNumber})`);

    const now = new Date();
    const brasiliaDate = new Date(now.getTime() - 3 * 3600 * 1000);
    const startStr = brasiliaDate.toISOString().slice(0, 10);
    const startOfPeriod = new Date(`${startStr}T00:00:00-03:00`);
    const endOfPeriod = new Date(startOfPeriod.getTime() + 7 * 24 * 3600 * 1000);

    // Eventos dos próximos 7 dias
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

    // Tarefas dos próximos 7 dias
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
            timeZone: 'America/Sao_Paulo',
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          });
          const time = ev.isAllDay
            ? 'Dia todo'
            : ev.startDate.toLocaleTimeString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
              });
          return `• ${dateStr} às ${time}: *${ev.title}*`;
        })
        .join('\n');
    }

    let tasksBlock = '• _Nenhuma tarefa pendente com prazo nesta semana._';
    if (tasks.length > 0) {
      tasksBlock = tasks
        .map((tk: any) => {
          const dateStr = tk.dueDate
            ? tk.dueDate.toLocaleDateString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                weekday: 'short',
                day: '2-digit',
              })
            : '';
          return `• ${dateStr ? `[${dateStr}] ` : ''}${tk.title}`;
        })
        .join('\n');
    }

    const message = `🗓️ *Seu Resumo ${label} Harry!*

Olá, ${firstName}! Aqui está o panorama da sua semana:

📅 *Eventos & Compromissos da Semana:*
${eventsBlock}

📌 *Tarefas & Prazos da Semana:*
${tasksBlock}

Planeje sua semana com tranquilidade no app Harry! 🚀`;

    await this.whatsappService.sendWhatsAppMessage(user.phoneNumber, message);
  }
}
