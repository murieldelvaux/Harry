# Proposal: Skeletons e Estados de Loading Consistentes em Todas as Telas

## Why

Atualmente o aplicativo apresenta inconsistências visíveis durante o carregamento de dados e execuções assíncronas:
- **Início (`/`)** e **Rotina & Lembretes (`/tasks`)** extraem `isLoading` mas nunca o renderizam — exibindo valores falsos (`R$ 0,00`, `0 Pendentes`) e piscando `EmptyState` antes de os dados chegarem da API.
- **Finanças (`/expenses`)**, **Metas (`/goals`)**, **Lista de Compras (`/shopping-list`)** e **Treinos (`/workouts`)** substituem a tela inteira por um `<LoadingState />` branco/vazio sem cabeçalho, causando *layout shift* (CLS) perceptível.
- Subseções assíncronas críticas ignoram seus flags de carregamento já existentes: `isLoadingPreview` (`Fechar Contas`) e `isLoadingAnalytics` (`Análise`) em `/expenses`, `isLoadingTopItems` (`Mais Comprados pelo Casal`) em `/shopping-list`, `isLoadingSharedCalendars` em `/calendar`, `isLoading` de membros do lar em `/settings` e `isLoading` em `NotificationCenterModal`.
- Ações pontuais (ex.: aporte em metas `+ Guardar Valor`, readicionar item frequente, limpar comprados, marcar notificações como lidas) precisam de feedback visual imediato de loading sem travar a interface ou permitir duplo clique.

## What Changes

1. **Componente Base Reutilizável (`Skeleton.tsx`)**:
   - Criar `mobile/src/components/Skeleton.tsx` com blocos configuráveis (`SkeletonBlock`, `SkeletonCard`, `SkeletonRow`, `SkeletonPill`) animados via `Animated.loop` + `Animated.timing` de opacidade (`useNativeDriver: Platform.OS !== 'web'`, `isInteraction: false`, com cleanup no `useEffect`), suporte nativo a Light/Dark theme e acessibilidade (`accessibilityRole="progressbar"` / `importantForAccessibility="no-hide-descendants"`).
2. **Skeletons Estruturados Tela por Tela (sem bloquear o `AppHeader`)**:
   - **Início (`/`)**: Skeleton do Hero Card de Balanço + 3 itens de Últimos Lançamentos durante `isLoading`.
   - **Finanças (`/expenses`)**: Skeleton do card de resumo + 4 linhas de extrato durante `isLoading`; skeleton dedicado nas abas `Fechar Contas` (`isLoadingPreview`) e `Análise` (`isLoadingAnalytics`).
   - **Metas (`/goals`)**: Skeleton do card `Total Guardado` + 2 cards de metas durante `isLoading` + loading no botão de aporte (`+ Guardar Valor`) e exclusão.
   - **Rotina & Lembretes (`/tasks`)**: Skeleton dos 3 KPI cards + 4 itens de lembrete durante `isLoading` (eliminando o flash de `0 Pendentes` / `EmptyState`).
   - **Lista de Compras (`/shopping-list`)**: Skeleton da lista de itens durante `isLoading` + skeleton na seção `"🔥 Mais Comprados pelo Casal"` (`isLoadingTopItems`) + loading feedback em `Limpar comprados` e `+ Adicionar novamente`.
   - **Agenda & Calendário (`/calendar`)**: Skeleton dos pills de agendas sincronizadas (`isLoadingSharedCalendars`) + 3 cards skeleton de eventos do dia (`isLoading`), substituindo o spinner solto.
   - **Treinos (`/workouts`)**: Skeleton do bloco de mês/semanas, Constância Semanal e 2 cards de treino durante `isLoading`.
   - **Configurações (`/settings`)**: Skeleton na seção de Espaço Compartilhado / Membros enquanto `useHousehold().isLoading` estiver ativo.
   - **Central de Notificações (`NotificationCenterModal`)**: Skeleton de 3 itens de notificação durante `isLoading` + indicador visual em `Marcar todas como lidas` (`isMarkingAllRead`).
   - **Telas de Auth (`login`, `register`, `forgot-password`) & `join`**: Revisar e garantir estado `isLoading` + bloqueio de duplo clique em todos os botões de submit.

## Scope

### In-Scope
- Criação de `mobile/src/components/Skeleton.tsx` (componentes primitivos e composições reutilizáveis de skeleton).
- Substituição de `<LoadingState />` bloqueante e preenchimento de lacunas de loading/skeleton em todas as 8 abas principais (`index`, `expenses`, `goals`, `tasks`, `shopping-list`, `calendar`, `workouts`, `settings`), `NotificationCenterModal` e revisão das telas `(auth)`/`(household)`.
- Validação interativa via **Playwright MCP** (simulando latência de rede e auditando Mobile `390×844` + Desktop `1280×800`, Light + Dark, 0 erros de console).
- Testes E2E (`e2e/`) garantindo que estados de skeleton aparecem durante carregamento lento e são substituídos pelos dados reais sem quebrar os 53 testes existentes.

### Out-of-Scope
- Alterações de backend, banco de dados (Prisma), contratos de API ou `packages/shared`.
- Adição de bibliotecas externas pesadas de skeleton (ex.: `react-native-skeleton-placeholder` com dependência nativa de `masked-view`/`linear-gradient` que quebram no Expo Web).

## Risks & Rollback

- **Risco**: Animação em loop no `Animated.loop` interferir em `VirtualizedList` ou gerar warning no Web se `useNativeDriver: true` for forçado no RNW sem fallback.
  - **Mitigação**: Configurar `useNativeDriver: Platform.OS !== 'web'` e `isInteraction: false` (conforme documentação oficial do React Native consultada via `context7`), com `animation.stop()` no cleanup do `useEffect`.
- **Risco**: Testes E2E falharem se `EmptyState` ou labels esperados mudarem quando a API responder rápido.
  - **Mitigação**: Skeletons são renderizados estritamente quando `isLoading === true` (ou flags específicos como `isLoadingPreview`/`isLoadingAnalytics`/`isLoadingTopItems`); assim que os dados resolvem, a árvore DOM final é idêntica à atual.
- **Rollback**: Reversão simples via `git revert` dos arquivos de UI em `mobile/src/components/Skeleton.tsx` e nas telas em `mobile/app/`.

## Privacy & Integrations Impact

- **Privacidade (`PRIVATE` vs `SHARED`)**: Nenhum dado real (privado ou compartilhado) é exibido durante o estado de skeleton; o carregamento nunca expõe valores parciais ou de outro usuário antes da resposta autenticada do backend (`openspec/specs/security-and-privacy/spec.md`).
- **Integrações Externas (Google, Garmin, Strava, MFIT, WhatsApp)**: Sem alterações em integrações ou credenciais; apenas melhoria visual dos estados de sincronização/carregamento no frontend.

## Context7 MCP Consultations

- **React Native (`/react/react-native-website`)**: Verificadas boas práticas oficiais de `Animated.loop()`, `Animated.timing()`, `useNativeDriver` e `isInteraction: false` para não bloquear `VirtualizedList` nem a JS thread.
