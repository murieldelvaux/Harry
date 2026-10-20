import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class TaskReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskReminderService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando serviço de lembretes proativos do WhatsApp...');
    // Roda verificação a cada 30 segundos
    this.timer = setInterval(() => this.checkPendingReminders(), 30000);
    // Verificação inicial após 5s
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
            // Lembretes curtos (ex: daqui 10 min): avisar de 1 a 2 minutos antes ou no prazo
            if (diffMinutes <= 2 && diffMinutes >= -15) {
              shouldRemind = true;
              detailTime = '⏳ *Prazo:* O horário limite está chegando ou é agora!';
            }
          } else {
            // Lembretes mais longos com horário definido: avisar 1 hora antes (<= 60 min)
            if (diffMinutes <= 60 && diffMinutes >= -15) {
              shouldRemind = true;
              detailTime = `⏰ *Prazo:* Falta cerca de ${Math.max(1, Math.round(diffMinutes))} minuto(s) para o horário marcado!`;
            }
          }
        } else {
          // Lembretes sem horário específico (apenas o dia): avisar no início do dia (a partir das 08h da manhã)
          const dueDayStr = due.toISOString().slice(0, 10);
          const nowDayStr = now.toISOString().slice(0, 10);

          // Horário local de Brasília (UTC-3)
          const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;

          if (nowDayStr >= dueDayStr && brasiliaHour >= 8) {
            shouldRemind = true;
            detailTime = '📅 *Data:* Hoje é o dia deste compromisso!';
          }
        }

        if (shouldRemind) {
          this.logger.log(`Disparando lembrete no WhatsApp para tarefa "${task.title}" (ID: ${task.id})`);

          if (task.user?.phoneNumber) {
            const firstName = task.user.name ? task.user.name.split(' ')[0] : 'aí';
            const isShared = task.scope === 'SHARED';
            const scopeTag = isShared ? '🏠 Lembrete Compartilhado' : '🔒 Lembrete Pessoal';

            const message = `🔔 *Lembrete Harry!*\n\nOlá, ${firstName}! Vim te lembrar do compromisso:\n👉 *${task.title}*\n${scopeTag}\n\n${detailTime}\n\n✅ Não se esqueça! Você pode visualizá-lo e marcar como concluído pelo app Harry.`;

            await this.whatsappService.sendWhatsAppMessage(task.user.phoneNumber, message);
          }

          await this.prisma.task.update({
            where: { id: task.id },
            data: { reminderSent: true },
          });
        }
      }
    } catch (error: any) {
      if (!error?.message?.includes('Can\'t reach database server')) {
        this.logger.error('Erro ao verificar lembretes pendentes', error);
      }
    }
  }
}
