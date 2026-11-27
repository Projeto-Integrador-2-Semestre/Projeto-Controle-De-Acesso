import { test, expect } from '@playwright/test';
import { entrar, instalarApiFalsa } from './apiFalsa.js';

let api;
test.beforeEach(async ({ page }) => {
  api = await instalarApiFalsa(page);
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  await page.goto('/monitoramento');
  await expect(page.getByText('Catraca 01 • Portaria Principal (Entrada A)')).toBeVisible();
});

const estacao = (page, nome) => page.locator('.mon__card-estacao', { hasText: nome });
const toast = (page) => page.locator('.toast-monitor');

test('estações vêm da API: totem online, totem sem contato e sem selo de dados simulados', async ({ page }) => {
  await expect(page.getByText('Dados simulados')).toHaveCount(0);

  const e1 = estacao(page, 'Catraca 01 •');
  await expect(e1).toContainText('ESTAÇÃO 100% OPERACIONAL');
  await expect(e1).toContainText('177.10.20.30');
  await expect(e1).toContainText('12 passagens hoje');
  await expect(e1).toContainText('2 rostos em cache');

  const e2 = estacao(page, 'Catraca 02 •');
  await expect(e2).toContainText('ESTAÇÃO COM ALERTA');
  await expect(e2).toContainText('OFFLINE');
  await expect(e2).toContainText('nunca consultou a API');
});

test('CT-06: ping do totem e da face_api mostram o resultado real', async ({ page }) => {
  const e1 = estacao(page, 'Catraca 01 •');
  await e1.locator('.mon__hardware').first().getByRole('button', { name: 'Ping' }).click();
  await expect(toast(page)).toContainText('Totem da Catraca 01 respondeu há 1 s.');

  await e1.locator('.mon__hardware').nth(1).getByRole('button', { name: 'Ping' }).click();
  await expect(toast(page)).toContainText('face_api respondeu em 230 ms');

  await estacao(page, 'Catraca 02 •').locator('.mon__hardware').first().getByRole('button', { name: 'Ping' }).click();
  await expect(toast(page)).toContainText('O totem da Catraca 02 nunca consultou a API.');
});

test('sincronizar atualiza a base de rostos; testar giro explica que depende do relé', async ({ page }) => {
  const e1 = estacao(page, 'Catraca 01 •');
  await e1.getByRole('button', { name: 'Sincronizar' }).click();
  await expect(toast(page)).toContainText('Base de rostos atualizada: 2 em cache, 1 novos ou alterados.');

  await e1.getByRole('button', { name: 'Testar Giro' }).click();
  await expect(toast(page)).toContainText('depende do acionamento físico da catraca (relé)');
});

test('CT-12: syslog da estação abre com os eventos da API e fecha com Escape', async ({ page }) => {
  await estacao(page, 'Catraca 01 •').getByRole('button', { name: 'Syslog da Estação' }).click();
  await expect(page.locator('.drawer__painel')).toBeVisible();
  await expect(page.locator('.drawer__painel')).toContainText('[FACIAL_MATCH] ENTRADA');
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer__painel')).toBeHidden();
});

test('CT-13: bloqueio geral pede confirmação, chama a API e pode ser desativado', async ({ page }) => {
  page.on('dialog', (dialogo) => dialogo.accept());

  await page.getByRole('button', { name: 'Bloqueio Geral de Catracas' }).last().click();
  await expect(toast(page)).toContainText('BLOQUEIO GERAL ATIVADO!');
  await expect(page.locator('.mon__rodape-esquerda')).toContainText('Bloqueio geral ATIVO');
  expect(api.bloqueioGeral.ativo).toBe(true);

  await page.getByRole('button', { name: 'Desativar Bloqueio Geral' }).click();
  await expect(toast(page)).toContainText('Bloqueio geral desativado.');
  expect(api.bloqueioGeral.ativo).toBe(false);
});
