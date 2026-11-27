import { apiFetch, USE_MOCK } from './api.js';
import { formatarCpf, somenteDigitos } from './formatadores.js';

// ----- Modo simulado (desenvolvimento sem API) -----
// O mock só é baixado quando USE_MOCK está ligado; no build de produção fica num arquivo à parte.
let _pessoasMock = null;
async function pessoasMock() {
  if (!_pessoasMock) {
    const { pessoasMock: dados } = await import('./mocks/PessoasMock.js');
    _pessoasMock = [...dados];
  }
  return _pessoasMock;
}
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

/** Instante ISO (UTC) -> { data: "26/11/2026", hora: "12:30" } no fuso do navegador. */
function dataEHoraLocal(instante) {
  if (!instante) return { data: null, hora: null };
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return { data: null, hora: null };
  return {
    data: `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`,
    hora: `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`,
  };
}

/** Converte a pessoa da API ({cpf, nome, possuiFoto, status, motivoBloqueio, dataCadastro}) para a tela. */
function paraPessoaDaTela(p) {
  const { data, hora } = dataEHoraLocal(p.dataCadastro);
  return {
    id: p.cpf,
    nome: p.nome ?? '',
    cpf: formatarCpf(p.cpf),
    metodoAcesso: 'Biometria Facial',
    possuiFoto: p.possuiFoto ?? Boolean(p.foto),
    status: p.status === 'bloqueado' ? 'bloqueado' : 'liberado',
    motivoBloqueio: p.motivoBloqueio ?? null,
    // Cadastros feitos antes da API guardar a data vêm sem ela (a tela mostra "—")
    dataCadastro: data,
    horaCadastro: hora,
  };
}

export async function getPessoas() {
  if (USE_MOCK) {
    await esperar(300);
    return [...(await pessoasMock())];
  }
  const pessoas = await apiFetch('/pessoa/listar', { params: { foto: false } });
  return pessoas.map(paraPessoaDaTela);
}

export async function cadastrarPessoa(formData) {
  // formData é um objeto FormData contendo os campos 'nome', 'cpf' e 'foto' (arquivo).
  if (USE_MOCK) {
    await esperar(600);
    const lista = await pessoasMock();
    const nome = formData.get('nome');
    const cpf = formatarCpf(formData.get('cpf'));
    if (lista.some((p) => somenteDigitos(p.cpf) === somenteDigitos(cpf))) {
      const erro = new Error('A API respondeu com o status 409.');
      erro.response = { status: 409, data: { detail: 'Já existe uma pessoa cadastrada com este CPF.' } };
      throw erro;
    }
    const { data, hora } = dataEHoraLocal(new Date().toISOString());
    const novaPessoa = {
      id: somenteDigitos(cpf),
      nome,
      cpf,
      metodoAcesso: 'Biometria Facial',
      possuiFoto: true,
      status: 'liberado',
      motivoBloqueio: null,
      dataCadastro: data,
      horaCadastro: hora,
    };
    _pessoasMock = [novaPessoa, ...lista];
    return novaPessoa;
  }

  // O banco guarda o CPF só com dígitos (a face_api usa esse valor nos logs de acesso).
  const dados = new FormData();
  dados.append('nome', formData.get('nome'));
  dados.append('cpf', somenteDigitos(formData.get('cpf')));
  dados.append('foto', formData.get('foto'));
  return apiFetch('/pessoa/cadastro', { method: 'POST', body: dados });
}

export async function atualizarPessoa(cpf, formData) {
  const cpfOriginal = somenteDigitos(cpf);
  const nome = String(formData.get('nome') ?? '').trim();
  const foto = formData.get('foto');

  if (USE_MOCK) {
    await esperar(300);
    const lista = await pessoasMock();
    if (!lista.some((item) => somenteDigitos(item.cpf) === cpfOriginal)) {
      throw new Error('Pessoa não encontrada.');
    }
    _pessoasMock = lista.map((item) =>
      somenteDigitos(item.cpf) === cpfOriginal
        ? { ...item, nome, possuiFoto: foto ? true : item.possuiFoto }
        : item
    );
    return _pessoasMock.find((item) => somenteDigitos(item.cpf) === cpfOriginal);
  }

  const dados = new FormData();
  dados.append('cpf', cpfOriginal);
  dados.append('nome', nome);
  if (foto && typeof foto !== 'string') dados.append('foto', foto);
  return apiFetch('/pessoa/atualizar', { method: 'PUT', body: dados });
}

export async function excluirPessoa(cpf) {
  const cpfOriginal = somenteDigitos(cpf);

  if (USE_MOCK) {
    await esperar(300);
    const lista = await pessoasMock();
    if (!lista.some((item) => somenteDigitos(item.cpf) === cpfOriginal)) {
      throw new Error('Pessoa não encontrada.');
    }
    _pessoasMock = lista.filter((item) => somenteDigitos(item.cpf) !== cpfOriginal);
    return undefined;
  }

  return apiFetch(`/pessoa/${encodeURIComponent(cpfOriginal)}`, { method: 'DELETE' });
}

/**
 * Bloqueia ou libera o acesso (PATCH /pessoa/{cpf}/status). No bloqueio o motivo aparece na
 * listagem; a face_api passa a recusar a pessoa no totem. Devolve a pessoa já no formato da tela.
 */
export async function alterarStatusAcesso(cpf, novoStatus, motivo) {
  const cpfOriginal = somenteDigitos(cpf);
  const motivoFinal = novoStatus === 'bloqueado' ? (motivo?.trim() || 'Bloqueio administrativo') : null;

  if (USE_MOCK) {
    await esperar(250);
    const lista = await pessoasMock();
    _pessoasMock = lista.map((p) =>
      somenteDigitos(p.cpf) === cpfOriginal ? { ...p, status: novoStatus, motivoBloqueio: motivoFinal } : p
    );
    return _pessoasMock.find((p) => somenteDigitos(p.cpf) === cpfOriginal);
  }

  const pessoa = await apiFetch(`/pessoa/${encodeURIComponent(cpfOriginal)}/status`, {
    method: 'PATCH',
    body: { status: novoStatus, motivo: motivoFinal },
  });
  return paraPessoaDaTela(pessoa);
}
