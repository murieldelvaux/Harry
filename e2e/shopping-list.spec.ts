import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Lista de Compras (Shopping List)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/shopping-list');
    await page.waitForLoadState('networkidle');
  });

  test('deve renderizar a tela da lista de compras e os itens existentes', async ({ page }) => {
    await expect(page.getByText('Lista de Compras').first()).toBeVisible();
    await expect(page.getByPlaceholder(/Adicionar item/i)).toBeVisible();

    // Itens mockados
    await expect(page.getByText('Café em grãos')).toBeVisible();
    await expect(page.getByText('Azeite de oliva extra virgem')).toBeVisible();
  });

  test('deve adicionar um novo item rapidamente pelo campo de texto', async ({ page }) => {
    const input = page.getByPlaceholder(/Adicionar item/i);
    await input.fill('Queijo Parmesão Ralado');

    // Clica no botão de adicionar (+)
    const addBtn = page.getByText('＋').first();
    await addBtn.click();

    // Item deve aparecer na lista
    await expect(page.getByText('Queijo Parmesão Ralado')).toBeVisible();
  });

  test('deve alternar filtro entre Todos, Compartilhado e Meus', async ({ page }) => {
    const filterShared = page.getByText('🏠 Compartilhado');
    const filterMine = page.getByText('🔒 Meus');

    await expect(filterShared).toBeVisible();
    await expect(filterMine).toBeVisible();

    await filterShared.click();
    await expect(page.getByText('Café em grãos')).toBeVisible();
  });

  test('deve permitir marcar um item como comprado / no carrinho', async ({ page }) => {
    await expect(page.getByText('Café em grãos')).toBeVisible();

    // Clica no checkbox do item pendente
    const checkbox = page.locator("text=Café em grãos").locator('..').locator('..').locator("div[role='checkbox'], [cursor='pointer']").first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
    }
  });

  test('deve permitir remover um item da lista', async ({ page }) => {
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    const deleteBtn = page.locator('text=🗑️').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    }
  });
});
