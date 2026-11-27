## ADDED Requirements

### Requirement: Zero Hardcoded Third-Party Credentials

O código-fonte do repositório SHALL NOT conter tokens, chaves de API ou credenciais hardcoded de serviços externos (Meta/WhatsApp, Google, Garmin, Strava, MFIT).

#### Scenario: WhatsApp service reads access token exclusively from environment

- **WHEN** o serviço de WhatsApp envia mensagens ou baixa mídias da Graph API
- **THEN** o token de acesso SHALL ser obtido exclusivamente de `ConfigService` (`WHATSAPP_ACCESS_TOKEN`), sem qualquer fallback hardcoded no código-fonte

## MODIFIED Requirements

### Requirement: External Integration Security (Google, Garmin, Strava, MFIT, WhatsApp)

Todas as integrações externas SHALL aplicar menor privilégio, proteção criptográfica de credenciais/tokens em repouso, validação de entrada/assinatura e proteção contra SSRF e vazamento de segredos.

#### Scenario: OAuth and third-party credentials protection

- **WHEN** o usuário conecta uma conta externa (Google, Strava, Garmin ou MFIT)
- **THEN** fluxos OAuth SHALL validar `state` anti-CSRF e `redirect_uri` em allowlist estrita (e PKCE quando suportado)
- **AND** `access_token`, `refresh_token` e credenciais de integração SHALL ser armazenados criptografados em repouso (AES-256-GCM)
- **AND** nenhum token ou segredo de integração (incluindo `googleAccessToken`) SHALL ser logado ou retornado em payloads HTTP ao cliente, expondo apenas indicadores booleanos de status (ex.: `hasGoogleConnected`)

#### Scenario: Webhook signature verification and idempotency

- **WHEN** o backend recebe um webhook externo (ex.: WhatsApp Cloud API ou Google Calendar Push)
- **THEN** a assinatura ou segredo de canal persistido SHALL ser validado com comparação em tempo constante (`timingSafeEqual`) antes de qualquer processamento
- **AND** eventos duplicados com o mesmo identificador externo SHALL ser tratados de forma idempotente

#### Scenario: Outbound request hardening and error sanitization

- **WHEN** o backend realiza chamadas HTTP para APIs externas ou recebe erros de terceiros
- **THEN** a requisição SHALL apontar apenas para domínios oficiais em allowlist (proteção anti-SSRF) com timeout explícito
- **AND** respostas de erro ao cliente SHALL ser sanitizadas para nunca expor stack traces, tokens, segredos ou payloads internos do banco/terceiros
