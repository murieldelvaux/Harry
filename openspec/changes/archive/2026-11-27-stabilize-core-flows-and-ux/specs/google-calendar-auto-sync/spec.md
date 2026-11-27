## ADDED Requirements

### Requirement: Hybrid Automatic Google Calendar Synchronization

O backend SHALL manter os eventos do Google Calendar sincronizados automaticamente por meio de uma estratégia híbrida: webhooks push autenticados (`events.watch`) com renovação automática antes da expiração combinados com polling incremental periódico (`syncToken`).

#### Scenario: Automatic webhook registration upon Google connection

- **WHEN** o usuário conecta ou renova a autorização do Google Calendar e `API_PUBLIC_URL` (HTTPS) está configurado
- **THEN** o backend SHALL registrar canais `events.watch` apontando para `<API_PUBLIC_URL>/api/v1/calendar/webhook` com um segredo aleatório persistido por canal em `GoogleCalendarSyncState`

#### Scenario: Authenticated push notification triggers incremental sync

- **WHEN** o endpoint `POST /api/v1/calendar/webhook` recebe uma notificação do Google Calendar
- **THEN** o backend SHALL validar o `channelId` e o `webhookSecret` persistido usando comparação em tempo constante (`timingSafeEqual`)
- **AND** SHALL rejeitar requisições sem segredo válido com HTTP 401/403
- **AND** quando válido, SHALL executar `syncIncremental` (renovando o token Google automaticamente se expirado) e emitir evento SSE `CALENDAR_UPDATED`

#### Scenario: Periodic incremental sync fallback keeps calendars up to date

- **WHEN** o job periódico de sincronização (intervalo de 15 minutos) é executado
- **THEN** o backend SHALL sincronizar incrementalmente via `syncToken` todos os usuários com conta Google conectada
- **AND** SHALL renovar automaticamente canais `events.watch` cuja expiração esteja a menos de 24 horas
- **AND** SHALL respeitar estritamente o isolamento de `userId` e `householdId` para cada evento importado
