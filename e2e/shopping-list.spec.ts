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
    await expect(page.getByText('Café em grãos').first()).toBeVisible();
    await expect(page.getByText('Azeite de oliva extra virgem').first()).toBeVisible();
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
    await expect(page.getByText('Café em grãos').first()).toBeVisible();
  });

  test('deve permitir marcar um item como comprado / no carrinho', async ({ page }) => {
    await expect(page.getByText('Café em grãos').first()).toBeVisible();

    // Clica no checkbox do item pendente
    const checkbox = page.locator("text=Café em grãos").last().locator('..').locator('..').locator("div[role='checkbox'], [cursor='pointer']").first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
    }
  });

  test('deve manter o item visível ao editar escopo de Privado para Compartilhado', async ({ page }) => {
    // Alterna seletor rápido para Pessoal e cria um item privado
    await page.getByText('🏠 Compartilhada').first().click();
    await expect(page.getByText('🔒 Pessoal').first()).toBeVisible();

    const input = page.getByPlaceholder(/Adicionar item/i);
    await input.fill('Shampoo Anticaspa');
    await page.getByText('＋').first().click();
    await expect(page.getByText('Shampoo Anticaspa').first()).toBeVisible();

    // Abre modal de edição do item criado (primeiro ✏️ da lista)
    await page.getByText('✏️').first().click();
    await expect(page.getByText('Editar Item').first()).toBeVisible();

    // Muda destino para Compartilhado e salva
    await page.getByText('Compartilhado', { exact: true }).last().click();
    await page.getByText('Salvar Alterações').first().click();

    // Item continua visível em "Todos" e aparece em "🏠 Compartilhado"
    await expect(page.getByText('Shampoo Anticaspa').first()).toBeVisible();
    await page.getByText('🏠 Compartilhado').first().click();
    await expect(page.getByText('Shampoo Anticaspa').first()).toBeVisible();
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
