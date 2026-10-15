/**
 * Context7 Configuration and Anchor for Google Calendar MCP Integration
 * 
 * Defines schemas, delta synchronization rules, color mappings, and invariants
 * used by LLM assistants and autonomous tools to interact with Google Calendar.
 */

export interface Context7SessionConfig {
  domain: string;
  strict_parameters: {
    pagination_delta: string;
    concurrency: string;
    notification_types: string[];
  };
  mcp_server: string;
  required_schemas: Array<{
    entity: string;
    fields: string[];
  }>;
  invariants: string[];
}

export const GOOGLE_CALENDAR_CONTEXT7_CONFIG: Context7SessionConfig = {
  domain: "google_calendar_bidirectional_sync",
  strict_parameters: {
    pagination_delta: "syncToken",
    concurrency: "etag",
    notification_types: ["sync", "exists", "not_exists"],
  },
  mcp_server: "google-calendar-mcp",
  required_schemas: [
    {
      entity: "CalendarListEntry",
      fields: [
        "id",
        "summary",
        "backgroundColor",
        "foregroundColor",
        "colorId",
        "accessRole",
        "primary",
      ],
    },
    {
      entity: "Event",
      fields: [
        "id",
        "status",
        "summary",
        "start",
        "end",
        "colorId",
        "updated",
        "etag",
        "conferenceData",
        "attendees",
      ],
    },
    {
      entity: "SyncState",
      fields: [
        "calendarId",
        "channelId",
        "resourceId",
        "expiration",
        "syncToken",
        "lastSyncedAt",
      ],
    },
  ],
  invariants: [
    "Nunca executar full sync quando houver um syncToken válido.",
    "Tratar HTTP 410 (Gone) invalidando o syncToken e realizando resync limpo.",
    "Se o status do evento for 'cancelled', deletar o registro do banco de dados local.",
    "Preservar backgroundColor e foregroundColor do calendário para manter paridade visual.",
    "Evitar loops de eco: mutações disparadas pelo webhook Google recebem origin: 'REMOTE'.",
  ],
};

export class Context7Manager {
  static getSessionPrompt(): string {
    return `[Context7 Session Anchor: Google Calendar Bidirectional Sync]
Domain: ${GOOGLE_CALENDAR_CONTEXT7_CONFIG.domain}
MCP Server: ${GOOGLE_CALENDAR_CONTEXT7_CONFIG.mcp_server}
Invariants:
${GOOGLE_CALENDAR_CONTEXT7_CONFIG.invariants.map((inv, idx) => `  ${idx + 1}. ${inv}`).join('\n')}
Sync Token Param: ${GOOGLE_CALENDAR_CONTEXT7_CONFIG.strict_parameters.pagination_delta}
Concurrency Field: ${GOOGLE_CALENDAR_CONTEXT7_CONFIG.strict_parameters.concurrency}
`;
  }
}
