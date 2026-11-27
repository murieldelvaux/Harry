# Proposal

## Why

O Nexo apresenta falhas recorrentes em fluxos essenciais do dia a dia que degradam a confiabilidade e a experiência mobile-first do casal: sessões caem exigindo re-login constante com o Google, o resumo diário chega no app mas falha silenciosamente no WhatsApp (janela de 24h da Meta + token hardcoded), o Google Calendar não sincroniza sozinho após a expiração de 1h do token, itens da lista de compras somem ao mudar de `PRIVATE` para `SHARED` (por `householdId` não atualizado), e múltiplas telas apresentam cortes horizontais em viewport mobile (390×844) além de código/artefatos sem uso.

## What Changes

- **Autenticação & Google OAuth (`auth-session-resilience`)**:
  - Migrar o login/conexão Google para **Authorization Code Flow + PKCE (`offline` access)** com troca server-side por `googleRefreshToken` armazenado **criptografado em repouso** (AES-256-GCM) e renovação automática de `googleAccessToken`.
  - Remover a exposição de `googleAccessToken` em texto puro nas respostas HTTP de `/auth/*` (substituindo por boolean `hasGoogleConnected`).
  - Tornar a sessão mobile/web resiliente: não limpar tokens em erros de rede/timeout/5xx durante `/auth/refresh`, aumentar timeout/retry controlado em `/auth/me` (tolerando *cold start*) e eliminar o loop de chamadas `/auth/me` na tela `/login`.
- **Notificações Diárias no WhatsApp (`whatsapp-proactive-notifications`)**:
  - Adicionar suporte a **WhatsApp Template Message (`type: 'template'`)** configurável via `WHATSAPP_DAILY_TEMPLATE_NAME` (para entrega garantida fora da janela de 24h da Meta) com fallback para `type: 'text'`.
  - Eliminar o envio duplicado no `DailyBriefingService`, retornar status explícito de entrega (`delivered: boolean`) e registrar falhas sem marcar falsamente como entregue.
  - **Segurança**: remover completamente o `permanentFallbackToken` hardcoded em `backend/src/modules/whatsapp/whatsapp.service.ts`.
- **Sincronização Automática do Google Calendar (`google-calendar-auto-sync`)**:
  - Implementar modelo híbrido: renovação automática de `googleAccessToken` via `googleRefreshToken` + registro/renovação automática de webhooks `events.watch` com **validação de segredo persistido** (corrigindo também o path `/api/v1/calendar/webhook`) + job periódico de polling incremental com `syncToken` (a cada 15 min) como fallback confiável.
- **Lista de Compras & Integridade de Escopo (`shopping-and-scope-integrity`)**:
  - Corrigir `ShoppingListService.update()` e `CalendarService.update()` para sincronizar `householdId` sempre que `scope` mudar entre `PRIVATE` (`householdId = null`) e `SHARED` (`householdId = user.householdId`).
  - Corrigir `ShoppingListService.importSpreadsheet()` para respeitar `scope = PRIVATE` explícito.
  - Adicionar validação de ownership (`userId`/`householdId`) em `update`, `toggleComplete` e `delete` da Lista de Compras (mitigação de IDOR) e emitir evento SSE `SHOPPING_UPDATED` no `update()`.
  - Garantir invalidação completa das queries TanStack Query ao editar escopo de item.
- **UX/UI Responsivo & Limpeza (`ui-ux-responsiveness-and-cleanup`)**:
  - Corrigir cortes e overflows horizontais detectados via Playwright MCP em viewport Mobile 390×844 nas telas `/shopping-list` (header `488px`), `/expenses` (chips de escopo `513px` e títulos espremidos), `/workouts` (header `476px` e chips de semana `813px`), `/tasks` (header `431px` e abas `✓ Feitas` `510px`) e `/` (títulos do feed).
  - Eliminar warnings web (`expo-notifications` guard em web, `shadow*` → `boxShadow` onde aplicável).
  - Remover artefatos e código morto: `backend/src/modules/calendar/context7.config.ts`, endpoint `GET /calendar/context7-anchor`, `calendar.service.ts:getContext7Anchor()`, `mobile/src/components/ErrorState.tsx` e as 12 imagens temporárias `.png` soltas na raiz do repositório.

