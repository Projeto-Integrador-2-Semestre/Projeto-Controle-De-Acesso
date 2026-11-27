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

test('CT-05: atalhos Hoje/Ontem e busca filtram os registros', async ({ page }) => {
  await instalarApiFalsa(page);
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  await page.goto('/logs');

  const linhas = page.locator('tbody tr');
  await expect(linhas.filter({ hasText: 'Maria Souza' })).toHaveCount(1);
  await expect(linhas.filter({ hasText: 'Visitante de Ontem' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Ontem', exact: true }).click();
  await expect(linhas.filter({ hasText: 'Visitante de Ontem' })).toHaveCount(1);
  await expect(linhas.filter({ hasText: 'Maria Souza' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await page.getByPlaceholder('Ex: Lucas Gabriel ou 412.***.898-04').fill('Maria');
  await expect(linhas.filter({ hasText: 'Maria Souza' })).toHaveCount(1);
  await expect(linhas.filter({ hasText: 'Pessoa Antiga' })).toHaveCount(0);
});
