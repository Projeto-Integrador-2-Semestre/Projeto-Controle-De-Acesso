import { test, expect } from '@playwright/test';
import { entrar, instalarApiFalsa } from './apiFalsa.js';

test('CT-19: logs mostram a catraca da passagem (e o texto padrão nos antigos)', async ({ page }) => {
  await instalarApiFalsa(page);
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  await page.goto('/logs');

  const maria = page.locator('tbody tr', { hasText: 'Maria Souza' });
  await expect(maria).toContainText('Catraca 01');
  await expect(maria).toContainText('Portaria Principal (Entrada A)');

  const antiga = page.locator('tbody tr', { hasText: 'Pessoa Antiga' });
  await expect(antiga).toContainText('Totem de Reconhecimento Facial');
});
