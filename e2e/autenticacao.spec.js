import { test, expect } from '@playwright/test';
import { entrar, instalarApiFalsa } from './apiFalsa.js';

test.beforeEach(async ({ page }) => {
  await instalarApiFalsa(page);
});

test('CT-15: rota interna sem login volta para o login', async ({ page }) => {
  await page.goto('/gestao');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Acesso Administrativo' })).toBeVisible();
});

test('CT-16: login com senha errada mostra a mensagem da API', async ({ page }) => {
  await entrar(page, { senha: 'errada' });
  await expect(page.locator('.login__erro')).toHaveText('Usuário ou senha inválidos.');
  await expect(page).toHaveURL('/');
});

test('CT-01/CT-16: login válido abre a gestão e guarda o token só na aba', async ({ page }) => {
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  const sessao = await page.evaluate(() => ({
    aba: sessionStorage.getItem('token'),
    lembrar: localStorage.getItem('token'),
  }));
  expect(sessao).toEqual({ aba: 'token-e2e', lembrar: null });
});

test('"Lembrar-me" guarda o token no localStorage', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Digite seu usuário').fill('admin');
  await page.locator('input[type=password]').fill('1234');
  await page.locator('.login__lembrar input').check();
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL('/gestao');
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('token-e2e');
});

test('depois do login volta para a tela que a pessoa tentou abrir', async ({ page }) => {
  await page.goto('/logs');
  await expect(page).toHaveURL('/');
  await page.getByPlaceholder('Digite seu usuário').fill('admin');
  await page.locator('input[type=password]').fill('1234');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL('/logs');
});

test('CT-20: token inválido encerra a sessão e avisa', async ({ page }) => {
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  // Espera a gestão terminar de carregar: senão, numa máquina lenta, a primeira busca já sai com o
  // token inválido, o aviso aparece nesta página e o teste recarrega depois dele
  await expect(page.getByText('Maria Souza')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('token', 'token-vencido'));
  await page.goto('/gestao');
  await expect(page).toHaveURL('/');
  await expect(page.locator('.login__erro')).toHaveText('Sua sessão expirou. Faça login novamente.');
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
});

test('logout limpa a sessão e bloqueia as rotas internas', async ({ page }) => {
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  await page.locator('.sidebar__sair').click();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
  await page.goto('/logs');
  await expect(page).toHaveURL('/');
});
