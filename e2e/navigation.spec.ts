import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Navegação Global & Drawer Menu', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('deve abrir o menu lateral (Drawer) e exibir todas as opções de navegação', async ({ page }) => {
    // Clica no botão hamburger ativo (último montado na stack)
    await page.getByText('☰').last().click();

    // Menu lateral aberto
    await expect(page.getByText('NAVEGAÇÃO PRINCIPAL').first()).toBeVisible();
    await expect(page.getByText('Perfil e Configurações').first()).toBeVisible();
    await expect(page.getByText('Início & Resumo').first()).toBeVisible();
    await expect(page.getByText('Gastos & Finanças').first()).toBeVisible();
    await expect(page.getByText('Metas Financeiras').first()).toBeVisible();
    await expect(page.getByText('Rotina & Lembretes').first()).toBeVisible();
    await expect(page.getByText('Lista de Compras').first()).toBeVisible();
    await expect(page.getByText('Agenda & Calendário').first()).toBeVisible();
    await expect(page.locator('text=/^Sair da Conta$/').first()).toBeVisible();
  });

  test('deve navegar entre as telas através do menu lateral', async ({ page }) => {
    // Abre menu a partir da tela inicial
    await page.getByText('☰').last().click();
    await expect(page.getByText('NAVEGAÇÃO PRINCIPAL').first()).toBeVisible();

    // Clica em Metas Financeiras
    await page.getByText('Metas Financeiras').first().click();
    await expect(page).toHaveURL(/\/goals/);
    await expect(page.getByText(/Economias e objetivos compartilhados/i).first()).toBeVisible();

    // Abre menu novamente a partir de Metas
    await page.getByText('☰').last().click();
    await expect(page.getByText('NAVEGAÇÃO PRINCIPAL').first()).toBeVisible();

    // Clica em Lista de Compras
    await page.getByText('Lista de Compras').first().click();
    await expect(page).toHaveURL(/\/shopping-list/);

    // Abre menu novamente e clica em Início & Resumo
    await page.getByText('☰').last().click();
    await expect(page.getByText('NAVEGAÇÃO PRINCIPAL').first()).toBeVisible();
    await page.getByText('Início & Resumo').first().click();
    await expect(page).toHaveURL(/\/(tabs)?$/);
  });

  test('deve fechar o menu lateral ao clicar no botão de fechar (✕)', async ({ page }) => {
    await page.getByText('☰').last().click();
    await expect(page.getByText('NAVEGAÇÃO PRINCIPAL').first()).toBeVisible();

    const closeBtn = page.getByText('✕').first();
    await closeBtn.click();

    // Menu fechado
    await expect(page.getByText('NAVEGAÇÃO PRINCIPAL')).not.toBeVisible();
  });

  test('deve realizar logout com confirmação e redirecionar para a tela de login', async ({ page }) => {
    await page.getByText('☰').last().click();
    await expect(page.getByText('NAVEGAÇÃO PRINCIPAL').first()).toBeVisible();

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.locator('text=/^Sair da Conta$/').first().click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Entrar na sua conta').first()).toBeVisible();
  });
});
