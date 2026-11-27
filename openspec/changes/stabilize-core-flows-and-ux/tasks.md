# Tasks

## 1. Contratos Compartilhados & Schema Prisma (`packages/shared` + `backend/prisma`)

- [x] 1.1 Atualizar `packages/shared/src` (`GoogleAuthDto` suportando `code`, `codeVerifier`, `redirectUri` opcionais + `accessToken` legado/dev; adicionar `hasGoogleConnected?: boolean` nos DTOs de usuário) e verificar com `npm run build:shared`.
- [x] 1.2 Adicionar colunas aditivas nullable em `backend/prisma/schema.prisma` (`User.googleTokenExpiresAt DateTime?`, `GoogleCalendarSyncState.webhookSecret String?` e `@@index([expiration])`), gerar migration não-destrutiva e verificar `prisma generate` sem erros.

## 2. Backend — Criptografia de Tokens, Auth Google PKCE & Sessão Segura

- [x] 2.1 Criar `TokenCryptoService` (AES-256-GCM com prefixo `enc:v1:` e leitura retrocompatível) em `backend/src/common/crypto/` e adicionar testes unitários cobrindo encrypt/decrypt, texto legado e rejeição de payload adulterado.
- [x] 2.2 Atualizar `AuthService` (`googleAuth`, `refreshGoogleAccessToken`, `getProfile`, `updateProfile`) para trocar `authorizationCode` + PKCE em `https://oauth2.googleapis.com/token`, criptografar `googleAccessToken`/`googleRefreshToken` em repouso, remover `googleAccessToken` das respostas HTTP (retornando `hasGoogleConnected`) e adicionar testes unitários validando refresh automático, `invalid_grant` e zero vazamento de tokens.

## 3. Backend — WhatsApp Proativo (Template 24h) & Higiene de Segredos

- [x] 3.1 Remover o `permanentFallbackToken` hardcoded em `backend/src/modules/whatsapp/whatsapp.service.ts` (usar exclusivamente `ConfigService`), implementar `sendTemplateMessage()` com `WHATSAPP_DAILY_TEMPLATE_NAME` + fallback `type: 'text'`, e retornar `{ delivered, messageId, errorCode, errorMessage }` explícito; validar com testes unitários cobrindo template, fallback e falha da Meta.
- [x] 3.2 Atualizar `DailyBriefingService` e `NotificationsService` (`skipWhatsapp?: boolean`) para eliminar o envio duplicado no WhatsApp, propagar o status real de entrega no disparo automático e manual (`/calendar/daily-briefing/trigger`) e validar com testes unitários.

## 4. Backend — Google Calendar Auto-Sync Híbrido & Remoção de Código Morto

- [x] 4.1 Atualizar `CalendarService` e `CalendarController` para usar `AuthService.getValidGoogleAccessToken()` em todas as operações Google, corrigir URL de webhook para `/api/v1/calendar/webhook`, persistir/validar `webhookSecret` com `crypto.timingSafeEqual` (rejeitando 401/403 sem segredo válido) e registrar webhooks automaticamente ao conectar Google quando `API_PUBLIC_URL` for HTTPS.
- [x] 4.2 Adicionar job periódico (15 min) em `CalendarService` para renovação automática de canais expirando (< 24h) e sincronização incremental via `syncToken` para usuários conectados, cobrindo `update()` com sincronização `scope`/`householdId` e ownership guard; validar com testes unitários.
- [x] 4.3 Remover `backend/src/modules/calendar/context7.config.ts`, o endpoint `GET /calendar/context7-anchor` e `mobile/src/services/calendar.service.ts:getContext7Anchor()`, garantindo `npm run build:backend` verde.

## 5. Backend — Integridade de Escopo & Ownership na Lista de Compras

- [x] 5.1 Corrigir `ShoppingListService.update()` para sincronizar `householdId` ao alternar `scope` (`PRIVATE` -> `null`, `SHARED` -> `user.householdId`), validar ownership em `update`/`toggleComplete`/`delete`, emitir `SHOPPING_UPDATED` no `update()` e corrigir `importSpreadsheet()` para respeitar `scope = PRIVATE` explícito.
- [x] 5.2 Adicionar testes unitários em `ShoppingListService` provando que `PRIVATE -> SHARED` mantém visibilidade, `SHARED -> PRIVATE` remove visibilidade do parceiro, `importSpreadsheet` respeita `PRIVATE` e tentativa cross-user (IDOR) é bloqueada.

## 6. Mobile/Web — Resiliência de Sessão, Google Code Flow & Correções UX/UI

- [x] 6.1 Atualizar `mobile/src/services/api.ts`, `mobile/src/services/auth.service.ts`, `mobile/app/_layout.tsx` e `mobile/src/hooks/useAuth.ts`: aumentar timeout para 25s, só limpar tokens quando `/auth/refresh` retornar 401/403, adicionar retry controlado em `AuthGuard`, eliminar o loop de `/auth/me` na tela `/login`, e proteger `expo-notifications` com `Platform.OS !== 'web'`.
- [x] 6.2 Atualizar `mobile/src/hooks/useGoogleSignIn.ts` e `mobile/src/hooks/useGoogleCalendarAuth.ts` para usar `ResponseType.Code` + PKCE (`access_type=offline`, `prompt=consent`) quando configurado (enviando `code` + `codeVerifier` + `redirectUri` ao backend) e ler `user?.hasGoogleConnected`.
- [x] 6.3 Garantir invalidação completa de `queryKeys.shoppingList.all` ao editar item em `mobile/src/hooks/useShoppingList.ts`.
- [x] 6.4 Corrigir cortes e overflows horizontais em Mobile (390×844) nas telas `mobile/app/(tabs)/shopping-list.tsx`, `expenses.tsx`, `workouts.tsx`, `tasks.tsx` e `index.tsx` (`flexWrap`, `minWidth: 0`, scroll horizontal explícito em abas/chips, títulos legíveis) e remover `mobile/src/components/ErrorState.tsx` + os 12 arquivos `.png` temporários soltos na raiz.

## 7. Validação Interativa (Playwright MCP), Testes E2E & Verificação Final

- [x] 7.1 Atualizar `e2e/helpers/mockApi.ts` (sincronizando `scope`/`householdId` no `PUT /shopping-list/:id` e `hasGoogleConnected` nos mocks de auth) e adicionar cenários em `e2e/shopping-list.spec.ts` (`PRIVATE -> SHARED` visível) e `e2e/auth.spec.ts` (sessão preservada em erro 503 transitório).
- [x] 7.2 Validar interativamente via **MCP `playwright`** em `http://localhost:8081` (Mobile 390×844 e Desktop 1280×800, Light e Dark): 0 elementos cortados/overflow, 0 erros em `browser_console_messages`, auditoria de rede limpa (`browser_network_requests` sem `googleAccessToken` e sem loop em `/login`) e screenshots de evidência.
- [x] 7.3 Executar verificação final completa: testes unitários NestJS + `npm run build:backend` + `npm run test:e2e` (100% passando) + `npm run openspec:validate` (exit code 0).

## Workflow follow-up

- Apresentar resumo executivo com evidências e aguardar confirmação do usuário para arquivar a change com `openspec-archive-change`.
