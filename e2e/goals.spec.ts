import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Metas Financeiras (Goals)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');
  });

  test('deve renderizar a tela de metas e o resumo de economias', async ({ page }) => {
    await expect(page.getByText('Metas Financeiras').first()).toBeVisible();
    await expect(page.getByText(/Economias e objetivos compartilhados/i).first()).toBeVisible();

    // Cards de resumo
    await expect(page.getByText(/Total Guardado/i).first()).toBeVisible();
    await expect(page.getByText(/Objetivo total/i).first()).toBeVisible();

    // Metas da lista inicial
    await expect(page.getByText('Viagem de Férias').first()).toBeVisible();
    await expect(page.getByText('Reserva de Emergência').first()).toBeVisible();
  });

  test('deve abrir modal e criar uma nova meta com sucesso', async ({ page }) => {
    const novaMetaBtn = page.getByText(/Nova Meta/i).first();
    await novaMetaBtn.click();

    // Modal visível
    await expect(page.getByText('Título da Meta').first()).toBeVisible();
    await expect(page.getByText('Valor Alvo').first()).toBeVisible();

    // Preenche os campos
    await page.locator("input[placeholder*='Ex: Viagem']").fill('Reforma da Cozinha');
    await page.locator("input[placeholder*='0,00']").first().fill('8000.00');
    await page.locator("input[placeholder*='0,00']").nth(1).fill('2000.00');

    // Submete
    await page.getByText('Criar Meta').first().click();

    // Deve aparecer na listagem
    await expect(page.getByText('Reforma da Cozinha').first()).toBeVisible();
  });

  test('deve excluir uma meta com confirmação', async ({ page }) => {
    await expect(page.getByText('Viagem de Férias').first()).toBeVisible();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.locator('text=🗑️').first().click();

    await expect(page.getByText('Viagem de Férias')).not.toBeVisible();
  });
});
