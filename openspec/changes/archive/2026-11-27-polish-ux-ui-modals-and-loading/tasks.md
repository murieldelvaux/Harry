# Tasks

## 1. Modais de Data (`CalendarDatePicker` & `CalendarRangePickerModal`)

- [x] 1.1 Corrigir rodapé e espaçamentos de `mobile/src/components/CalendarDatePicker.tsx` (`Limpar`, `Cancelar`, `Confirmar Data` contidos dentro do card do modal em 375px/390px) e revisar `CalendarRangePickerModal.tsx` para garantir zero overflow; verificar no Playwright MCP em Treinos, Metas e Lembretes.

## 2. Tela de Finanças (`expenses.tsx`) & Dashboard (`index.tsx`)

- [x] 2.1 Corrigir em `mobile/app/(tabs)/expenses.tsx`: padding/centralização do toggle `Meu Balanço Individual` / `Em Conjunto (Casal)`, respiro vertical do separador horizontal, layout das 3 métricas (`Total da Casa`, `Divisão 50/50`, `Privado do Par`) sem quebra no meio dos números e alinhamento/espaçamento uniforme das abas `Extrato` / `Fechar Contas` / `Análise`.
- [x] 2.2 Refinar espaçamento ícone↔texto e margens nos botões/toggles/cards de `mobile/app/(tabs)/index.tsx` e componentes compartilhados (`AppHeader.tsx`, `AppDrawer.tsx`, `ScopeBadge.tsx`, `Button.tsx`), garantindo visual uniforme em Light e Dark.

## 3. Lista de Compras (`shopping-list.tsx`)

- [x] 3.1 Corrigir largura do cabeçalho e subtítulo em `"🔥 Mais Comprados pelo Casal"` (`flex: 1, minWidth: 0`) em `mobile/app/(tabs)/shopping-list.tsx` e melhorar o espaçamento ícone↔texto nos botões e chips.

## 4. UX de Criação/Edição com Loading & Fechamento Sincronizado (Todas as Telas)

- [x] 4.1 Atualizar os hooks TanStack Query (`useGoals.ts`, `useTasks.ts`, `useExpenses.ts`, `useCalendar.ts`, `useWorkouts.ts`, `useShoppingList.ts`) para garantir sincronização do cache (`setQueryData` quando aplicável + `await queryClient.invalidateQueries(...)`) antes de resolver `mutateAsync`.
- [x] 4.2 Atualizar os modais de criação/edição em `goals.tsx`, `tasks.tsx`, `expenses.tsx`, `calendar.tsx`, `workouts.tsx` e `shopping-list.tsx` para exibir `isLoading` no botão de salvar, bloquear duplo clique e só fechar o modal após o item estar presente na lista.

## 5. Auditoria Interativa Completa em Todas as Telas (Playwright MCP) & Verificação Final

- [x] 5.1 Navegar e interagir via **MCP `playwright`** em **todas** as telas e modais do frontend (`login`, `register`, `forgot-password`, `join`, `/`, `/expenses`, `/goals`, `/tasks`, `/shopping-list`, `/calendar`, `/workouts`, `/settings`, `AppDrawer`, `NotificationCenterModal`) em Mobile `390×844` e Desktop `1280×800` (Light + Dark), corrigindo qualquer caso de ícone colado, texto espremido, contraste fraco ou overflow e validando 0 erros de console.
- [x] 5.2 Executar verificação final: `npm run test:e2e` (100% passando), `npm run test:backend` e `npm run openspec:validate` (exit code 0).

## Workflow follow-up

- Apresentar resumo executivo com evidências visuais e aguardar confirmação do usuário para arquivar a change com `openspec-archive-change`.
