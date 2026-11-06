import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Backlog Casal v2 — Notificações, Fechamento 50/50, Compras & Treinos (Tasks 1 a 11)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('Task 1 & 2: deve exibir badge na Central de Notificações In-App e marcar todas como lidas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verifica que o refreshToken está persistido no storage (Task 1)
    const refreshToken = await page.evaluate(() => localStorage.getItem('harry_refresh_token'));
    expect(refreshToken).toBeTruthy();

    // Abre a Central de Notificações (Task 2)
    await page.getByTestId('notification-bell').first().click();
    await expect(page.getByText(/Central de Notificações/i).first()).toBeVisible();
    await expect(page.getByText(/Nova despesa compartilhada/i).first()).toBeVisible();

    // Marca todas como lidas
    await page.getByTestId('mark-all-notifications-read').click();
    await page.getByTestId('close-notification-center').click();
  });

  test('Task 3 & 9: deve selecionar quem pagou (PartnerSelect) e data via CalendarDatePicker ao lançar despesa compartilhada', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-expense-fab').click();
    await expect(page.getByText(/Quem pagou esta conta compartilhada/i).first()).toBeVisible();

    // Abre CalendarDatePicker e confirma data (Task 9)
    await page.getByTestId('expense-create-date-picker').click();
    await expect(page.getByText(/Confirmar Data/i).first()).toBeVisible();
    await page.getByTestId('expense-create-date-picker-confirm').click();

    // Seleciona o parceiro Lucas como pagador (Task 3)
    await page.getByTestId('expense-payer-select-option-user-lucas-456').click();

    await page.locator("input[placeholder*='Supermercado']:visible").fill('Feira Orgânica Semanal');
    await page.locator("input[placeholder*='0,00']:visible").fill('18000');
    await page.getByLabel('Salvar Gasto').click();

    await expect(page.getByText('Feira Orgânica Semanal').first()).toBeVisible();
  });

  test('Task 4 & 5: deve calcular encontro de contas líquido 50/50, fechar ciclo e marcar como liquidado', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // Navega para a aba Fechar Contas
    await page.getByTestId('expenses-tab-closing').click();
    await expect(page.getByText(/Encontro de Contas do Período/i).first()).toBeVisible();
    await expect(page.getByTestId('settlement-transfer-card')).toContainText(/Lucas deve transferir R\$[\s\u00A0]*150,00 para Muriel/i);

    // Registra o fechamento (Task 4)
    await page.getByTestId('close-accounts-btn').click();
    await expect(page.getByText(/AGUARDANDO PAGAMENTO/i).first()).toBeVisible();

    // Marca como Pago/Liquidado (Task 5)
    await page.getByTestId('settle-closing-btn').first().click();
    await expect(page.getByText(/LIQUIDADO \/ PAGO/i).first()).toBeVisible();
  });

  test('Task 6: deve exibir dashboard analítico de gastos com categorias, evolução e top ofensores', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('expenses-tab-analytics').click();
    await expect(page.getByText(/Comparativo & Evolução do Orçamento/i).first()).toBeVisible();
    await expect(page.getByText(/Gastos por Categoria/i).first()).toBeVisible();
    await expect(page.getByText(/Evolução Temporal \(Últimos 6 Meses\)/i).first()).toBeVisible();
    await expect(page.getByText(/Principais Ofensores do Orçamento/i).first()).toBeVisible();
  });

  test('Task 7: deve permitir configurar horário exato do resumo diário e resumo estendido semanal/quinzenal', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('daily-summary-time-input').fill('07:30');
    await page.getByTestId('digest-freq-biweekly').click();
    await page.getByTestId('digest-day-0').click();
    await page.getByTestId('digest-time-input').fill('08:45');

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.getByTestId('save-notification-settings-btn').click();
  });

  test('Task 10: deve exibir ranking de itens mais comprados na lista de compras e permitir readicionar em 1 toque', async ({ page }) => {
    await page.goto('/shopping-list');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('shopping-top-items-section')).toBeVisible();
    await expect(page.getByText(/Mais Comprados pelo Casal/i).first()).toBeVisible();
    await expect(page.getByText('Café em grãos').first()).toBeVisible();

    await page.getByTestId('readd-shopping-item-cafe-em-grao').click();
  });

  test('Task 11: deve exibir calendário mensal/semanal de treinos, corridas planejadas e concluídas do Garmin e OAuth2 do Strava', async ({ page }) => {
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('workout-calendar-card')).toBeVisible();
    await expect(page.getByTestId('weekly-calendar-strip')).toBeVisible();
    await expect(page.getByText(/Garmin Connect \(Corridas da Semana\)/i).first()).toBeVisible();
    await expect(page.getByText(/Strava \(Corrida & Musculação\)/i).first()).toBeVisible();
    await expect(page.getByTestId('connect-strava-oauth-btn')).toBeVisible();

    // Verifica corrida planejada da semana com detalhes e descrição (Notes)
    await expect(page.getByText(/Tiros de Velocidade 5x 800m VO2Max/i).first()).toBeVisible();
    await expect(page.getByText(/Descrição do Treino \(Notes\)/i).first()).toBeVisible();
    await expect(page.getByText(/Planejado na planilha da semana/i).first()).toBeVisible();

    // Simula retorno do callback OAuth2 do Strava (?code=dev_oauth_code)
    await page.goto('/workouts?code=dev_oauth_code');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('sync-strava-btn')).toBeVisible();

    // Envia incentivo ao parceiro
    await page.getByTestId('cheer-workout-btn').first().click();
  });
});
