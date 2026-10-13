import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';
import { AiParserService } from '../ai-parser/ai-parser.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { AIIntent, RecordScope, ExpenseCategory, ParsedWhatsAppResultDto } from '../../../../packages/shared/src';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private prisma: PrismaService,
    private aiParser: AiParserService,
    private configService: ConfigService,
    private realtimeService: RealtimeService,
  ) {}

  async processEvent(payload: any) {
    try {
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      const message = changes?.messages?.[0];

      if (!message) {
        return;
      }

      const messageType = message.type;
      const supportedTypes = ['text', 'image', 'audio', 'voice', 'document'];
      if (!supportedTypes.includes(messageType)) {
        this.logger.log(`Ignoring unsupported message type: ${messageType}`);
        return;
      }

      const messageId = message.id;
      const fromNumber = '+' + message.from; // formato E.164 (ex: +5511999999999)

      // 1. Idempotência: Checar se o evento já foi processado
      const alreadyProcessed = await this.prisma.processedWebhookEvent.findUnique({
        where: { id: messageId },
      });
      if (alreadyProcessed) {
        this.logger.warn(`Message ID ${messageId} already processed. Skipping.`);
        return;
      }

      await this.prisma.processedWebhookEvent.create({
        data: { id: messageId },
      });

      // 2. Identificar Usuário pelo Telefone
      const user = await this.findUserByPhone(message.from);
      const replyToPhone = message.from || user?.phoneNumber;

      if (!user) {
        await this.sendWhatsAppMessage(replyToPhone,
          `Olá! 👋 Seu número (${fromNumber}) ainda não está vinculado a uma conta Nexo.\n\nAcesse o app e cadastre seu telefone em Perfil para começar a registrar gastos, metas e lembretes por aqui!`,
        );
        return;
      }

      // 3. Processar mensagem (Texto, Imagem/Comprovante ou Áudio)
      let parsed: ParsedWhatsAppResultDto;
      let mediaSourceLabel = '';

      if (messageType === 'text') {
        const textBody = message.text?.body || '';
        this.logger.log(`WhatsApp text received from ${fromNumber}: "${textBody}"`);
        parsed = await this.aiParser.parseMessage(textBody);
      } else if (messageType === 'image') {
        const mediaId = message.image?.id;
        const caption = message.image?.caption || '';
        const mimeType = message.image?.mime_type || 'image/jpeg';
        this.logger.log(`WhatsApp image received from ${fromNumber} (ID: ${mediaId}, caption: "${caption}")`);

        const media = await this.downloadMedia(mediaId);
        if (!media) {
          await this.sendWhatsAppMessage(replyToPhone,
            '⚠️ Não foi possível baixar a foto/comprovante. Por favor, tente enviar novamente.',
          );
          return;
        }

        mediaSourceLabel = '📸 Comprovante/Foto';
        parsed = await this.aiParser.parseMedia(media.buffer, media.mimeType || mimeType, caption);
      } else if (messageType === 'audio' || messageType === 'voice') {
        const audioObj = message.audio || message.voice;
        const mediaId = audioObj?.id;
        const mimeType = audioObj?.mime_type || 'audio/ogg';
        this.logger.log(`WhatsApp audio received from ${fromNumber} (ID: ${mediaId})`);

        const media = await this.downloadMedia(mediaId);
        if (!media) {
          await this.sendWhatsAppMessage(replyToPhone,
            '⚠️ Não foi possível processar o áudio enviado. Por favor, tente falar mais perto do microfone ou enviar por texto.',
          );
          return;
        }

        mediaSourceLabel = '🎙️ Áudio de Voz';
        parsed = await this.aiParser.parseMedia(media.buffer, media.mimeType || mimeType);
      } else if (messageType === "document") {
        const docObj = message.document;
        const mediaId = docObj?.id;
        const filename = docObj?.filename || "documento";
        const mimeType = docObj?.mime_type || "application/octet-stream";
        this.logger.log(`WhatsApp document received from ${fromNumber} (ID: ${mediaId}, filename: "${filename}")`);

        const media = await this.downloadMedia(mediaId);
        if (!media) {
          await this.sendWhatsAppMessage(replyToPhone,
            "⚠️ Não foi possível baixar o arquivo enviado. Por favor, tente enviar novamente.",
          );
          return;
        }

        mediaSourceLabel = `📄 Arquivo/Planilha (${filename})`;
        parsed = await this.aiParser.parseMedia(media.buffer, mimeType, filename);
      } else {
        return;
      }

      // 4. Executar a ação de domínio com base na intenção
      // Se o item é compartilhado mas o usuário ainda não possui um householdId, cria automaticamente o espaço familiar para ele
      if (parsed.data.scope === RecordScope.SHARED && !user.householdId) {
        const hh = await this.prisma.household.create({
          data: {
            name: `Espaço de ${user.name ? user.name.split(' ')[0] : 'Casa'}`,
            inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          },
        });
        await this.prisma.user.update({
          where: { id: user.id },
          data: { householdId: hh.id },
        });
        user.householdId = hh.id;
      }

      const isShared = parsed.data.scope === RecordScope.SHARED;
      const scopeLabel = isShared ? '🏠 Compartilhado' : '🔒 Privado (Pessoal)';
      

      if (parsed.intent === AIIntent.CREATE_EXPENSE && parsed.data.amount) {
        const expense = await this.prisma.expense.create({
          data: {
            description: parsed.data.title,
            amount: parsed.data.amount,
            category: parsed.data.category || ExpenseCategory.OTHER,
            scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
            rawSource: mediaSourceLabel ? `whatsapp_${messageType}` : 'whatsapp_message',
            userId: user.id,
            householdId: isShared ? user.householdId : null,
          },
        });

        this.realtimeService.emit({
          type: 'EXPENSE_CREATED',
          userId: user.id,
          householdId: user.householdId,
          data: expense,
        });

        const formattedAmount = Number(expense.amount).toFixed(2).replace('.', ',');
        const sourceNotice = mediaSourceLabel ? ` (${mediaSourceLabel})` : '';

        await this.sendWhatsAppMessage(replyToPhone,
          `✅ *Gasto Registrado!*${sourceNotice}\n\n📝 *Nome:* ${expense.description}\n💰 *Valor:* R$ ${formattedAmount}\n🏷️ *Escopo:* ${scopeLabel}\n\nJá sincronizado no seu app Nexo! 📲`,
        );
      } else if (parsed.intent === AIIntent.CREATE_GOAL && parsed.data.amount) {
        const goal = await this.prisma.goal.create({
          data: {
            title: parsed.data.title,
            targetAmount: parsed.data.amount,
            scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
            userId: user.id,
            householdId: isShared ? user.householdId : null,
          },
        });

        this.realtimeService.emit({
          type: 'GOAL_UPDATED',
          userId: user.id,
          householdId: user.householdId,
          data: goal,
        });

        const formattedAmount = Number(goal.targetAmount).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const sourceNotice = mediaSourceLabel ? ` (${mediaSourceLabel})` : '';

        await this.sendWhatsAppMessage(replyToPhone,
          `🎯 *Meta Cadastrada!*${sourceNotice}\n\n🏷️ *Meta:* ${goal.title}\n💰 *Alvo:* R$ ${formattedAmount}\n👥 *Escopo:* ${scopeLabel}\n\nJá atualizado no seu painel de Metas no app Nexo! 📲`,
        );
            } else if (parsed.intent === AIIntent.CREATE_SHOPPING_ITEM) {
        // Função para remover verbos e prefixos de comando do nome do item
        const sanitizeShoppingItemName = (name: string): string => {
          return (name || '')
            .replace(/^(?:adicionar|colocar|por|pôr|bota|botar|comprar|incluir)\s+(?:na\s+|pra\s+|para\s+|no\s+)?(?:minha\s+)?(?:lista\s*(?:de\s*(?:compras|mercado))?)?\s*/gi, '')
            .replace(/\s*(?:na|pra|para|no)\s+(?:minha\s+)?lista\s*(?:de\s*(?:compras|mercado))?/gi, '')
            .replace(/^(?:adicionar|colocar|por|pôr|bota|botar|comprar|incluir)\s+/gi, '')
            .replace(/\s*\b(?:compartilhad[ao]s?|compartilhar)\b\s*$/gi, '')
            .trim();
        };

        let itemsToCreate = parsed.data.items && parsed.data.items.length > 0
          ? parsed.data.items.map(it => ({
              ...it,
              name: sanitizeShoppingItemName(it.name),
            })).filter(it => it.name.length > 0)
          : [];

        if (itemsToCreate.length === 0 && parsed.data.title) {
          const raw = sanitizeShoppingItemName(parsed.data.title);
          const splitItems = raw
            .split(/(?:,|\be\b|\n|•|-)+/i)
            .map((s) => s.trim())
            .filter(Boolean);

          itemsToCreate = (splitItems.length > 0 ? splitItems : [raw]).map((name) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            quantity: "1",
            category: "Geral",
          }));
        }

        // Se o usuário faz parte de um lar, lista de compras é compartilhada por padrão para o casal ver
        const shoppingIsShared = !!user.householdId && parsed.data.scope !== RecordScope.PRIVATE;
        const shoppingScope = shoppingIsShared ? RecordScope.SHARED : RecordScope.PRIVATE;
        const shoppingScopeLabel = shoppingIsShared ? "🏠 Compartilhado (Casa)" : "🔒 Privado (Pessoal)";

        const createdNames: string[] = [];
        for (const it of itemsToCreate) {
          const cleanName = sanitizeShoppingItemName(it.name);
          if (!cleanName) continue;
          const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          await this.prisma.shoppingItem.create({
            data: {
              name: formattedName,
              quantity: it.quantity ? it.quantity.trim() : "1",
              category: it.category ? it.category.trim() : "Geral",
              scope: shoppingScope,
              userId: user.id,
              householdId: shoppingIsShared ? user.householdId : null,
            },
          });
          createdNames.push(`• ${formattedName}${it.quantity && it.quantity !== "1" ? ` (${it.quantity})` : ""}`);
        }

        this.realtimeService.emit({
          type: 'SHOPPING_UPDATED',
          userId: user.id,
          householdId: user.householdId,
        });

        const sourceNotice = mediaSourceLabel ? ` (${mediaSourceLabel})` : '';
        const itemsText = createdNames.length > 0
          ? (createdNames.slice(0, 15).join('\n') + (createdNames.length > 15 ? `\n...e mais ${createdNames.length - 15} itens` : ''))
          : '• Item adicionado';

        await this.sendWhatsAppMessage(replyToPhone,
          `🛒 *Lista de Compras Atualizada!*${sourceNotice}\n\n${itemsText}\n\n🏷️ ${shoppingScopeLabel}\n\nJá sincronizado no app Nexo! Quando comprar, basta dar check no app! ✅📲`,
        );
} else if (parsed.intent === AIIntent.CREATE_TASK) {
        const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
        const hasSpecificTime = !!parsed.data.hasSpecificTime;

        const task = await this.prisma.task.create({
          data: {
            title: parsed.data.title,
            dueDate,
            hasSpecificTime,
            reminderSent: false,
            scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
            userId: user.id,
            householdId: isShared ? user.householdId : null,
          },
        });

        this.realtimeService.emit({
          type: 'TASK_UPDATED',
          userId: user.id,
          householdId: user.householdId,
          data: task,
        });

        let timeNotice = '';
        if (dueDate) {
          const formattedDue = dueDate.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            hour: hasSpecificTime ? '2-digit' : undefined,
            minute: hasSpecificTime ? '2-digit' : undefined,
          });
          timeNotice = `\n⏰ *Prazo:* ${formattedDue}\n🔔 *Aviso:* Notificaremos você aqui no WhatsApp antes do prazo!`;
        }
        const sourceNotice = mediaSourceLabel ? ` (${mediaSourceLabel})` : '';

        await this.sendWhatsAppMessage(replyToPhone,
          `📌 *Lembrete Anotado!*${sourceNotice}\n\n"${task.title}"\n🏷️ ${scopeLabel}${timeNotice}\n\nVocê pode ver sua lista de rotina no app! 📲`,
        );
      } else if (parsed.intent === AIIntent.QUERY_CALENDAR) {
        let queryPeriod = parsed.data?.queryPeriod || 'today';
        const rawText = (messageType === 'text' ? message.text?.body || '' : '').toLowerCase();
        if (/\b(?:amanh[aã]|pra\s+amanh[aã]|para\s+amanh[aã]|de\s+amanh[aã])\b/i.test(rawText)) {
          queryPeriod = 'tomorrow';
        } else if (/\b(?:semana|dessa\s+semana|desta\s+semana|da\s+semana|esta\s+semana|pr[oó]ximos\s+dias)\b/i.test(rawText)) {
          queryPeriod = 'week';
        }

        const now = new Date();
        const spDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const [year, month, day] = spDateStr.split("-").map((v) => parseInt(v, 10));

        let startRange: Date;
        let endRange: Date;
        let headerTitle: string;
        let emptyMessage: string;

        const formatEventLine = (ev: any, showDate = false) => {
          let datePrefix = '';
          if (showDate) {
            const evDay = ev.startDate.toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              day: '2-digit',
              month: '2-digit',
            });
            datePrefix = `[${evDay}] `;
          }

          const timeStr = ev.isAllDay
            ? 'Dia inteiro'
            : ev.startDate.toLocaleTimeString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
              });

          let loc = '';
          if (ev.location) {
            if (ev.location.includes('meet.google.com')) {
              loc = ` (🎥 ${ev.location})`;
            } else {
              loc = ` (📍 ${ev.location})`;
            }
          }

          const scopeTag = ev.scope === RecordScope.SHARED ? ' 🏠' : '';
          return `• ⏰ *${datePrefix}${timeStr}* - *${ev.title}*${loc}${scopeTag}`;
        };

        if (queryPeriod === 'tomorrow') {
          const tomorrowDate = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
          const tomorrowStr = tomorrowDate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          startRange = new Date(`${tomorrowStr}T00:00:00.000-03:00`);
          endRange = new Date(`${tomorrowStr}T23:59:59.999-03:00`);

          const tomorrowFormatted = tomorrowDate.toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
          });
          const capTomorrow = tomorrowFormatted.charAt(0).toUpperCase() + tomorrowFormatted.slice(1);
          headerTitle = `📅 *Sua Agenda para Amanhã (${capTomorrow}):*`;
          emptyMessage = `☕ Você não tem nenhum compromisso agendado para amanhã! Aproveite o dia ou diga *"agendar amanhã às 14h - Reunião"* para marcar algo novo.`;
        } else if (queryPeriod === 'week') {
          startRange = new Date(`${spDateStr}T00:00:00.000-03:00`);
          const weekEndDate = new Date(Date.UTC(year, month - 1, day + 6, 12, 0, 0));
          const weekEndStr = weekEndDate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          endRange = new Date(`${weekEndStr}T23:59:59.999-03:00`);

          const startFormatted = now.toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
          });
          const endFormatted = weekEndDate.toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
          });
          headerTitle = `📅 *Sua Agenda para os Próximos 7 Dias (${startFormatted} a ${endFormatted}):*`;
          emptyMessage = `☕ Você não tem nenhum compromisso agendado para os próximos 7 dias! Tudo livre!`;
        } else {
          startRange = new Date(`${spDateStr}T00:00:00.000-03:00`);
          endRange = new Date(`${spDateStr}T23:59:59.999-03:00`);

          const todayFormatted = now.toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
          });
          const capToday = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);
          headerTitle = `📅 *Sua Agenda para Hoje (${capToday}):*`;
          emptyMessage = `☕ Você não tem nenhum compromisso agendado para hoje! Aproveite o dia ou diga *"agendar às 15h - Reunião"* para marcar algo novo.`;
        }

        const events = await this.prisma.calendarEvent.findMany({
          where: {
            OR: [
              { userId: user.id },
              ...(user.householdId ? [{ householdId: user.householdId, scope: RecordScope.SHARED }] : []),
            ],
            AND: [
              { startDate: { lte: endRange } },
              {
                OR: [
                  { endDate: { gte: startRange } },
                  { endDate: null, startDate: { gte: startRange } },
                ],
              },
            ],
          },
          orderBy: { startDate: "asc" },
        });

        if (events.length === 0) {
          await this.sendWhatsAppMessage(replyToPhone, `${headerTitle}\n\n${emptyMessage}`);
          return;
        }

        if (queryPeriod === 'week') {
          const eventsByDay = new Map<string, any[]>();
          for (const ev of events) {
            const dayKey = ev.startDate.toLocaleDateString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
            });
            const capDay = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
            if (!eventsByDay.has(capDay)) {
              eventsByDay.set(capDay, []);
            }
            eventsByDay.get(capDay)!.push(ev);
          }

          let messageBody = `${headerTitle}\n\n`;
          for (const [dayTitle, dayEvents] of eventsByDay.entries()) {
            messageBody += `🗓️ *${dayTitle}:*\n`;
            messageBody += dayEvents.map((ev) => formatEventLine(ev)).join('\n');
            messageBody += '\n\n';
          }
          messageBody += `_Total: ${events.length} compromisso(s) no período._`;

          await this.sendWhatsAppMessage(replyToPhone, messageBody.trim());
          return;
        }

        const lines = events.map((ev: any) => formatEventLine(ev)).join("\n");
        await this.sendWhatsAppMessage(
          replyToPhone,
          `${headerTitle}\n\n${lines}\n\n_Total: ${events.length} compromisso(s)._`,
        );
        return;
      } else if (parsed.intent === AIIntent.QUERY_TASKS) {
        const tasks = await this.prisma.task.findMany({
          where: {
            OR: [
              { userId: user.id },
              ...(user.householdId ? [{ householdId: user.householdId, scope: RecordScope.SHARED }] : []),
            ],
            isCompleted: false,
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 20,
        });

        if (tasks.length === 0) {
          await this.sendWhatsAppMessage(replyToPhone,
            `📋 *Seus Lembretes & Tarefas:*\n\n🎉 Você não tem nenhum lembrete ou tarefa pendente no momento! Tudo em dia!\n\n_Para adicionar um lembrete: "lembrar de pagar conta de luz amanhã às 10h"_`,
          );
          return;
        }

        const lines = tasks
          .map((t: any) => {
            let dueStr = "";
            if (t.dueDate) {
              dueStr = ` (📅 ${t.dueDate.toLocaleDateString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })})`;
            }
            const scopeTag = t.scope === RecordScope.SHARED ? " 🏠" : "";
            return `• ▫️ *${t.title}*${dueStr}${scopeTag}`;
          })
          .join("\n");

        await this.sendWhatsAppMessage(replyToPhone,
          `📋 *Seus Lembretes & Tarefas Pendentes (${tasks.length}):*\n\n${lines}\n\n_Você também pode marcá-los como concluídos no app Nexo._`,
        );
        return;
      } else if (parsed.intent === AIIntent.QUERY_SHOPPING_LIST) {
        const items = await this.prisma.shoppingItem.findMany({
          where: {
            OR: [
              { userId: user.id },
              ...(user.householdId ? [{ householdId: user.householdId, scope: RecordScope.SHARED }] : []),
            ],
            isCompleted: false,
          },
          orderBy: [{ category: "asc" }, { createdAt: "desc" }],
        });

        if (items.length === 0) {
          await this.sendWhatsAppMessage(replyToPhone,
            `🛒 *Sua Lista de Compras:*\n\n✨ Sua lista de compras está vazia!\n\n_Para adicionar itens, basta mandar mensagem ou áudio: "comprar arroz, feijão e ovos" ou enviar uma foto/planilha._`,
          );
          return;
        }

        const lines = items
          .map((it: any) => {
            const qty = it.quantity && it.quantity !== "1" ? ` (${it.quantity})` : "";
            const cat = it.category && it.category !== "Geral" ? ` _[${it.category}]_` : "";
            return `• ▫️ *${it.name}*${qty}${cat}`;
          })
          .join("\n");

        await this.sendWhatsAppMessage(replyToPhone,
          `🛒 *Sua Lista de Compras (${items.length} itens pendentes):*\n\n${lines}\n\n_Para adicionar mais itens, envie: "comprar <item>" ou mande um áudio._`,
        );
        return;
      } else if (parsed.intent === AIIntent.CREATE_EVENT) {
        const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : new Date();
        const endDate = parsed.data.endDate
          ? new Date(parsed.data.endDate)
          : new Date(startDate.getTime() + 60 * 60 * 1000);
        const isAllDay = !!parsed.data.isAllDay;

        let googleEventId: string | null = null;
        let syncedWithGoogle = false;

        if (user.googleAccessToken) {
          try {
            if (user.googleAccessToken.startsWith("dev_token_") || user.googleAccessToken.startsWith("AIzaSy")) {
              googleEventId = "dev_event_" + Date.now();
              syncedWithGoogle = true;
            } else {
              const body: any = {
                summary: parsed.data.title,
                description: parsed.data.notes || "",
                location: parsed.data.location || "",
              };
              if (isAllDay) {
                const dateStr = startDate.toISOString().slice(0, 10);
                body.start = { date: dateStr };
                body.end = { date: (endDate || startDate).toISOString().slice(0, 10) };
              } else {
                body.start = { dateTime: startDate.toISOString() };
                body.end = { dateTime: endDate.toISOString() };
              }

              const gRes = await axios.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                body,
                {
                  headers: {
                    Authorization: `Bearer ${user.googleAccessToken}`,
                    "Content-Type": "application/json",
                  },
                },
              );
              if (gRes.data?.id) {
                googleEventId = gRes.data.id;
                syncedWithGoogle = true;
              }
            }
          } catch (e: any) {
            this.logger.warn(`WhatsApp event: falha ao sincronizar com Google Agenda: ${e?.message}`);
          }
        }

        const calendarEvent = await this.prisma.calendarEvent.create({
          data: {
            title: parsed.data.title,
            description: parsed.data.notes || null,
            startDate,
            endDate,
            isAllDay,
            location: parsed.data.location || null,
            scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
            userId: user.id,
            householdId: isShared ? user.householdId : null,
            googleEventId,
          },
        });

        this.realtimeService.emit({
          type: 'CALENDAR_UPDATED',
          userId: user.id,
          householdId: user.householdId,
          data: calendarEvent,
        });

        const formattedDate = startDate.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const timeNotice = isAllDay
          ? "Dia inteiro"
          : startDate.toLocaleTimeString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              minute: "2-digit",
            });

        const sourceNotice = mediaSourceLabel ? ` (${mediaSourceLabel})` : "";
        const syncNotice = syncedWithGoogle
          ? "\n🔄 *Sincronizado:* Adicionado automaticamente ao seu Google Agenda! 🗓️"
          : "";

        const locationNotice = calendarEvent.location
          ? `\n📍 *Local:* ${calendarEvent.location}`
          : "";

        await this.sendWhatsAppMessage(replyToPhone,
          `📅 *Compromisso Agendado!*${sourceNotice}\n\n👉 *${calendarEvent.title}*\n🗓️ *Data:* ${formattedDate}\n⏰ *Horário:* ${timeNotice}${locationNotice}\n🏷️ *Escopo:* ${scopeLabel}${syncNotice}\n\nVocê pode visualizá-lo e editá-lo no app Nexo! 📲`,
        );
      } else {
        await this.sendWhatsAppMessage(replyToPhone,
          `🤔 Não consegui identificar os dados com clareza.\n\nExperimente:\n• Enviar foto de um comprovante ou cupom fiscal\n• Gravar um áudio dizendo: "Gastei 50 no mercado hoje"\n• Gravar um áudio: "Guardar 5000 na meta viagem"\n• Digitar: "Almoço 35"`,
        );
      }
    } catch (error) {
      this.logger.error('Error handling WhatsApp message', error);
    }
  }

  private async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!accessToken) {
      this.logger.error('Cannot download media: WHATSAPP_ACCESS_TOKEN not configured.');
      return null;
    }

    try {
      // 1. Obter metadados da mídia (incluindo URL de download temporária)
      const metaRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const mediaUrl = metaRes.data?.url;
      const mimeType = metaRes.data?.mime_type || 'image/jpeg';

      if (!mediaUrl) {
        this.logger.error(`No download URL found for media ${mediaId}`);
        return null;
      }

      // 2. Baixar os bytes do arquivo
      const fileRes = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'curl/7.64.1',
        },
        responseType: 'arraybuffer',
      });

      return {
        buffer: Buffer.from(fileRes.data),
        mimeType,
      };
    } catch (err: any) {
      this.logger.error(`Failed to download media ${mediaId} from Meta: ${err?.response?.data || err.message}`);
      return null;
    }
  }

  private async findUserByPhone(rawPhone: string) {
    const digits = (rawPhone || '').replace(/\D/g, '');
    const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;

    const users = await this.prisma.user.findMany({
      where: { phoneNumber: { not: null } },
      include: { household: true },
    });

    return (
      users.find((u: any) => {
        if (!u.phoneNumber) return false;
        const uDigits = u.phoneNumber.replace(/\D/g, '');
        const uWithoutCountry = uDigits.startsWith('55') ? uDigits.slice(2) : uDigits;

        if (digits === uDigits || withoutCountry === uWithoutCountry) return true;

        // Variação do nono dígito no Brasil (11 vs 10 dígitos)
        if (withoutCountry.length === 11 && uWithoutCountry.length === 10) {
          return (
            withoutCountry.slice(0, 2) === uWithoutCountry.slice(0, 2) &&
            withoutCountry.slice(3) === uWithoutCountry.slice(2)
          );
        }
        if (withoutCountry.length === 10 && uWithoutCountry.length === 11) {
          return (
            withoutCountry.slice(0, 2) === uWithoutCountry.slice(0, 2) &&
            withoutCountry.slice(2) === uWithoutCountry.slice(3)
          );
        }

        return false;
      }) || null
    );
  }

  async sendWelcomeMessage(toPhone: string, name?: string) {
    if (!toPhone) return;
    const firstName = name ? name.trim().split(' ')[0] : 'aí';
    const welcomeText = `Olá, ${firstName}! 👋 Seja bem-vindo(a) ao Nexo! ✨\n\nA partir de agora você pode registrar gastos, tarefas e metas diretamente por aqui pelo WhatsApp.\n\nExperimente enviar:\n• "Gastei 45 no mercado"\n• Enviar a foto de um comprovante Pix ou cupom fiscal 📸\n• Mandar um áudio falando um gasto ou meta 🎙️\n• "Lembrar de pagar luz amanhã"`;
    await this.sendWhatsAppMessage(toPhone, welcomeText);
  }

  async sendWhatsAppMessage(toPhone: string, text: string) {
    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    let cleanPhone = (toPhone || '').replace(/\D/g, '');

    // Se não começar com 55 e tiver 10 ou 11 dígitos (DDD + número no Brasil), adiciona 55
    if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = '55' + cleanPhone;
    }

    // Normalização para celular brasileiro: Meta Cloud API exige o 9º dígito como destinatário (ex: 5535997108453)
    if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
      const ddd = parseInt(cleanPhone.slice(2, 4), 10);
      if (ddd >= 11) {
        cleanPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
      }
    }

    if (!accessToken || !phoneNumberId || accessToken === 'your_meta_permanent_access_token_here') {
      this.logger.warn(
        `[MOCK WHATSAPP OUTBOUND] Para: ${cleanPhone} | Mensagem: "${text.replace(/\n/g, ' ')}"`,
      );
      return;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err: any) {
      const errData = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(`Failed to send WhatsApp message via Meta API (${cleanPhone}): ${errData}`);

      // Fallback: se falhar e tiver formato alternativo com/sem 9, tenta alternativa
      const altPhone =
        cleanPhone.startsWith('55') && cleanPhone.length === 13 && cleanPhone[4] === '9'
          ? cleanPhone.slice(0, 4) + cleanPhone.slice(5)
          : null;

      if (altPhone) {
        try {
          await axios.post(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            {
              messaging_product: 'whatsapp',
              to: altPhone,
              type: 'text',
              text: { body: text },
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          );
          this.logger.log(`WhatsApp message successfully delivered via fallback phone: ${altPhone}`);
        } catch (retryErr: any) {
          const retryData = retryErr?.response?.data ? JSON.stringify(retryErr.response.data) : retryErr.message;
          this.logger.error(`Fallback attempt also failed (${altPhone}): ${retryData}`);
        }
      }
    }
  }
}
