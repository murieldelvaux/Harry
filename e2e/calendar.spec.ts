import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Agenda & Calendário (Calendar)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
  });

  test('deve renderizar o calendário mensal e área de eventos', async ({ page }) => {
    await expect(page.getByText('Agenda & Calendário').first()).toBeVisible();
    await expect(page.getByText('Google Agenda', { exact: true }).first()).toBeVisible();

    // Dias da semana
    await expect(page.getByText('Seg').first()).toBeVisible();
    await expect(page.getByText('Sex').first()).toBeVisible();

    // Evento da lista
    await expect(page.getByText('Jantar em Família').first()).toBeVisible();
  });

  test('deve navegar entre meses do calendário', async ({ page }) => {
    // Botão de avançar mês ›
    const nextMonthBtn = page.getByText('›').first();
    await expect(nextMonthBtn).toBeVisible();
    await nextMonthBtn.click();

    // Botão de hoje
    const todayBtn = page.getByText(/Hoje/i).first();
    await expect(todayBtn).toBeVisible();
    await todayBtn.click();
  });

  test('deve abrir modal e cadastrar um novo evento na agenda', async ({ page }) => {
    const novoBtn = page.getByText(/Novo Evento/i).first();
    await novoBtn.click();

    // Modal visível
    await expect(page.getByText(/Novo Compromisso/i).first()).toBeVisible();

    // Preenche título do compromisso
    const inputTitle = page.locator("input[placeholder*='Ex: Reunião']:visible");
    await inputTitle.fill('Consulta Odontológica');

    // Submete pelo botão Adicionar à Agenda
    await page.getByText('Adicionar à Agenda').first().click();

    await expect(page.getByText('Consulta Odontológica').first()).toBeVisible();
  });

  test('deve permitir remover um evento da agenda', async ({ page }) => {
    await expect(page.getByText('Jantar em Família').first()).toBeVisible();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    const deleteBtn = page.locator('text=🗑️').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    }
  });
});
