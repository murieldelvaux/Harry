# ux-modals-and-feedback Specification

## Purpose
Padronizar a qualidade visual e de interação de modais, seletores de data, espaçamentos ícone↔texto e estados de loading sincronizados com cache em todas as telas do aplicativo.

## Requirements

### Requirement: Date Picker Modal Containment Across All Screens

Os modais de seleção de data (`CalendarDatePicker` e `CalendarRangePickerModal`) SHALL manter todos os botões de rodapé (`Limpar`, `Cancelar`, `Confirmar Data`) estritamente contidos dentro dos limites horizontais do modal em viewports mobile (375px e 390px) e desktop (1280px).

#### Scenario: Confirm button stays inside CalendarDatePicker modal on 390px viewport

- **WHEN** o usuário abre o seletor de data na criação/edição de Treino, Meta, Lembrete, Despesa ou Evento em viewport `390×844`
- **THEN** os botões `Limpar`, `Cancelar` e `Confirmar Data` SHALL renderizar integralmente dentro da borda direita do card do modal (`button.right <= modal.right`) sem cortes nem sobreposição

---

### Requirement: Balanced Spacing, Readable Currency Values, and Aligned Tabs

Cards financeiros, abas segmentadas, botões com ícones e subtítulos SHALL manter espaçamento confortável entre ícone, texto, margens e divisores, sem quebrar valores monetários no meio dos dígitos.

#### Scenario: Currency values in couple summary never wrap mid-number

- **WHEN** o usuário visualiza o card de Balanço (Individual ou Em Conjunto) em `/expenses` na viewport `390×844`
- **THEN** nenhum valor monetário (`Total da Casa`, `Divisão 50/50`, `Privado do Par`, `Renda Conjunta`, `Despesas da Casa`) SHALL quebrar no meio de um número (ex.: `R$ 630,6` / `5`)
- **AND** o separador horizontal entre entradas/saídas e o detalhamento inferior SHALL manter respiro vertical visível sem encostar nos valores

#### Scenario: Segmented tabs and icon buttons have symmetrical padding and icon separation

- **WHEN** o usuário alterna entre `Meu Balanço Individual` / `Em Conjunto (Casal)` ou entre `Extrato` / `Fechar Contas` / `Análise`
- **THEN** o ícone SHALL manter margem confortável em relação à borda do botão e ao texto
- **AND** todas as abas da mesma barra SHALL manter altura e espaçamento consistentes sem espremer o item selecionado

#### Scenario: Top shopping items subtitle uses full available card width

- **WHEN** o usuário visualiza a seção `"🔥 Mais Comprados pelo Casal"` em `/shopping-list`
- **THEN** o subtítulo SHALL utilizar toda a largura interna do card sem ficar espremido na margem direita

---

### Requirement: Synchronized Loading State Before Closing Creation and Edit Modals

Em **todas as telas do frontend** que possuem modais de criação ou edição (Metas, Lembretes, Finanças, Agenda, Treinos e Lista de Compras), o modal SHALL exibir estado de carregamento no botão de confirmação e SHALL fechar somente após o registro atualizado estar presente na lista visível da tela.

#### Scenario: Creation or edit modal shows loading state and closes only after item is in cache

- **WHEN** o usuário confirma a criação ou edição de um registro em qualquer modal do app (Meta, Lembrete, Lançamento, Evento, Treino ou Item de Compra)
- **THEN** o botão de salvar SHALL exibir indicador de loading (`isLoading`) e bloquear cliques duplicados enquanto a requisição e a sincronização do cache estiverem em andamento
- **AND** o modal SHALL fechar somente após a lista atualizada conter o item criado/editado
