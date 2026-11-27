# Proposal

## Why

A revisão visual interativa em viewport mobile (390×844) evidenciou problemas concretos de UX/UI que comprometem a legibilidade e a sensação de polimento do app: ícones colados às bordas e aos textos em botões/abas, valores monetários quebrando no meio dos dígitos no card de balanço do casal (`R$ 630,6` / `5`), divisor horizontal encostado nos números, aba `Fechar Contas` com espaçamento desigual/espremido, subtítulo espremido em "Mais Comprados pelo Casal", botão `Confirmar Data` saindo para fora do modal `CalendarDatePicker` (afetando Treinos, Metas, Lembretes, Despesas e Agenda) e modais de criação de Meta/Lembrete fechando antes da lista atualizar sem manter o botão em estado de loading.

## What Changes

- **Espaçamento Ícone ↔ Texto & Margens de Botões/Abas**:
  - Corrigir o padding interno, alinhamento centralizado e espaçamento entre ícone e texto em botões/tabs segmentados (`Meu Balanço Individual` / `Em Conjunto (Casal)` em `expenses.tsx` e `index.tsx`, abas `Extrato` / `Fechar Contas` / `Análise`, chips de filtro e badges), eliminando ícones encostados nas bordas ou colados ao texto.
- **Card de Balanço em `expenses.tsx` (Tipografia, Divisor & 3 Colunas)**:
  - Adicionar respiro vertical (`paddingBottom` / `marginVertical`) no separador horizontal entre `Renda Conjunta`/`Despesas da Casa` (e `Meus Ganhos`/`Meus Gastos`) e o bloco inferior (`Total da Casa` / `Divisão 50/50` / `Privado do Par`).
  - Corrigir a quebra de números no meio dos dígitos (`R$ 630,6` / `5`, `R$ 315,3` / `2 cada`) ajustando o grid/tipografia (`adjustsFontSizeToFit` / `numberOfLines={1}` / layout responsivo em 2+1 ou fonte calibrada com `minWidth: 0`) para que nenhum valor monetário quebre no meio.
  - Equalizar altura, padding e alinhamento das abas `Extrato`, `Fechar Contas` e `Análise`.
- **Lista de Compras (`shopping-list.tsx`)**:
  - Corrigir o container do cabeçalho de `"🔥 Mais Comprados pelo Casal"` (`flex: 1, minWidth: 0`) para o subtítulo não ficar espremido na margem direita.
- **Modais de Seleção de Data (`CalendarDatePicker.tsx` e `CalendarRangePickerModal.tsx`)**:
  - Corrigir o rodapé (`Limpar`, `Cancelar`, `Confirmar Data`) para que todos os botões caibam confortavelmente dentro dos limites do modal em `390×844` (e `375×812`) sem jamais ultrapassar a borda direita — corrigindo de uma só vez Treinos, Metas, Lembretes, Despesas e Agenda.
- **UX de Loading e Fechamento Sincronizado em Todos os Modais de Criação/Edição (`goals`, `tasks`, `expenses`, `calendar`, `workouts`, `shopping-list`, `settings`)**:
  - Atualizar os hooks TanStack Query (`useGoals`, `useTasks`, `useExpenses`, `useCalendar`, `useWorkouts`, `useShoppingList`) para sincronizar o cache (`setQueryData` + `await queryClient.invalidateQueries(...)`) dentro do `onSuccess`.
  - Exibir estado `isLoading` explícito no botão de salvar/criar (bloqueando cliques duplicados) e **fechar o modal somente após** o novo/editado registro já estar presente na tela.
- **Auditoria & Polimento UX/UI Global (Todas as Telas do Frontend)**:
  - Navegar e interagir com **todas** as telas e modais do frontend (`login`, `register`, `forgot-password`, `join`, `/`, `/expenses`, `/goals`, `/tasks`, `/shopping-list`, `/calendar`, `/workouts`, `/settings`, `AppDrawer`, `NotificationCenterModal`, `CalendarDatePicker`, `CalendarRangePickerModal`) em Mobile `390×844` e Desktop `1280×800` (Light + Dark), padronizando espaçamento ícone↔texto, margens, divisores, contraste e zero cortes.

## Scope & Boundaries

- **In-Scope**: Componentes e telas frontend em `mobile/src/components/` (`CalendarDatePicker.tsx`, `CalendarRangePickerModal.tsx`, `Button.tsx`, etc.), `mobile/src/hooks/` (`useGoals.ts`, `useTasks.ts`), `mobile/app/(tabs)/` (`expenses.tsx`, `index.tsx`, `shopping-list.tsx`, `goals.tsx`, `tasks.tsx`, `workouts.tsx`, `calendar.tsx`, `settings.tsx`) e validação E2E (`e2e/`).
- **Out-of-Scope**: Alterações em schema Prisma, endpoints backend ou integrações externas (Google, Garmin, Strava, MFIT, WhatsApp).
- **Tecnologias Consultadas no MCP `context7`**: `@tanstack/query` (padrão `return/await queryClient.invalidateQueries` em `useMutation.onSuccess` para manter `isPending` até a lista atualizar).
- **Impacto em Privacidade e Integrações**: Zero impacto em regras `PRIVATE`/`SHARED` ou integrações externas; preserva 100% os contratos de API e `testID`s existentes.
- **Riscos & Plano de Rollback**: Mudanças puramente de UI/UX e estado de mutação no frontend; rollback trivial via reversão dos arquivos de `mobile/`.

## Capabilities

### New Capabilities
- `ux-modals-and-feedback`: Layout responsivo sem quebras em modais de data (`CalendarDatePicker`/`CalendarRangePickerModal`), cards financeiros, abas segmentadas, espaçamento consistente ícone↔texto e feedback de loading com fechamento sincronizado em criação de Metas e Lembretes.

### Modified Capabilities
<!-- Nenhuma spec existente alterada -->

## Impact

- **Mobile/Web**: `CalendarDatePicker.tsx`, `CalendarRangePickerModal.tsx`, `useGoals.ts`, `useTasks.ts`, `expenses.tsx`, `index.tsx`, `shopping-list.tsx`, `goals.tsx`, `tasks.tsx`, `workouts.tsx`.
- **E2E**: Validação completa dos 53+ cenários em `npm run test:e2e` + novos cenários para `CalendarDatePicker` sem overflow e loading/visibilidade imediata em Metas e Lembretes.
