## ADDED Requirements

### Requirement: Scope and Household Synchronization on Record Updates

Ao editar o escopo (`PRIVATE` ↔ `SHARED`) de um item da Lista de Compras ou de um Evento da Agenda, o backend SHALL manter `householdId` estritamente coerente com o novo escopo, impedindo registros órfãos ou vazamento de dados privados.

#### Scenario: Moving a shopping item from PRIVATE to SHARED keeps it visible

- **WHEN** um usuário vinculado a um `householdId` edita um item da lista de compras de `PRIVATE` para `SHARED`
- **THEN** o backend SHALL atualizar `scope` para `SHARED` e definir `householdId` com o `householdId` do usuário
- **AND** o item SHALL continuar visível na aba "Todos" e aparecer imediatamente na aba "Compartilhado" (inclusive para o parceiro via evento SSE `SHOPPING_UPDATED`)

#### Scenario: Moving a shopping item from SHARED to PRIVATE detaches household

- **WHEN** um usuário edita um item da lista de compras de `SHARED` para `PRIVATE`
- **THEN** o backend SHALL atualizar `scope` para `PRIVATE` e definir `householdId` como `null`
- **AND** o item SHALL deixar de ser visível para o parceiro

#### Scenario: Importing shopping list respects explicit PRIVATE scope

- **WHEN** um usuário vinculado a um `householdId` importa uma lista/planilha selecionando explicitamente `scope = PRIVATE`
- **THEN** todos os itens importados SHALL ser criados com `scope = PRIVATE` e `householdId = null`

#### Scenario: Ownership enforcement prevents cross-user IDOR on shopping list

- **WHEN** o Usuário B tenta atualizar, alternar conclusão ou excluir um item `PRIVATE` pertencente ao Usuário A (ou um item de outro `householdId`)
- **THEN** o backend SHALL negar a operação retornando HTTP 404/403 sem alterar o registro

#### Scenario: Moving a calendar event between PRIVATE and SHARED updates householdId

- **WHEN** um usuário edita um evento de calendário alterando `scope` entre `PRIVATE` e `SHARED`
- **THEN** o backend SHALL sincronizar `householdId` (`user.householdId` para `SHARED`, `null` para `PRIVATE`) e validar ownership do evento antes de alterar
