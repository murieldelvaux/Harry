## ADDED Requirements

### Requirement: Zero Horizontal Clipping on Mobile and Desktop Viewports

Todas as telas principais do aplicativo Web/Mobile (`/`, `/shopping-list`, `/expenses`, `/workouts`, `/tasks`, `/goals`, `/calendar`, `/settings`) SHALL renderizar sem cortes horizontais ou elementos estourando a largura da viewport tanto em Mobile (390×844) quanto em Desktop (1280×800), nos temas Light e Dark.

#### Scenario: Mobile viewport 390x844 has no clipped headers or filter tabs

- **WHEN** o usuário navega pelas telas `/shopping-list`, `/expenses`, `/workouts`, `/tasks` e `/` em viewport `390×844`
- **THEN** nenhum botão de ação, chip de escopo (`🏠 Compartilhada`, `👁️ Privados do Par`), aba (`✓ Feitas`) ou título de cabeçalho SHALL ultrapassar a borda direita da viewport sem container rolável explícito ou quebra de linha (`flexWrap`)
- **AND** títulos de lançamentos e itens de compra SHALL exibir espaço legível sem truncamento excessivo

#### Scenario: Clean web console without deprecated notification warnings

- **WHEN** o usuário acessa o aplicativo na plataforma Web
- **THEN** o registro de push notifications SHALL ser ignorado com guard de plataforma (`Platform.OS === 'web'`) evitando warnings desnecessários
- **AND** o console do navegador SHALL registrar 0 erros de runtime durante a navegação pelos fluxos principais

---

### Requirement: Removal of Unused Legacy Code and Root Artifacts

O repositório SHALL remover artefatos e endpoints não utilizados identificados na auditoria, mantendo apenas código ativo e referenciado.

#### Scenario: Unused legacy modules and temporary root screenshots are removed

- **WHEN** a limpeza de código morto é concluída
- **THEN** `backend/src/modules/calendar/context7.config.ts`, o endpoint `GET /calendar/context7-anchor`, `mobile/src/components/ErrorState.tsx` e os arquivos `.png` temporários soltos na raiz do repositório SHALL ter sido removidos sem quebrar builds ou testes E2E
