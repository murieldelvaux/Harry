## ADDED Requirements

### Requirement: Proactive WhatsApp Daily Briefing Delivery Outside 24h Window

O envio proativo do resumo diário e periódico pelo WhatsApp SHALL suportar Template Messages (`type: 'template'`) da Meta WhatsApp Cloud API para garantir entrega mesmo fora da janela de 24 horas da última mensagem do usuário, com fallback controlado para mensagem de texto livre (`type: 'text'`).

#### Scenario: Daily briefing sent using approved template outside 24h window

- **WHEN** chega o horário configurado do resumo diário para um usuário com `phoneNumber` válido e `WHATSAPP_DAILY_TEMPLATE_NAME` configurado
- **THEN** o backend SHALL enviar a notificação via WhatsApp Cloud API utilizando `type: 'template'` com os 4 parâmetros do resumo (`firstName`, `eventsSummary`, `tasksSummary`, `shoppingSummary`)
- **AND** SHALL sanitizar cada parâmetro removendo quebras de linha (`\n`), tabs (`\t`) e sequências com mais de 4 espaços consecutivos (prevenindo o erro `#132018` da Meta) e respeitando o limite de tamanho da API
- **AND** SHALL registrar o `messageId` retornado pela Meta como confirmação de entrega

#### Scenario: Fallback to free-form text when template is not configured

- **WHEN** `WHATSAPP_DAILY_TEMPLATE_NAME` não está configurado no ambiente
- **THEN** o backend SHALL tentar o envio via `type: 'text'` e registrar explicitamente no log caso a Meta rejeite por janela de 24h (ex.: erro `#131047`)

---

### Requirement: Single Non-Duplicated Delivery and Honest Delivery Tracking

O serviço de resumo diário SHALL enviar no máximo uma mensagem WhatsApp por disparo e SHALL propagar o resultado real de entrega (`delivered: boolean`), evitando marcar sucesso falso quando a entrega falhar.

#### Scenario: Daily briefing does not duplicate WhatsApp dispatch

- **WHEN** o resumo diário é disparado para um usuário com notificações in-app e WhatsApp habilitadas
- **THEN** o backend SHALL enviar o resumo completo no WhatsApp uma única vez e criar a notificação In-App/Push sem reenviar uma segunda mensagem WhatsApp duplicada

#### Scenario: WhatsApp delivery failure is observable

- **WHEN** todas as tentativas de envio na Meta WhatsApp Cloud API falham
- **THEN** o serviço de WhatsApp SHALL retornar `{ delivered: false, errorCode, errorMessage }` sem mascarar o erro como sucesso
- **AND** o disparo manual (`POST /calendar/daily-briefing/trigger`) SHALL reportar `whatsappSent: false` com o motivo sanitizado da falha
