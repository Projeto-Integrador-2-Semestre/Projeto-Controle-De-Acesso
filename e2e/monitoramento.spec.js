import { test, expect } from '@playwright/test';
import { entrar, instalarApiFalsa } from './apiFalsa.js';

test.beforeEach(async ({ page }) => {
  await instalarApiFalsa(page);
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  await page.goto('/monitoramento');
});

test('a tela avisa que os dados são simulados', async ({ page }) => {
  await expect(page.getByText('Dados simulados')).toBeVisible();
});

test('CT-12: syslog da estação abre no painel lateral e fecha com Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Syslog da Estação' }).first().click();
  await expect(page.locator('.drawer__painel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer__painel')).toBeHidden();
});

test('CT-13: bloqueio geral pede confirmação e mostra o aviso', async ({ page }) => {
  page.once('dialog', (dialogo) => dialogo.accept());
  await page.getByRole('button', { name: 'Bloqueio Geral de Catracas' }).click();
  await expect(page.getByText('BLOQUEIO GERAL ATIVADO! Todas as catracas foram travadas.')).toBeVisible();
});
