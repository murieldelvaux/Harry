# 🧪 Guia de Testes Automatizados E2E & Regressão Contínua (Playwright)

Este repositório conta com uma suíte completa de **Testes de Regressão End-to-End (E2E)** utilizando o **Playwright**, integrada diretamente ao **GitHub Actions** para execução automática em cada **Pull Request (Merge Request)** e merge na branch `main`.

---

## 📌 1. Cobertura da Suíte de Regressão

A suíte cobre 100% dos fluxos funcionais da aplicação Harry / Nexo, distribuídos em 9 arquivos com **41 cenários de teste automatizados**:

| Arquivo de Teste | Módulo / Funcionalidade | Cenários Cobertos |
| :--- | :--- | :--- |
| [`e2e/auth.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/auth.spec.ts) | Autenticação & Acesso | Renderização do Login, Login com sucesso, Navegação para Cadastro, Navegação para Esqueci Minha Senha com código de 6 dígitos, Proteção de rotas restritas (`/join`). |
| [`e2e/dashboard.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/dashboard.spec.ts) | Visão Geral do Lar | Boas-vindas com nome do usuário, alternância Balanço Individual vs. Casal, Ações Rápidas (+ Finanças, + Meta, + Lembrete), feed de últimos lançamentos, link Ver Todos. |
| [`e2e/expenses.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/expenses.spec.ts) | Gastos & Finanças | Extrato e cards de saldo, filtro por tipo (Gastos / Ganhos), filtro por escopo (Compartilhados / Meus Privados), cadastro de novo Gasto, cadastro de novo Ganho (Entrada), exclusão de lançamento com confirmação. |
| [`e2e/goals.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/goals.spec.ts) | Metas Financeiras | Resumo de economias e metas, barra de progresso, abertura de modal e criação de meta (valor alvo, guardado, data), exclusão de meta com diálogo de confirmação. |
| [`e2e/tasks.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/tasks.spec.ts) | Rotina & Lembretes | Contadores (Pendentes, Hoje, Concluídas), busca de lembretes, filtro de abas (Feitas / Pendentes), criação de novo lembrete com modal, alternância de status concluído, exclusão de tarefa. |
| [`e2e/shopping-list.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/shopping-list.spec.ts) | Lista de Compras | Listagem de itens pendentes e no carrinho, adição rápida via campo de texto, filtro por escopo (Compartilhado / Meus), alternância de status comprado, exclusão de item. |
| [`e2e/calendar.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/calendar.spec.ts) | Agenda & Calendário | Renderização do calendário mensal, dias da semana e status Google Agenda, navegação entre meses e botão Hoje, cadastro de novo compromisso via modal, remoção de evento. |
| [`e2e/settings.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/settings.spec.ts) | Perfil & Configurações | Dados do usuário logado, integração e salvamento do número de WhatsApp para assistente Harry, preferências de notificações matinais (06:00), alternância de tema Claro vs. Escuro. |
| [`e2e/navigation.spec.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/navigation.spec.ts) | Navegação Global & Drawer | Abertura do menu hambúrguer (☰), exibição de todas as 8 opções do drawer, navegação encadeada entre telas, fechamento pelo botão (✕), logout com confirmação e redirecionamento ao login. |

---

## 🚀 2. Como Rodar os Testes Localmente

### Pré-requisitos
Certifique-se de que as dependências e o navegador Chromium estejam instalados:
```bash
npm install
npx playwright install chromium
```

### Comandos de Execução

| Comando | Descrição |
| :--- | :--- |
| `npm run test:e2e` | Executa todos os testes E2E em modo headless (rápido). |
| `npm run test:e2e:ui` | Abre a interface interativa do Playwright com timeline, snapshots e time-travel debugging. |
| `npm run test:e2e:headed` | Roda os testes com o navegador visível em tempo real. |
| `npm run test:e2e:report` | Abre o relatório HTML completo da última execução. |

---

## 🤖 3. Pipeline no GitHub Actions

A pipeline está configurada no arquivo [`.github/workflows/e2e-regression.yml`](file:///Users/murieldaher/Desktop/mestrado/nexo/.github/workflows/e2e-regression.yml).

### Gatilhos de Disparo:
1. **Pull Requests (Merge Requests)**: Todo PR criado ou atualizado para as branches `main`, `master` ou `develop`.
2. **Push**: Diretamente na branch `main`.
3. **Workflow Dispatch**: Execução manual pelo painel do GitHub Actions.

### Passos da Pipeline:
- Checkout do código e cache de dependências Node 20 (`npm ci`).
- Instalação dos navegadores do Playwright com dependências do sistema operacional.
- Build do pacote compartilhado (`packages/shared`).
- Execução do servidor web e suíte de testes (`npm run test:e2e`).
- Upload dos relatórios HTML e capturas de tela/vídeos em caso de falha (`artifacts`).

---

## 🔄 4. Diretriz Obrigatória: Atualização Contínua dos Testes

> [!IMPORTANT]
> **SEMPRE que uma nova funcionalidade for adicionada, alterada ou refatorada no Nexo / Harry:**
> 1. **Atualizar o Mock Helper ([`e2e/helpers/mockApi.ts`](file:///Users/murieldaher/Desktop/mestrado/nexo/e2e/helpers/mockApi.ts))**: Se a nova funcionalidade adiciona novos endpoints, DTOs ou status, adicione a rota correspondente no mock stateful.
> 2. **Criar ou Atualizar a Spec E2E**:
>    - Se for um módulo novo, crie `e2e/<modulo>.spec.ts`.
>    - Se for uma melhoria ou campo novo em módulo existente, adicione o `test('deve ...')` no arquivo daquele módulo.
> 3. **Validar antes do Merge Request**:
>    ```bash
>    npm run test:e2e
>    ```
>    O MR **só deve ser aprovado** se todos os 41+ testes passarem com 0 erros.
