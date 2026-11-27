import { test, expect } from '@playwright/test';
import { entrar, instalarApiFalsa } from './apiFalsa.js';

test.beforeEach(async ({ page }) => {
  await instalarApiFalsa(page);
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  await page.goto('/pessoas/cadastro');
  await expect(page.getByRole('heading', { name: 'Cadastrar Nova Pessoa Autorizada' })).toBeVisible();
});

const arquivo = (nome, mimeType, tamanho) => ({ name: nome, mimeType, buffer: Buffer.alloc(tamanho, 1) });

test('CT-08: máscara automática do CPF', async ({ page }) => {
  const cpf = page.getByPlaceholder('000.000.000-00');
  await cpf.pressSequentially('12345678901');
  await expect(cpf).toHaveValue('123.456.789-01');
});

test('CT-09: envio sem foto pede os campos obrigatórios', async ({ page }) => {
  await page.getByPlaceholder('Ex: Matheus Henrique de Souza Santos').fill('Fulano de Tal');
  await page.getByPlaceholder('000.000.000-00').pressSequentially('12345678901');
  await page.getByRole('button', { name: 'Salvar e Ativar Acesso' }).click();
  await expect(page.getByText('Preencha o nome, o CPF e selecione uma foto antes de salvar.')).toBeVisible();
});

test('CT-10: arquivo PNG é recusado', async ({ page }) => {
  await page.locator('input[type=file]').first().setInputFiles(arquivo('foto.png', 'image/png', 2048));
  await expect(page.getByText('Formato inválido. Envie um arquivo .jpg ou .jpeg.')).toBeVisible();
});

test('CT-11: JPEG acima de 5 MB é recusado', async ({ page }) => {
  await page.locator('input[type=file]').first().setInputFiles(arquivo('grande.jpg', 'image/jpeg', 7 * 1024 * 1024));
  await expect(page.getByText(/Arquivo muito grande\. O limite é 5MB\./)).toBeVisible();
});
