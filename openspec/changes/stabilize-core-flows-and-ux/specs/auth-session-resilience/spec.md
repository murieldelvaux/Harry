## ADDED Requirements

### Requirement: Resilient Client Session Persistence

O cliente mobile/web SHALL preservar a sessão autenticada durante falhas transitórias de rede, timeouts ou *cold starts* do backend, descartando tokens locais exclusivamente quando o servidor rejeitar explicitamente a renovação com erro de autenticação (401/403).

#### Scenario: Transient network error or backend cold start during session check

- **WHEN** o aplicativo inicia com `accessToken` ou `refreshToken` salvos e `/auth/me` ou `/auth/refresh` falha por timeout, erro de rede ou HTTP 5xx
- **THEN** o cliente SHALL NOT apagar os tokens armazenados localmente
- **AND** o cliente SHALL aplicar retry controlado antes de considerar a sessão indisponível

#### Scenario: Explicit refresh token rejection

- **WHEN** `/auth/refresh` retorna HTTP 401 ou 403 indicando refresh token inválido, expirado ou revogado
- **THEN** o cliente SHALL limpar os tokens locais e redirecionar o usuário para `/(auth)/login`

#### Scenario: No background polling loop on login screen

- **WHEN** o usuário está na rota `/(auth)/login` sem sessão ativa
- **THEN** o cliente SHALL NOT disparar chamadas repetidas a `/auth/me`, `/notifications` ou `/expenses`

---

### Requirement: Google OAuth Authorization Code Flow with Server-Side Token Refresh

O login e a vinculação com o Google SHALL utilizar Authorization Code Flow com PKCE (`access_type=offline`) para obter `googleRefreshToken` no backend, renovando o `googleAccessToken` automaticamente sem exigir novo login do usuário a cada hora.

#### Scenario: Successful Google sign-in persists encrypted refresh token

- **WHEN** o usuário conclui o fluxo OAuth do Google e envia o `authorizationCode` (e `codeVerifier`/`redirectUri`) ao backend
- **THEN** o backend SHALL trocar o código no endpoint oficial `https://oauth2.googleapis.com/token`
- **AND** SHALL armazenar `googleAccessToken`, `googleRefreshToken` e `googleTokenExpiresAt` criptografados em repouso no banco
- **AND** SHALL retornar `hasGoogleConnected: true` sem expor o valor de `googleAccessToken` ao cliente

#### Scenario: Automatic refresh of expired Google access token

- **WHEN** um serviço interno (ex.: Google Calendar) necessita chamar a API do Google e o `googleAccessToken` está expirado ou a menos de 5 minutos de expirar
- **THEN** o backend SHALL renovar o token automaticamente usando o `googleRefreshToken` descriptografado em memória
- **AND** SHALL atualizar o novo `googleAccessToken` criptografado e `googleTokenExpiresAt` no banco sem interromper o usuário

#### Scenario: Revoked Google refresh token handled safely

- **WHEN** o Google rejeita a renovação com `invalid_grant`
- **THEN** o backend SHALL limpar os tokens Google armazenados do usuário e sinalizar `needsReconnect: true` sem derrubar a sessão JWT principal do Nexo
