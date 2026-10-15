import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  RecordScope,
  GoogleCalendarItemDto,
} from '../../../../packages/shared/src';
import { GoogleCalendarMcpServer } from './google-calendar-mcp.server';
import { Context7Manager } from './context7.config';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private mcpServer: GoogleCalendarMcpServer;

  constructor(private prisma: PrismaService) {
    this.mcpServer = new GoogleCalendarMcpServer();
  }

  /**
   * Retorna o prompt/âncora de contexto Context7 estruturado
   */
  getContext7Anchor(): string {
    return Context7Manager.getSessionPrompt();
  }

  /**
   * Retorna instância do servidor MCP
   */
  getMcpServer(): GoogleCalendarMcpServer {
    return this.mcpServer;
  }

  async findAll(
    userId: string,
    householdId: string | null,
    start?: string,
    end?: string,
  ) {
    const whereClause: any = {
      OR: [
        { userId },
        ...(householdId ? [{ householdId, scope: RecordScope.SHARED }] : []),
      ],
    };

    if (start || end) {
      whereClause.AND = [];
      if (start) {
        whereClause.AND.push({
          OR: [
            { startDate: { gte: new Date(start) } },
            { endDate: { gte: new Date(start) } },
          ],
        });
      }
      if (end) {
        whereClause.AND.push({
          startDate: { lte: new Date(end) },
        });
      }
    }

    return this.prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findOne(id: string, userId: string, householdId: string | null) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    const isOwner = event.userId === userId;
    const isHouseholdShared =
      householdId && event.householdId === householdId && event.scope === RecordScope.SHARED;

    if (!isOwner && !isHouseholdShared) {
      throw new NotFoundException('Evento não encontrado');
    }

    return event;
  }

  /**
   * Lista calendários disponíveis para o usuário (incluindo compartilhados)
   * e preserva suas cores originais do Google.
   */
  async listCalendars(userId: string): Promise<GoogleCalendarItemDto[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleAccessToken) {
      return [];
    }

    const calendars = await this.mcpServer.listCalendars(user.googleAccessToken);

    // Atualiza ou salva o estado visual de cada calendário no banco local
    for (const cal of calendars) {
      await this.prisma.googleCalendarSyncState.upsert({
        where: {
          userId_calendarId: {
            userId,
            calendarId: cal.id,
          },
        },
        update: {
          calendarName: cal.name,
          backgroundColor: cal.colors.background,
          foregroundColor: cal.colors.foreground,
        },
        create: {
          userId,
          calendarId: cal.id,
          calendarName: cal.name,
          backgroundColor: cal.colors.background,
          foregroundColor: cal.colors.foreground,
        },
      });
    }

    return calendars;
  }

  async create(userId: string, householdId: string | null, dto: CreateCalendarEventDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isShared = dto.scope === RecordScope.SHARED && !!householdId;

    let googleEventId: string | null = null;
    let finalLocation = dto.location || null;
    let finalAttendees = dto.attendees || null;
    const targetCalendarId = dto.googleCalendarId || 'primary';
    let assignedColor = dto.color || null;

    // Se o usuário não definiu cor específica, busca a cor do calendário no sync state
    if (!assignedColor) {
      const calState = await this.prisma.googleCalendarSyncState.findUnique({
        where: { userId_calendarId: { userId, calendarId: targetCalendarId } },
      });
      if (calState?.backgroundColor) {
        assignedColor = calState.backgroundColor;
      }
    }

    // Se o usuário possui token do Google Calendar configurado, sincroniza com o Google Calendar via MCP
    if (user?.googleAccessToken) {
      try {
        let attendeeList: string[] = [];
        if (dto.attendees) {
          try {
            const parsed = JSON.parse(dto.attendees);
            if (Array.isArray(parsed)) {
              attendeeList = parsed.map((a: any) => typeof a === 'string' ? a : a.email).filter(Boolean);
            }
          } catch {
            attendeeList = dto.attendees.split(/[,;\n]/).map(s => s.trim()).filter(s => s.includes('@'));
          }
        }

        const pushRes = await this.mcpServer.createEvent(user.googleAccessToken, targetCalendarId, {
          title: dto.title,
          description: dto.description,
          startDate: dto.startDate,
          endDate: dto.endDate,
          isAllDay: dto.isAllDay,
          location: dto.location,
          colorId: dto.colorId,
          createMeetLink: dto.createMeetLink,
          attendees: attendeeList,
        });

        if (pushRes.id) {
          googleEventId = pushRes.id;
        }
        const meetLink = pushRes.hangoutLink || pushRes.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;
        if (meetLink) {
          finalLocation = finalLocation ? `${finalLocation} | ${meetLink}` : meetLink;
        }
        if (pushRes.attendees) {
          finalAttendees = JSON.stringify(pushRes.attendees);
        }
      } catch (err: any) {
        this.logger.warn(`Falha ao exportar evento para o Google Agenda via MCP: ${err?.message || err}`);
      }
    }

    return this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isAllDay: !!dto.isAllDay,
        location: finalLocation,
        scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
        attendees: finalAttendees,
        userId,
        householdId: isShared ? householdId : null,
        googleEventId,
        googleCalendarId: targetCalendarId,
        color: assignedColor,
        colorId: dto.colorId || null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateCalendarEventDto) {
    const existing = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Evento não encontrado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let googleEventId = existing.googleEventId;
    let finalLocation = dto.location !== undefined ? (dto.location || null) : existing.location;
    let finalAttendees = dto.attendees !== undefined ? (dto.attendees || null) : existing.attendees;
    const targetCalendarId = dto.googleCalendarId || existing.googleCalendarId || 'primary';

    if (user?.googleAccessToken) {
      const eventDetails = {
        title: dto.title || existing.title,
        description: dto.description !== undefined ? (dto.description || undefined) : (existing.description || undefined),
        startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : undefined) : (existing.endDate || undefined),
        isAllDay: dto.isAllDay !== undefined ? dto.isAllDay : existing.isAllDay,
        location: dto.location !== undefined ? (dto.location || undefined) : (existing.location || undefined),
        attendees: dto.attendees !== undefined ? (dto.attendees || undefined) : (existing.attendees || undefined),
        createMeetLink: dto.createMeetLink,
      };

      if (googleEventId && !googleEventId.startsWith('dev_event_') && !googleEventId.startsWith('mock_ev_')) {
        try {
          const updateRes = await this.updateGoogleCalendarEvent(
            user.googleAccessToken,
            googleEventId,
            eventDetails,
            targetCalendarId,
          );
          if (updateRes.meetLink) {
            if (!finalLocation) {
              finalLocation = updateRes.meetLink;
            } else if (!finalLocation.includes(updateRes.meetLink)) {
              finalLocation = `${finalLocation} | ${updateRes.meetLink}`;
            }
          }
          if (updateRes.attendees) {
            finalAttendees = updateRes.attendees;
          }
        } catch (err: any) {
          this.logger.warn(`Falha ao atualizar evento no Google Agenda: ${err?.message || err}`);
        }
      } else {
        // Se ainda não tinha googleEventId no Google Agenda, cria agora
        try {
          const pushRes = await this.pushToGoogleCalendar(
            user.googleAccessToken,
            eventDetails,
            targetCalendarId,
          );
          if (pushRes.id) {
            googleEventId = pushRes.id;
          }
          if (pushRes.meetLink) {
            finalLocation = finalLocation ? `${finalLocation} | ${pushRes.meetLink}` : pushRes.meetLink;
          }
          if (pushRes.attendees) {
            finalAttendees = pushRes.attendees;
          }
        } catch (err: any) {
          this.logger.warn(`Falha ao exportar evento atualizado para Google Agenda: ${err?.message || err}`);
        }
      }
    }

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.isAllDay !== undefined && { isAllDay: dto.isAllDay }),
        location: finalLocation,
        attendees: finalAttendees,
        ...(dto.scope && { scope: dto.scope }),
        ...(dto.color && { color: dto.color }),
        ...(dto.colorId !== undefined && { colorId: dto.colorId }),
        ...(dto.googleCalendarId && { googleCalendarId: dto.googleCalendarId }),
        ...(googleEventId && { googleEventId }),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async delete(userId: string, id: string) {
    const existing = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Evento não encontrado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (existing.googleEventId && user?.googleAccessToken) {
      try {
        await this.deleteGoogleCalendarEvent(
          user.googleAccessToken,
          existing.googleEventId,
          existing.googleCalendarId || 'primary',
        );
      } catch (err: any) {
        this.logger.warn(`Falha ao excluir evento do Google Agenda: ${err?.message || err}`);
      }
    }

    return this.prisma.calendarEvent.delete({ where: { id } });
  }

  /**
   * Sincronização incremental por MCP (com fallback se full sync for exigido)
   */
  async syncWithGoogle(userId: string, householdId: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.googleAccessToken) {
      return {
        success: false,
        needsConnect: true,
        message: 'Conta Google não vinculada ou sem permissão de agenda. Clique em "Conectar Google Agenda".',
        eventsSynced: 0,
      };
    }

    try {
      // 1. Obter lista de calendários (inclusive compartilhados) com cores
      const calendars = await this.listCalendars(userId);
      let totalImported = 0;

      for (const cal of calendars) {
        const syncState = await this.prisma.googleCalendarSyncState.findUnique({
          where: { userId_calendarId: { userId, calendarId: cal.id } },
        });

        const syncRes = await this.mcpServer.syncIncremental(
          user.googleAccessToken,
          cal.id,
          syncState?.syncToken || undefined,
        );

        if (syncRes.resyncRequired) {
          // Token expirado (410 Gone), limpa e reexecuta full sync
          await this.prisma.googleCalendarSyncState.update({
            where: { id: syncState!.id },
            data: { syncToken: null },
          });
          const fullRes = await this.mcpServer.syncIncremental(user.googleAccessToken, cal.id);
          totalImported += await this.processSyncEvents(userId, householdId, cal, fullRes.events);
          if (fullRes.nextSyncToken) {
            await this.prisma.googleCalendarSyncState.update({
              where: { id: syncState!.id },
              data: { syncToken: fullRes.nextSyncToken, lastSyncedAt: new Date() },
            });
          }
        } else {
          totalImported += await this.processSyncEvents(userId, householdId, cal, syncRes.events);
          if (syncRes.nextSyncToken) {
            await this.prisma.googleCalendarSyncState.upsert({
              where: { userId_calendarId: { userId, calendarId: cal.id } },
              update: { syncToken: syncRes.nextSyncToken, lastSyncedAt: new Date() },
              create: {
                userId,
                calendarId: cal.id,
                syncToken: syncRes.nextSyncToken,
                lastSyncedAt: new Date(),
                backgroundColor: cal.colors.background,
                foregroundColor: cal.colors.foreground,
              },
            });
          }
        }
      }

      // 2. Exportar eventos locais que ainda não têm googleEventId
      const localEventsWithoutGoogle = await this.prisma.calendarEvent.findMany({
        where: {
          userId,
          googleEventId: null,
        },
      });

      let exportedCount = 0;
      for (const localEv of localEventsWithoutGoogle) {
        try {
          const pushRes = await this.mcpServer.createEvent(
            user.googleAccessToken,
            localEv.googleCalendarId || 'primary',
            {
              title: localEv.title,
              description: localEv.description || undefined,
              startDate: localEv.startDate.toISOString(),
              endDate: localEv.endDate ? localEv.endDate.toISOString() : undefined,
              isAllDay: localEv.isAllDay,
              location: localEv.location || undefined,
            },
          );

          if (pushRes.id) {
            await this.prisma.calendarEvent.update({
              where: { id: localEv.id },
              data: {
                googleEventId: pushRes.id,
              },
            });
            exportedCount++;
          }
        } catch {
          // segue para os próximos
        }
      }

      return {
        success: true,
        message: 'Sincronização bidirecional concluída com sucesso via MCP!',
        importedFromGoogle: totalImported,
        exportedToGoogle: exportedCount,
        calendarsCount: calendars.length,
      };
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || err?.message || '';
      this.logger.error(`Erro ao sincronizar via MCP: ${errorMsg}`);
      return {
        success: false,
        message: 'Falha na sincronização via Google Calendar MCP.',
        error: errorMsg,
      };
    }
  }

  /**
   * Registra Webhooks Push Notifications para todos os calendários do usuário
   */
  async setupPushNotifications(userId: string, callbackBaseUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleAccessToken) {
      return { success: false, message: 'Usuário sem token Google.' };
    }

    const calendars = await this.listCalendars(userId);
    const webhookUrl = `${callbackBaseUrl.replace(/\/$/, '')}/calendar/webhook`;
    const results = [];

    for (const cal of calendars) {
      const channelId = crypto.randomUUID();
      const webhookToken = `userId=${userId}&calendarId=${cal.id}&secret=${crypto.randomBytes(8).toString('hex')}`;

      try {
        const watchRes = await this.mcpServer.watchCalendar(
          user.googleAccessToken,
          cal.id,
          webhookUrl,
          channelId,
          webhookToken,
        );

        await this.prisma.googleCalendarSyncState.upsert({
          where: { userId_calendarId: { userId, calendarId: cal.id } },
          update: {
            channelId: watchRes.id,
            resourceId: watchRes.resourceId,
            expiration: watchRes.expiration ? new Date(Number(watchRes.expiration)) : null,
          },
          create: {
            userId,
            calendarId: cal.id,
            calendarName: cal.name,
            backgroundColor: cal.colors.background,
            foregroundColor: cal.colors.foreground,
            channelId: watchRes.id,
            resourceId: watchRes.resourceId,
            expiration: watchRes.expiration ? new Date(Number(watchRes.expiration)) : null,
          },
        });

        results.push({ calendarId: cal.id, channelId: watchRes.id, status: 'registered' });
      } catch (err: any) {
        this.logger.error(`Erro ao registrar webhook push para ${cal.id}: ${err?.message || err}`);
        results.push({ calendarId: cal.id, error: err?.message || String(err) });
      }
    }

    return {
      success: true,
      message: 'Push Notifications configuradas com sucesso!',
      channels: results,
    };
  }

  /**
   * Processador do Webhook Push Notification do Google Calendar
   */
  async handlePushNotification(headers: Record<string, any>) {
    const resourceState = headers['x-goog-resource-state']; // 'sync' | 'exists' | 'not_exists'
    const channelId = headers['x-goog-channel-id'];
    const channelToken = headers['x-goog-channel-token'];

    this.logger.log(`Webhook Push recebido. State: ${resourceState}, ChannelId: ${channelId}`);

    if (resourceState === 'sync') {
      return { handled: true, state: 'initial_sync_ping' };
    }

    let userId: string | null = null;
    let calendarId: string | null = null;

    if (channelToken) {
      const params = new URLSearchParams(channelToken);
      userId = params.get('userId');
      calendarId = params.get('calendarId');
    }

    if (!userId || !calendarId) {
      const syncState = await this.prisma.googleCalendarSyncState.findFirst({
        where: { channelId },
      });
      if (syncState) {
        userId = syncState.userId;
        calendarId = syncState.calendarId;
      }
    }

    if (!userId || !calendarId) {
      this.logger.warn(`Canal ou usuário não localizado para channelId: ${channelId}`);
      return { handled: false, error: 'Channel or user not found' };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleAccessToken) {
      return { handled: false, error: 'User token not found' };
    }

    const syncState = await this.prisma.googleCalendarSyncState.findUnique({
      where: { userId_calendarId: { userId, calendarId } },
    });

    // Executa sincronização incremental imediata
    const syncRes = await this.mcpServer.syncIncremental(
      user.googleAccessToken,
      calendarId,
      syncState?.syncToken || undefined,
    );

    const calMeta: GoogleCalendarItemDto = {
      id: calendarId,
      name: syncState?.calendarName || 'Calendário Google',
      isPrimary: calendarId === 'primary',
      accessRole: 'writer',
      colors: {
        background: syncState?.backgroundColor || '#4285F4',
        foreground: syncState?.foregroundColor || '#FFFFFF',
      },
    };

    if (syncRes.resyncRequired) {
      const fullRes = await this.mcpServer.syncIncremental(user.googleAccessToken, calendarId);
      await this.processSyncEvents(userId, user.householdId, calMeta, fullRes.events);
      if (fullRes.nextSyncToken) {
        await this.prisma.googleCalendarSyncState.update({
          where: { id: syncState!.id },
          data: { syncToken: fullRes.nextSyncToken, lastSyncedAt: new Date() },
        });
      }
    } else {
      await this.processSyncEvents(userId, user.householdId, calMeta, syncRes.events);
      if (syncRes.nextSyncToken && syncState) {
        await this.prisma.googleCalendarSyncState.update({
          where: { id: syncState.id },
          data: { syncToken: syncRes.nextSyncToken, lastSyncedAt: new Date() },
        });
      }
    }

    return { handled: true, changesProcessed: syncRes.events.length };
  }

  // --- Processamento de Eventos Delta ---
  private async processSyncEvents(
    userId: string,
    householdId: string | null,
    cal: GoogleCalendarItemDto,
    events: any[],
  ): Promise<number> {
    let count = 0;

    for (const item of events) {
      if (!item.id) continue;

      // Invariante: se status for cancelled, apaga o evento no app
      if (item.status === 'cancelled') {
        const existing = await this.prisma.calendarEvent.findFirst({
          where: { googleEventId: item.id },
        });
        if (existing) {
          await this.prisma.calendarEvent.delete({ where: { id: existing.id } });
        }
        continue;
      }

      if (!item.summary) continue;

      const isAllDay = !!item.start?.date;
      const startDate = item.start?.dateTime
        ? new Date(item.start.dateTime)
        : item.start?.date
        ? new Date(item.start.date + 'T00:00:00Z')
        : new Date();

      const endDate = item.end?.dateTime
        ? new Date(item.end.dateTime)
        : item.end?.date
        ? new Date(item.end.date + 'T23:59:59Z')
        : null;

      const meetLink =
        item.hangoutLink ||
        item.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
        null;

      let location = item.location || null;
      if (meetLink && !location) {
        location = meetLink;
      } else if (meetLink && location && !location.includes(meetLink)) {
        location = `${location} | ${meetLink}`;
      }

      const attendees =
        item.attendees && Array.isArray(item.attendees) && item.attendees.length > 0
          ? JSON.stringify(
              item.attendees.map((att: any) => ({
                email: att.email,
                displayName: att.displayName || att.email,
                responseStatus: att.responseStatus || 'needsAction',
              })),
            )
          : null;

      const existing = await this.prisma.calendarEvent.findFirst({
        where: { googleEventId: item.id },
      });

      if (!existing) {
        await this.prisma.calendarEvent.create({
          data: {
            title: item.summary,
            description: item.description || null,
            location,
            startDate,
            endDate,
            isAllDay,
            googleEventId: item.id,
            googleCalendarId: cal.id,
            color: cal.colors.background,
            colorId: item.colorId || null,
            etag: item.etag || null,
            scope: RecordScope.PRIVATE,
            attendees,
            userId,
            householdId: null,
          },
        });
        count++;
      } else {
        await this.prisma.calendarEvent.update({
          where: { id: existing.id },
          data: {
            title: item.summary,
            description: item.description || null,
            location,
            attendees: attendees || existing.attendees,
            startDate,
            endDate,
            isAllDay,
            googleCalendarId: cal.id,
            color: cal.colors.background,
            colorId: item.colorId || existing.colorId,
            etag: item.etag || existing.etag,
          },
        });
        count++;
      }
    }

    return count;
  }

  // --- Métodos Legados / Auxiliares mantidos para retrocompatibilidade ---

  private async pushToGoogleCalendar(
    token: string,
    eventData: any,
    calendarId = 'primary',
  ) {
    return this.mcpServer.createEvent(token, calendarId, {
      title: eventData.title,
      description: eventData.description,
      startDate: eventData.startDate.toISOString(),
      endDate: eventData.endDate ? eventData.endDate.toISOString() : undefined,
      isAllDay: eventData.isAllDay,
      location: eventData.location,
      createMeetLink: eventData.createMeetLink,
    });
  }

  private async updateGoogleCalendarEvent(
    token: string,
    googleEventId: string,
    eventData: any,
    calendarId = 'primary',
  ) {
    if (token.startsWith('dev_token_') || token.startsWith('AIzaSy')) {
      return {
        meetLink: eventData.createMeetLink ? `https://meet.google.com/nexo-dev-${Date.now().toString(36)}` : null,
        attendees: null,
      };
    }

    const body: any = {
      summary: eventData.title,
      description: eventData.description || '',
      location: eventData.location || '',
    };

    if (eventData.isAllDay) {
      const dateStr = eventData.startDate.toISOString().slice(0, 10);
      body.start = { date: dateStr };
      const endDate = eventData.endDate || eventData.startDate;
      body.end = { date: endDate.toISOString().slice(0, 10) };
    } else {
      body.start = { dateTime: eventData.startDate.toISOString() };
      const endDate = eventData.endDate || new Date(eventData.startDate.getTime() + 60 * 60 * 1000);
      body.end = { dateTime: endDate.toISOString() };
    }

    const encodedCalId = encodeURIComponent(calendarId);
    const res = await axios.put(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${googleEventId}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: { conferenceDataVersion: 1 },
      },
    );

    return {
      meetLink: res.data?.hangoutLink || res.data?.conferenceData?.entryPoints?.[0]?.uri || null,
      attendees: res.data?.attendees ? JSON.stringify(res.data.attendees) : null,
    };
  }

  private async deleteGoogleCalendarEvent(token: string, googleEventId: string, calendarId = 'primary') {
    if (token.startsWith('dev_token_') || token.startsWith('AIzaSy')) {
      return;
    }
    const encodedCalId = encodeURIComponent(calendarId);
    await axios.delete(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${googleEventId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }
}