## Scope & Boundaries

- **In-Scope**: Backend (`auth`, `whatsapp`, `calendar`, `shopping-list`, utilitário de criptografia de tokens, testes unitários NestJS), Frontend/Mobile (`api.ts`, `_layout.tsx`, `useAuth`, `useGoogleSignIn`, `useGoogleCalendarAuth`, telas `/`, `/shopping-list`, `/expenses`, `/workouts`, `/tasks`), `packages/shared` (DTOs), `e2e/` (`mockApi.ts` + specs) e limpeza de arquivos mortos listados acima.
- **Out-of-Scope**: Redesign completo da identidade visual, criação de novos módulos de negócio, alterações em integrações Garmin/Strava/MFIT além do que for impactado por limpeza visual na tela de treinos, e aprovações manuais externas no Google Cloud Console / Meta Business Manager (serão guiadas passo a passo ao usuário).
- **Tecnologias Consultadas no MCP `context7`**: `@nestjs/jwt`, `@tanstack/query` (v5), `@fission-ai/openspec`.
- **Impacto em Privacidade e Integrações**: Reforça `PRIVATE` vs `SHARED` (corrige órfãos e IDOR em `shopping-list` e `calendar`), criptografa tokens OAuth Google em repouso, remove segredo hardcoded do WhatsApp e adiciona autenticação no webhook do Google Calendar.
- **Riscos & Plano de Rollback**:
  - *Risco*: Migração de tokens Google existentes em texto puro para formato criptografado — mitigado com leitura retrocompatível (detecta prefixo `enc:v1:` e re-criptografa no próximo login/refresh).
  - *Risco*: Ausência temporária de `GOOGLE_CLIENT_SECRET` ou `WHATSAPP_DAILY_TEMPLATE_NAME` no ambiente — mitigado com fallback seguro e logs claros de diagnóstico.
  - *Rollback*: Mudanças de schema são estritamente aditivas (novas colunas nullable), permitindo rollback da aplicação sem perda de dados.

## Capabilities

### New Capabilities
- `auth-session-resilience`: Sessão JWT/Refresh resiliente a falhas transitórias e Google OAuth Authorization Code + PKCE com refresh server-side.
- `whatsapp-proactive-notifications`: Entrega proativa de notificações e resumos diários no WhatsApp com suporte a Template Messages (fora da janela de 24h) e rastreamento real de entrega.
- `google-calendar-auto-sync`: Sincronização automática bidirecional do Google Calendar via webhooks autenticados com renovação + polling incremental periódico.
- `shopping-and-scope-integrity`: Consistência de `scope`/`householdId`, validação de ownership e sincronização em tempo real na Lista de Compras e Agenda.
- `ui-ux-responsiveness-and-cleanup`: Layout mobile-first sem cortes horizontais (390×844 e 1280×800), console limpo na web e remoção de código/arquivos não utilizados.

### Modified Capabilities
- `security-and-privacy`: Proibição explícita de tokens hardcoded em código-fonte e eliminação de retorno de `googleAccessToken` ao frontend.

## Impact

- **Backend**: `auth`, `whatsapp`, `calendar`, `shopping-list`, `common/crypto` (novo helper AES-256-GCM), `backend/prisma/schema.prisma` (colunas aditivas nullable), testes unitários NestJS.
- **Shared**: `packages/shared/src` (DTOs de auth/google code exchange e flag `hasGoogleConnected`).
- **Mobile/Web**: `mobile/src/services/api.ts`, `mobile/app/_layout.tsx`, hooks de auth/Google/shopping-list, telas `(tabs)/shopping-list.tsx`, `expenses.tsx`, `workouts.tsx`, `tasks.tsx`, `index.tsx`.
- **E2E**: `e2e/helpers/mockApi.ts` e specs em `e2e/`.
- **Ambiente**: Novas variáveis opcionais/recomendadas: `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, `WHATSAPP_DAILY_TEMPLATE_NAME`, `API_PUBLIC_URL`.
