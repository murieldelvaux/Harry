# Nexo — Assistente Mobile-First para Casal com Ingestão WhatsApp

**Nexo** é um assistente pessoal e financeiro mobile-first (iPhone-first) projetado para simplificar a vida prática e financeira de um casal que mora junto.

---

## 🎯 Proposta de Valor

1. **Entrada Natural por WhatsApp:** Envie mensagens como *"Supermercado 180 compartilhado"* ou *"Lembrar de pagar condomínio dia 10"*. O backend interpreta via IA (com fallback heurístico) e persiste no banco.
2. **Compartilhamento Seletivo:** Registros discriminados por escopo (`PRIVATE` vs `SHARED`), calculando automaticamente a divisão 50/50 da casa sem expor gastos privados.
3. **App iOS Fluido:** Desenvolvido em React Native (Expo SDK 52) com TanStack Query para sincronização de estado instantânea e cache offline.

---

## 🏗️ Estrutura do Monorepo

```
nexo/
├── packages/
│   └── shared/          # Enums, DTOs e tipos TypeScript compartilhados
├── backend/             # NestJS API + Prisma ORM + Webhook WhatsApp + AI Parser
└── mobile/              # React Native + Expo Router v4 + TanStack Query v5
```

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
- Node.js 22 LTS instalado
- PostgreSQL rodando localmente (ou instância no Supabase / Neon)
- Expo Go instalado no iPhone ou Simulador iOS

---

### 2. Configurar o Backend

```bash
cd backend
cp .env.example .env
npm install
```

Configure a URL do banco no arquivo `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nexo_db?schema=public"
JWT_SECRET="nexo-super-secret-key-2026"
GEMINI_API_KEY="sua_chave_gemini_aqui"
```

Gere as migrações e popule o banco de dados com dados de teste para o casal:
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Inicie o servidor de desenvolvimento:
```bash
npm run start:dev
```
A API estará rodando em `http://localhost:3000/api/v1`.

> 💡 **Credenciais de Teste Geradas pelo Seed:**
> - **Usuário 1 (Muriel):** `muriel@harry.app` / `123456`
> - **Usuário 2 (Parceiro):** `parceiro@harry.app` / `123456`
> - **Código de Convite do Casal:** `NEXO-2026`

---

### 3. Configurar e Rodar o App Mobile

```bash
cd ../mobile
npm install
npm run start
```

Pressione `i` no terminal para abrir no **Simulador iOS** ou escaneie o QR Code no seu iPhone físico usando a câmera.

---

## 💬 Configuração do WhatsApp Cloud API

1. Acesse o [Meta Developers Portal](https://developers.facebook.com/) e crie um app do tipo **Business**.
2. Adicione o produto **WhatsApp**.
3. Obtenha:
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_ACCESS_TOKEN` (Token permanente de sistema)
   - `WHATSAPP_APP_SECRET`
4. Exponha seu backend local para a internet usando o Cloudflare Tunnel ou Ngrok:
   ```bash
   ngrok http 3000
   ```
5. No painel da Meta, configure a URL do Webhook:
   - **Callback URL:** `https://seu-dominio.ngrok-free.app/api/v1/webhooks/whatsapp`
   - **Verify Token:** `nexo_webhook_verify_token_2026`
   - **Campos inscritos:** `messages`

---

## 🔐 Regras de Escopo (`PRIVATE` vs `SHARED`)

| Tipo de Registro | Escopo | Comportamento no App |
| :--- | :--- | :--- |
| **Gasto Compartilhado** | `SHARED` | Soma nos totais da casa, divide 50% para cada e aparece no feed de ambos. |
| **Gasto Privado** | `PRIVATE` | Soma apenas nos totais pessoais do autor e é **100% invisível** para o parceiro. |
| **Metas e Lembretes** | `SHARED` / `PRIVATE` | Visualização conjunta ou individual conforme o escopo selecionado. |

---

## 🛣️ Próximos Passos (Fase 1.5 - Apple Nativo)
- Camada nativa Swift via **Expo Config Plugin** para suporte a **Siri Shortcuts** e **App Intents** (registro via comando de voz no iPhone e Apple Watch).
- Widgets de tela de bloqueio e tela de início em SwiftUI.
