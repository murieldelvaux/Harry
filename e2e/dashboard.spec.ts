import { test, expect } from '@playwright/test';
import { setupMockApi, defaultMockUser } from './helpers/mockApi';

test.describe('Dashboard & Visão Geral do Lar', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('deve exibir cabeçalho com nome do usuário e boas-vindas', async ({ page }) => {
    await expect(page.getByText('Harry', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Nossa Casa|Visão Geral do Lar/i).first()).toBeVisible();
    await expect(page.getByText(`Bem-vindo(a) de volta,`)).toBeVisible();
    await expect(page.getByText(new RegExp(`${defaultMockUser.name}`, 'i'))).toBeVisible();
  });

  test('deve alternar entre Balanço Individual e Em Conjunto (Casal)', async ({ page }) => {
    const individualTab = page.getByText(/Meu Balanço \(Individual\)/i).first();
    const coupleTab = page.getByText(/Em Conjunto \(Casal\)/i).first();

    await expect(individualTab).toBeVisible();
    await expect(coupleTab).toBeVisible();

    // Clica no modo casal
    await coupleTab.click();
    await expect(page.getByText(/Balanço|Conjunto|Casal|Gastos/i).first()).toBeVisible();

    // Volta para o modo individual
    await individualTab.click();
    await expect(page.getByText(/Meu Saldo Individual/i).first()).toBeVisible();
  });

  test('deve conter as ações rápidas principais (+ Finanças, + Meta, + Lembrete)', async ({ page }) => {
    await expect(page.getByText('Ações Rápidas').first()).toBeVisible();
    await expect(page.getByText('+ Finanças').first()).toBeVisible();
    await expect(page.getByText('+ Meta').first()).toBeVisible();
    await expect(page.getByText('+ Lembrete').first()).toBeVisible();

    // Clicar em + Finanças deve abrir a tela de lançamentos
    await page.getByText('+ Finanças').first().click();
    await expect(page).toHaveURL(/\/expenses/);
  });

  test('deve listar lançamentos recentes e permitir filtrar por escopo', async ({ page }) => {
    await expect(page.getByText('Últimos Lançamentos').first()).toBeVisible();
    await expect(page.getByText('Supermercado Mensal').first()).toBeVisible();

    // Filtros de escopo
    const filterShared = page.getByText('🏠 Compartilhados').first();
    const filterPrivate = page.getByText('🔒 Pessoais').first();

    await expect(filterShared).toBeVisible();
    await expect(filterPrivate).toBeVisible();

    await filterPrivate.click();
    await expect(page.getByText('Curso Online').first()).toBeVisible();
  });

  test('deve navegar para a tela completa de despesas ao clicar em "Ver Todos ➔"', async ({ page }) => {
    const verTodosBtn = page.getByText(/Ver Todos/i).first();
    await expect(verTodosBtn).toBeVisible();
    await verTodosBtn.click();

    await expect(page).toHaveURL(/\/expenses/);
    await expect(page.getByText(/Financeiro & Extrato/i).first()).toBeVisible();
  });
});
