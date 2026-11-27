import { test, expect } from '@playwright/test';
import { entrar, instalarApiFalsa } from './apiFalsa.js';

let api;
test.beforeEach(async ({ page }) => {
  api = await instalarApiFalsa(page);
  await entrar(page);
  await expect(page.getByText('Maria Souza')).toBeVisible();
});

const linha = (page, nome) => page.locator('tbody tr', { hasText: nome });

test('listagem mostra status, motivo e data de cadastro vindos da API', async ({ page }) => {
  await expect(linha(page, 'Maria Souza')).toContainText('Liberado');
  await expect(linha(page, 'Maria Souza')).toContainText(/\d{2}\/\d{2}\/2026/);
  await expect(linha(page, 'Pessoa Antiga')).toContainText('Bloqueado');
  await expect(linha(page, 'Pessoa Antiga')).toContainText('Documentação Pendente');
  // Cadastro antigo, sem data na API
  await expect(linha(page, 'Pessoa Antiga')).toContainText('—');
});

test('CT-04/CT-17: bloqueio com motivo e liberação chamam a API', async ({ page }) => {
  await linha(page, 'Maria Souza').getByRole('button', { name: 'Bloquear acesso de Maria Souza' }).click();
  await page.getByPlaceholder('Bloqueio administrativo').fill('Matrícula trancada');
  await page.getByRole('dialog').getByRole('button', { name: 'Bloquear acesso' }).click();

  await expect(linha(page, 'Maria Souza')).toContainText('Bloqueado');
  await expect(linha(page, 'Maria Souza')).toContainText('Matrícula trancada');
  expect(api.chamadas).toContain('PATCH /pessoa/47811936844/status');

  await linha(page, 'Pessoa Antiga').getByRole('button', { name: 'Liberar acesso de Pessoa Antiga' }).click();
  await expect(linha(page, 'Pessoa Antiga')).toContainText('Liberado');
  await expect(linha(page, 'Pessoa Antiga')).not.toContainText('Documentação Pendente');
});

test('CT-18: cadastro com CPF duplicado mostra a mensagem do 409', async ({ page }) => {
  // O envio pela tela exige foto com rosto real (MediaPipe); aqui o teste usa a camada de serviços.
  const mensagem = await page.evaluate(async () => {
    const { cadastrarPessoa } = await import('/src/services/PessoasService.js');
    const { mensagemDeErro } = await import('/src/services/api.js');
    const dados = new FormData();
    dados.append('nome', 'Outra Pessoa');
    dados.append('cpf', '478.119.368-44');
    dados.append('foto', new File([new Uint8Array([255, 216, 255])], 'rosto.jpg', { type: 'image/jpeg' }));
    try {
      await cadastrarPessoa(dados);
      return 'sem erro';
    } catch (erro) {
      return mensagemDeErro(erro, 'padrão');
    }
  });
  expect(mensagem).toBe('Já existe uma pessoa cadastrada com este CPF.');
});
