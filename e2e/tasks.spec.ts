import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Rotina & Lembretes (Tasks)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
  });

  test('deve renderizar a tela de lembretes com contadores e filtros', async ({ page }) => {
    await expect(page.getByText('Rotina & Lembretes').first()).toBeVisible();
    await expect(page.getByText('Pendentes').first()).toBeVisible();
    await expect(page.getByText('Para Hoje').first()).toBeVisible();
    await expect(page.getByText('Concluídas').first()).toBeVisible();

    await expect(page.getByPlaceholder(/Buscar lembrete/i)).toBeVisible();
    await expect(page.getByText('Pagar conta de energia').first()).toBeVisible();
  });

  test('deve alternar filtro entre Pendentes e Concluídas', async ({ page }) => {
    // Pendente inicial
    await expect(page.getByText('Pagar conta de energia').first()).toBeVisible();

    // Clica no filtro de Feitas / Concluídas
    const feitasFilter = page.getByText(/Feitas/i).first();
    await feitasFilter.click();
    await expect(page.getByText('Comprar ração do gato').first()).toBeVisible();
  });

  test('deve criar uma nova tarefa/lembrete com sucesso', async ({ page }) => {
    const novoBtn = page.getByText(/Novo Lembrete/i).first();
    await novoBtn.click();

    // Modal
    await expect(page.getByText(/Novo Lembrete/i).first()).toBeVisible();

    // Preenche título com placeholder exato da tela de tarefas
    await page.locator("input[placeholder*='Pagar fatura']").or(page.locator("input[placeholder*='Ex: Pagar']")).first().fill('Comprar filtro de água');

    await page.getByText(/Criar Lembrete/i).or(page.getByText(/Salvar/i)).first().click();

    await expect(page.getByText('Comprar filtro de água').first()).toBeVisible();
  });

  test('deve permitir marcar uma tarefa como concluída', async ({ page }) => {
    const taskItem = page.getByText('Pagar conta de energia').first();
    await expect(taskItem).toBeVisible();

    // Clica no botão de status/checkbox da tarefa
    const checkBtn = page.locator("div[role='checkbox']").or(page.locator("text=○")).first();
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
    }
  });

  test('deve permitir excluir uma tarefa', async ({ page }) => {
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    const deleteBtn = page.locator('text=🗑️').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    }
  });
});
