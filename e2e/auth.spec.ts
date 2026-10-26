import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mockApi';

test.describe('Autenticação & Controle de Acesso', () => {
  test('deve renderizar a tela de login com todos os elementos essenciais', async ({ page }) => {
    await setupMockApi(page, { user: null });
    await page.goto('/login');

    // Título e subtítulo
    await expect(page.getByText('Harry', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Finanças e rotina compartilhadas/i).first()).toBeVisible();
    await expect(page.getByText('Entrar na sua conta').first()).toBeVisible();

    // Campos de input visíveis
    await expect(page.locator("input[placeholder='seu@email.com']:visible")).toBeVisible();
    await expect(page.locator("input[placeholder='Sua senha']:visible")).toBeVisible();

    // Botões
    await expect(page.getByText('Continuar com o Google').first()).toBeVisible();
    await expect(page.getByText(/Entrar no Harry/i).first()).toBeVisible();
    await expect(page.getByText(/Criar nova conta/i).first()).toBeVisible();
    await expect(page.getByText(/Esqueceu sua senha\?/i).first()).toBeVisible();
  });

  test('deve permitir preencher credenciais e logar com sucesso', async ({ page }) => {
    await setupMockApi(page, { user: null });
    await page.goto('/login');

    await page.locator("input[placeholder='seu@email.com']:visible").fill('muriel@harry.app');
    await page.locator("input[placeholder='Sua senha']:visible").fill('123456');

    await page.getByText(/Entrar no Harry/i).first().click();

    // Deve redirecionar para a página inicial
    await expect(page).toHaveURL(/\/(tabs)?$/);
    await expect(page.getByText(/Nossa Casa|Visão Geral do Lar|Harry/i).first()).toBeVisible();
  });

  test('deve navegar para a tela de cadastro e exibir formulário completo', async ({ page }) => {
    await setupMockApi(page, { user: null });
    await page.goto('/login');

    await page.getByText(/Criar nova conta/i).first().click();
    await expect(page).toHaveURL(/\/register/);

    await expect(page.getByText(/Criar sua conta/i).first()).toBeVisible();
    await expect(page.locator("input[placeholder*='Ex: Muriel']:visible")).toBeVisible();
    await expect(page.locator("input[placeholder='seu@email.com']:visible")).toBeVisible();
    await expect(page.locator("input[placeholder*='Crie uma senha segura']:visible")).toBeVisible();
    await expect(page.getByText(/Criar conta e continuar/i).first()).toBeVisible();
  });

  test('deve navegar para a tela de recuperação de senha e enviar código', async ({ page }) => {
    await setupMockApi(page, { user: null });
    await page.goto('/login');

    await page.getByText(/Esqueceu sua senha\?/i).first().click();
    await expect(page).toHaveURL(/\/forgot-password/);

    // Texto descritivo exclusivo da tela de recuperação de senha
    await expect(page.getByText(/Sem problemas! Digite seu e-mail/i).first()).toBeVisible();
    const emailInput = page.locator("input[placeholder='seu@email.com']:visible");
    await expect(emailInput).toBeVisible();

    await emailInput.fill('muriel@harry.app');
    await page.getByText(/Enviar Código/i).first().click();

    // Deve exibir tela de verificação do código de 6 dígitos
    await expect(page.getByText(/Código de 6 dígitos/i).first()).toBeVisible({ timeout: 7000 });
  });

  test('deve proteger rotas restritas e redirecionar usuário deslogado para o login', async ({ page }) => {
    await setupMockApi(page, { user: null });
    await page.goto('/join');

    // Usuário não autenticado deve cair no login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Entrar na sua conta').first()).toBeVisible();
  });
});
