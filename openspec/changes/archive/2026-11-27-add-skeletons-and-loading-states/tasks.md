# Tasks

## 1. Componente Base de Skeleton (`mobile/src/components/Skeleton.tsx`)

- [x] 1.1 Criar `mobile/src/components/Skeleton.tsx` com `SkeletonBlock`, `SkeletonCard`, `SkeletonRow` e `SkeletonPill` usando `Animated.loop` + `Animated.timing` (`isInteraction: false`, `useNativeDriver: Platform.OS !== 'web'`, cleanup `stop()` no `useEffect`), suporte automático a Light/Dark via `ThemeContext` e `testID` configurável.

## 2. Telas Principais (Dashboard, Finanças, Metas e Lembretes)

- [x] 2.1 `mobile/app/(tabs)/index.tsx`: usar `isLoading` de `useExpenses` para renderizar skeleton do Hero Card de Balanço e 3 skeletons de Últimos Lançamentos (eliminando exibição de `R$ 0,00` antes do carregamento).
- [x] 2.2 `mobile/app/(tabs)/expenses.tsx`: substituir `<LoadingState />` bloqueante por skeletons de resumo + lista mantendo `AppHeader` visível, e renderizar skeletons dedicados nas abas `Fechar Contas` (`isLoadingPreview`) e `Análise` (`isLoadingAnalytics`).
- [x] 2.3 `mobile/app/(tabs)/goals.tsx`: substituir `<LoadingState />` bloqueante por skeleton do card `Total Guardado` + 2 cards de metas mantendo `AppHeader` visível, e adicionar `isLoading` no botão de aporte (`+ Guardar Valor`) e confirmação de contribuição.
- [x] 2.4 `mobile/app/(tabs)/tasks.tsx`: usar `isLoading` de `useTasks` para renderizar skeletons nos 3 KPI cards e 4 cards de lembrete (eliminando flash de `0 Pendentes` e `EmptyState` prematuro).

## 3. Lista de Compras, Agenda, Treinos, Configurações, Notificações e Auth

- [x] 3.1 `mobile/app/(tabs)/shopping-list.tsx`: substituir `<LoadingState />` bloqueante por skeleton de lista mantendo `AppHeader` e input rápido visíveis, renderizar skeleton em `"🔥 Mais Comprados pelo Casal"` (`isLoadingTopItems`) e adicionar loading em `Limpar comprados` (`isClearing`) e `+ Adicionar novamente` (por item).
- [x] 3.2 `mobile/app/(tabs)/calendar.tsx`: adicionar skeleton nos pills de agendas sincronizadas (`isLoadingSharedCalendars`) e substituir `<ActivityIndicator />` solto da lista de eventos por 3 cards skeleton durante `isLoading`.
- [x] 3.3 `mobile/app/(tabs)/workouts.tsx`: substituir `<LoadingState />` bloqueante por skeletons do card de mês/semanas, Constância Semanal e 2 cards de treino mantendo `AppHeader` visível.
- [x] 3.4 `mobile/app/(tabs)/settings.tsx`, `mobile/src/components/NotificationCenterModal.tsx` e telas `(auth)/*` / `(household)/join.tsx`: adicionar skeleton na seção de membros do lar (`useHousehold().isLoading`), skeleton na lista do `NotificationCenterModal` (`isLoading`) + feedback em `isMarkingAllRead`, e confirmar `isLoading`/`disabled` em todos os botões de submit.

## 4. Validação Interativa (Playwright MCP), E2E e Verificação Final

- [x] 4.1 Validar interativamente via **MCP `playwright`** em Mobile (`390×844`) e Desktop (`1280×800`), temas Light e Dark, verificando skeletons, 0 erros de console e ausência de layout shift/overflow.
- [x] 4.2 Atualizar `e2e/helpers/mockApi.ts` / `e2e/*.spec.ts` com teste de regressão de skeleton em carregamento lento e executar verificação final (`npm run test:e2e`, `npm run test:backend`, `npm run openspec:validate`).
