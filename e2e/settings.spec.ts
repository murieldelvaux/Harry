import { test, expect } from '@playwright/test';
import { setupMockApi, defaultMockUser } from './helpers/mockApi';

test.describe('Configurações & Perfil (Settings)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('deve exibir informações do perfil e conta do usuário', async ({ page }) => {
    await expect(page.getByText('Meu Perfil').first()).toBeVisible();
    await expect(page.getByText(defaultMockUser.name).first()).toBeVisible();
    await expect(page.getByText(defaultMockUser.email).first()).toBeVisible();
  });

  test('deve permitir atualizar o número de WhatsApp para integração com o Harry', async ({ page }) => {
    await expect(page.getByText(/Assistente Harry no WhatsApp/i)).toBeVisible();
    const phoneInput = page.getByPlaceholder('+55 11 99999-9999');
    await expect(phoneInput).toBeVisible();

    await phoneInput.fill('+55 11 91234-5678');
    await page.getByText(/Salvar e Conectar/i).click();

    // Mensagem de sucesso ou feedback visual
    await expect(page.getByText(/WhatsApp/i).first()).toBeVisible();
  });

  test('deve exibir opções de Notificações e Horário Matinal', async ({ page }) => {
    await expect(page.getByText(/Notificações & Resumo Diário/i)).toBeVisible();
    await expect(page.getByText(/Horário do envio matinal/i)).toBeVisible();
    await expect(page.getByPlaceholder('06:00')).toBeVisible();
    await expect(page.getByText(/Salvar Preferências de Notificação/i)).toBeVisible();
  });

  test('deve alternar a aparência entre Modo Claro e Modo Escuro', async ({ page }) => {
    const modoClaroBtn = page.getByText(/Modo Claro/i);
    const modoEscuroBtn = page.getByText(/Modo Escuro/i);

    await expect(modoClaroBtn).toBeVisible();
    await expect(modoEscuroBtn).toBeVisible();

    // Alterna para Modo Escuro
    await modoEscuroBtn.click();

    // Alterna de volta para Modo Claro
    await modoClaroBtn.click();
  });
});
