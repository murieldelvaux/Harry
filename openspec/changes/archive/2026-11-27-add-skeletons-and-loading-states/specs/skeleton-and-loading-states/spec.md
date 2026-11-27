## ADDED Requirements

### Requirement: Reusable Theme-Aware Skeleton Primitives

O aplicativo SHALL disponibilizar componentes reutilizáveis de skeleton em `mobile/src/components/Skeleton.tsx` com animação suave de pulso/shimmer compatível com iOS, Android e React Native Web, adaptados automaticamente aos temas Light e Dark sem dependências nativas externas.

#### Scenario: Skeleton animates smoothly without blocking lists or emitting web warnings

- **WHEN** um componente `SkeletonBlock` é montado em uma tela com `FlatList` ou `ScrollView` nos temas Light ou Dark
- **THEN** a animação SHALL usar `Animated.loop` + `Animated.timing` de opacidade com `isInteraction: false` e `useNativeDriver: Platform.OS !== 'web'`
- **AND** o loop de animação SHALL ser encerrado (`stop()`) ao desmontar o componente sem erros ou warnings no console do navegador

---

### Requirement: Screen-Level Skeletons Without Layout Shift or False Empty/Zero States

Todas as telas autenticadas com carregamento remoto (`/`, `/expenses`, `/goals`, `/tasks`, `/shopping-list`, `/calendar`, `/workouts`, `/settings`) e o modal `NotificationCenterModal` SHALL exibir skeletons proporcionais à estrutura real dos cards/listas enquanto seus dados estiverem carregando, mantendo o `AppHeader` visível e evitando exibir valores zerados falsos (`R$ 0,00`, `0 Pendentes`) ou `EmptyState` prematuro.

#### Scenario: Dashboard and Tasks never flash zeroed values or EmptyState while loading

- **WHEN** o usuário abre `/` (Início) ou `/tasks` (Rotina & Lembretes) e a requisição inicial está em andamento (`isLoading === true`)
- **THEN** a tela SHALL manter o `AppHeader` visível e exibir placeholders de skeleton correspondentes ao Hero Card / KPIs e aos cards de lista
- **AND** a tela SHALL NOT renderizar `R$ 0,00`, contadores zerados ou `EmptyState` antes de a consulta concluir

#### Scenario: Sub-views and secondary sections render dedicated skeletons

- **WHEN** o usuário alterna para `Fechar Contas` (`isLoadingPreview`), `Análise` (`isLoadingAnalytics`) em `/expenses`, carrega `"🔥 Mais Comprados pelo Casal"` (`isLoadingTopItems`) em `/shopping-list`, carrega agendas compartilhadas (`isLoadingSharedCalendars`) em `/calendar`, carrega membros do lar em `/settings` ou abre `NotificationCenterModal` enquanto carrega notificações
- **THEN** cada seção SHALL renderizar seu skeleton dedicado até os dados estarem prontos, sem bloquear o restante da tela

---

### Requirement: Action Loading Feedback and Double-Submit Prevention

Botões de mutação assíncrona em telas e modais (incluindo aporte em metas `+ Guardar Valor`, `+ Adicionar novamente` e `Limpar comprados` na lista de compras, `Marcar todas como lidas` em notificações e envios em telas de autenticação) SHALL exibir indicador de loading e ficar desabilitados durante a execução da requisição.

#### Scenario: Action button blocks duplicate clicks while mutation is pending

- **WHEN** o usuário aciona uma mutação assíncrona (como guardar valor em uma meta ou readicionar item frequente)
- **THEN** o botão acionado SHALL entrar em estado de loading/desabilitado até a requisição finalizar
- **AND** cliques repetidos durante o estado pendente SHALL ser ignorados

---

### Requirement: Privacy and Data Safety During Loading States

Em alinhamento com `openspec/specs/security-and-privacy/spec.md`, os estados de skeleton e loading SHALL ser puramente visuais e jamais exibir dados em cache de sessão encerrada, informações de outro usuário (`PRIVATE`) ou mensagens de erro contendo tokens/stack traces.

#### Scenario: Unauthenticated or scope-restricted state never leaks data behind skeletons

- **WHEN** um usuário alterna de escopo (`PRIVATE` ↔ `SHARED`) ou encerra sessão e faz login com outra conta
- **THEN** enquanto os novos dados do escopo/usuário autenticado carregam, apenas placeholders neutros de skeleton SHALL ser exibidos para consultas sem dados válidos do escopo atual
- **AND** nenhum registro `PRIVATE` de outro usuário SHALL ser renderizado em tela durante transições de loading
