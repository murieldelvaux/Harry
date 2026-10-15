import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { Context7Manager } from './context7.config';

export interface CalendarListMetadata {
  id: string;
  name: string;
  description?: string;
  isPrimary: boolean;
  accessRole: string;
  colors: {
    background: string;
    foreground: string;
  };
}

export interface DeltaSyncResult {
  calendarId: string;
  events: Array<{
    id: string;
    status: string;
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    colorId?: string;
    etag?: string;
    location?: string;
    hangoutLink?: string;
    conferenceData?: any;
    attendees?: any[];
  }>;
  nextSyncToken?: string;
  resyncRequired?: boolean;
}

/**
 * Servidor MCP para o Google Calendar
 * Fornece ferramentas padronizadas para agentes AI e orquestração interna.
 */
export class GoogleCalendarMcpServer {
  private readonly logger = new Logger(GoogleCalendarMcpServer.name);
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'nexo-google-calendar-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // 1. Lista de ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'get_context7_anchor',
          description: 'Obtém o anchor de contexto estruturado context7 com schemas e invariantes de sincronização do Google Calendar.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_shared_calendars',
          description: 'Lista todos os calendários do usuário (inclusive compartilhados) preservando cores originais (backgroundColor, foregroundColor).',
          inputSchema: {
            type: 'object',
            properties: {
              accessToken: { type: 'string', description: 'Token OAuth2 do Google Calendar' },
            },
            required: ['accessToken'],
          },
        },
        {
          name: 'sync_incremental_events',
          description: 'Executa a sincronização incremental (delta sync) utilizando syncToken para listar apenas alterações.',
          inputSchema: {
            type: 'object',
            properties: {
              accessToken: { type: 'string', description: 'Token OAuth2 do Google Calendar' },
              calendarId: { type: 'string', description: 'ID do calendário ou primary' },
              syncToken: { type: 'string', description: 'SyncToken prévio para delta sync' },
            },
            required: ['accessToken', 'calendarId'],
          },
        },
        {
          name: 'create_calendar_event',
          description: 'Cria um evento no Google Calendar especificando calendário, cor, participantes e conferência Meet.',
          inputSchema: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              calendarId: { type: 'string', default: 'primary' },
              event: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  startDate: { type: 'string' },
                  endDate: { type: 'string' },
                  isAllDay: { type: 'boolean' },
                  location: { type: 'string' },
                  colorId: { type: 'string' },
                  createMeetLink: { type: 'boolean' },
                  attendees: { type: 'array', items: { type: 'string' } },
                },
                required: ['title', 'startDate'],
              },
            },
            required: ['accessToken', 'event'],
          },
        },
        {
          name: 'register_push_webhook',
          description: 'Registra canal de push notifications (watch) no Google Calendar para notificações em tempo real sem polling.',
          inputSchema: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              calendarId: { type: 'string' },
              webhookUrl: { type: 'string' },
              channelId: { type: 'string' },
              token: { type: 'string' },
            },
            required: ['accessToken', 'calendarId', 'webhookUrl', 'channelId'],
          },
        },
        {
          name: 'stop_push_webhook',
          description: 'Encerra canal de push notifications ativo no Google Calendar.',
          inputSchema: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              channelId: { type: 'string' },
              resourceId: { type: 'string' },
            },
            required: ['accessToken', 'channelId', 'resourceId'],
          },
        },
      ];

      return { tools };
    });

    // 2. Manipulador de chamadas de ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_context7_anchor':
            return {
              content: [
                {
                  type: 'text',
                  text: Context7Manager.getSessionPrompt(),
                },
              ],
            };

          case 'list_shared_calendars': {
            const list = await this.listCalendars(args?.accessToken as string);
            return {
              content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
            };
          }

          case 'sync_incremental_events': {
            const result = await this.syncIncremental(
              args?.accessToken as string,
              args?.calendarId as string,
              args?.syncToken as string | undefined,
            );
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
          }

          case 'create_calendar_event': {
            const result = await this.createEvent(
              args?.accessToken as string,
              (args?.calendarId as string) || 'primary',
              args?.event as any,
            );
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
          }

          case 'register_push_webhook': {
            const result = await this.watchCalendar(
              args?.accessToken as string,
              args?.calendarId as string,
              args?.webhookUrl as string,
              args?.channelId as string,
              args?.token as string,
            );
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
          }

          case 'stop_push_webhook': {
            const result = await this.stopWatch(
              args?.accessToken as string,
              args?.channelId as string,
              args?.resourceId as string,
            );
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
          }

          default:
            throw new Error(`Ferramenta MCP '${name}' não encontrada.`);
        }
      } catch (err: any) {
        this.logger.error(`Erro ao executar ferramenta MCP ${name}: ${err?.message || err}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: err?.message || String(err) }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  public getServer(): Server {
    return this.server;
  }

  // --- Implementação dos Métodos Diretos da Google Calendar API ---

  public async listCalendars(accessToken: string): Promise<CalendarListMetadata[]> {
    if (accessToken.startsWith('dev_token_') || accessToken.startsWith('AIzaSy')) {
      return [
        {
          id: 'primary',
          name: 'Principal (Dev)',
          isPrimary: true,
          accessRole: 'owner',
          colors: { background: '#4285F4', foreground: '#FFFFFF' },
        },
        {
          id: 'shared_work@group.calendar.google.com',
          name: 'Trabalho / Família (Compartilhado)',
          isPrimary: false,
          accessRole: 'writer',
          colors: { background: '#8B5CF6', foreground: '#FFFFFF' },
        },
      ];
    }

    const { data } = await axios.get(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { minAccessRole: 'reader', showHidden: false },
      },
    );

    return (data.items || []).map((item: any) => ({
      id: item.id,
      name: item.summaryOverride || item.summary || 'Calendário sem nome',
      description: item.description,
      isPrimary: !!item.primary,
      accessRole: item.accessRole || 'reader',
      colors: {
        background: item.backgroundColor || '#4285F4',
        foreground: item.foregroundColor || '#FFFFFF',
      },
    }));
  }

  public async syncIncremental(
    accessToken: string,
    calendarId: string,
    syncToken?: string,
  ): Promise<DeltaSyncResult> {
    if (accessToken.startsWith('dev_token_') || accessToken.startsWith('AIzaSy')) {
      return {
        calendarId,
        events: [],
        nextSyncToken: `dev_sync_${Date.now()}`,
      };
    }

    try {
      const allEvents: any[] = [];
      let pageToken: string | undefined = undefined;
      let nextSyncToken: string | undefined = undefined;

      do {
        const params: any = {
          maxResults: 250,
          singleEvents: true,
          conferenceDataVersion: 1,
        };

        if (syncToken) {
          params.syncToken = syncToken;
        } else {
          // Se não houver syncToken inicial, busca últimos 30 dias até 90 dias
          params.timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          params.timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }

        if (pageToken) {
          params.pageToken = pageToken;
        }

        const encodedCalendarId = encodeURIComponent(calendarId);
        const { data } = await axios.get(
          `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params,
          },
        );

        if (data.items) {
          allEvents.push(...data.items);
        }

        pageToken = data.nextPageToken || undefined;
        if (data.nextSyncToken) {
          nextSyncToken = data.nextSyncToken;
        }
      } while (pageToken);

      return {
        calendarId,
        events: allEvents,
        nextSyncToken,
      };
    } catch (err: any) {
      if (err.response?.status === 410) {
        // syncToken expirou. Obriga full resync limpo.
        return {
          calendarId,
          events: [],
          resyncRequired: true,
        };
      }
      throw err;
    }
  }

  public async createEvent(
    accessToken: string,
    calendarId: string,
    eventData: {
      title: string;
      description?: string;
      startDate: string;
      endDate?: string;
      isAllDay?: boolean;
      location?: string;
      colorId?: string;
      createMeetLink?: boolean;
      attendees?: string[];
    },
  ) {
    if (accessToken.startsWith('dev_token_') || accessToken.startsWith('AIzaSy')) {
      return {
        id: `mock_ev_${Date.now()}`,
        status: 'confirmed',
        summary: eventData.title,
        hangoutLink: eventData.createMeetLink ? 'https://meet.google.com/dev-mock' : null,
      };
    }

    const body: any = {
      summary: eventData.title,
      description: eventData.description || '',
      location: eventData.location || '',
    };

    if (eventData.colorId) {
      body.colorId = eventData.colorId;
    }

    const startD = new Date(eventData.startDate);
    if (eventData.isAllDay) {
      body.start = { date: startD.toISOString().slice(0, 10) };
      const endD = eventData.endDate ? new Date(eventData.endDate) : startD;
      body.end = { date: endD.toISOString().slice(0, 10) };
    } else {
      body.start = { dateTime: startD.toISOString() };
      const endD = eventData.endDate ? new Date(eventData.endDate) : new Date(startD.getTime() + 60 * 60 * 1000);
      body.end = { dateTime: endD.toISOString() };
    }

    if (eventData.createMeetLink) {
      body.conferenceData = {
        createRequest: {
          requestId: `nexo-mcp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    if (eventData.attendees && eventData.attendees.length > 0) {
      body.attendees = eventData.attendees.map((email) => ({ email }));
    }

    const encodedCalendarId = encodeURIComponent(calendarId);
    const { data } = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          conferenceDataVersion: 1,
          sendUpdates: eventData.attendees?.length ? 'all' : 'none',
        },
      },
    );

    return data;
  }

  public async watchCalendar(
    accessToken: string,
    calendarId: string,
    webhookUrl: string,
    channelId: string,
    token: string,
  ) {
    if (accessToken.startsWith('dev_token_') || accessToken.startsWith('AIzaSy')) {
      return {
        id: channelId,
        resourceId: `res_${channelId}`,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    }

    const encodedCalendarId = encodeURIComponent(calendarId);
    const { data } = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/watch`,
      {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return data;
  }

  public async stopWatch(accessToken: string, channelId: string, resourceId: string) {
    if (accessToken.startsWith('dev_token_') || accessToken.startsWith('AIzaSy')) {
      return { success: true };
    }

    const { data } = await axios.post(
      'https://www.googleapis.com/calendar/v3/channels/stop',
      {
        id: channelId,
        resourceId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return data;
  }
}
