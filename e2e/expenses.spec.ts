import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Financeiro & Lançamentos (Expenses)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');
  });

  test('deve renderizar o extrato e os cards de resumo financeiro', async ({ page }) => {
    await expect(page.getByText('Financeiro & Extrato').first()).toBeVisible();
    await expect(page.getByText(/Meu Saldo Individual/i).first()).toBeVisible();
    await expect(page.getByText(/Meus Ganhos/i).first()).toBeVisible();
    await expect(page.getByText(/Meus Gastos Reais/i).first()).toBeVisible();
    await expect(page.getByText(/Seus Gastos Privados/i).first()).toBeVisible();
    await expect(page.getByText(/Sua Cota da Casa/i).first()).toBeVisible();
  });

  test('deve filtrar lançamentos por Tipo (Gastos / Ganhos)', async ({ page }) => {
    // Inicialmente exibe gastos e ganhos
    await expect(page.getByText('Supermercado Mensal').first()).toBeVisible();
    await expect(page.getByText('Salário Mensal').first()).toBeVisible();

    // Filtra apenas Gastos
    await page.getByText(/Gastos/i).first().click();
    await expect(page.getByText('Supermercado Mensal').first()).toBeVisible();

    // Filtra apenas Ganhos
    await page.getByText(/Ganhos/i).first().click();
    await expect(page.getByText('Salário Mensal').first()).toBeVisible();
  });

  test('deve filtrar lançamentos por Escopo (Compartilhados / Meus Privados)', async ({ page }) => {
    await page.getByText(/Compartilhados/i).first().click();
    await expect(page.getByText('Supermercado Mensal').first()).toBeVisible();

    await page.getByText(/Meus Privados/i).first().click();
    await expect(page.getByText('Curso Online').first()).toBeVisible();
  });

  test('deve abrir modal e registrar um novo Gasto com sucesso', async ({ page }) => {
    // Clica no botão de novo lançamento
    await page.locator("text=+ Novo Lançamento").or(page.locator("text=Novo Lançamento")).first().click();

    // Modal visível
    await expect(page.getByText(/Novo Gasto \(Saída\)/i).first()).toBeVisible();

    // Preenche descrição e valor
    await page.locator("input[placeholder*='Supermercado']:visible").fill('Jantar no Restaurante');
    await page.locator("input[placeholder*='0,00']:visible").fill('220.00');

    // Seleciona categoria Restaurante
    await page.getByText(/Restaurante/i).first().click();

    // Submete
    await page.getByText('Salvar Gasto').first().click();

    // Lançamento deve aparecer na lista
    await expect(page.getByText('Jantar no Restaurante').first()).toBeVisible();
  });

  test('deve abrir modal e registrar um novo Ganho (Entrada) com sucesso', async ({ page }) => {
    await page.locator("text=+ Novo Lançamento").or(page.locator("text=Novo Lançamento")).first().click();

    // Alterna para Ganho (Entrada)
    await page.getByText(/Ganho \(Entrada\)/i).first().click();
    await expect(page.getByText(/Novo Ganho \(Entrada\)/i).first()).toBeVisible();

    // O placeholder de descrição muda para 'Salário do mês'
    await page.locator("input[placeholder*='Salário']:visible").or(page.locator("input[placeholder*='Supermercado']:visible")).first().fill('Projeto Freelance');
    await page.locator("input[placeholder*='0,00']:visible").fill('1800.00');

    await page.getByText('Salvar Ganho').first().click();

    await expect(page.getByText('Projeto Freelance').first()).toBeVisible();
  });

  test('deve permitir excluir um lançamento com diálogo de confirmação', async ({ page }) => {
    await expect(page.getByText('Supermercado Mensal').first()).toBeVisible();

    // Configura o handler para aceitar o window.confirm
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Clica no botão de lixeira do primeiro item
    await page.locator('text=🗑️').first().click();

    // Item não deve mais estar visível
    await expect(page.getByText('Supermercado Mensal')).not.toBeVisible();
  });
});
