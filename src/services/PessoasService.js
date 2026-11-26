import { apiFetch, USE_MOCK } from './api.js';
import { pessoasMock } from './PessoasMock.js';
import { formatarCpf, somenteDigitos } from './formatadores.js';

// O que a API Java ainda não oferece (a tela desabilita o recurso quando estiver usando a API).
export const RECURSOS_PESSOAS = {
  bloqueio: USE_MOCK, // a tabela `pessoa` não tem coluna de status
  dataCadastro: USE_MOCK, // a tabela `pessoa` não guarda a data do cadastro
};

let _pessoas = [...pessoasMock];

/** Converte a pessoa da API ({cpf, nome, possuiFoto}) para o formato usado pela tela. */
function paraPessoaDaTela(p) {
  return {
    id: p.cpf,
    nome: p.nome ?? '',
    cpf: formatarCpf(p.cpf),
    metodoAcesso: 'Biometria Facial',
    possuiFoto: p.possuiFoto ?? Boolean(p.foto),
    status: 'liberado',
    motivoBloqueio: null,
    dataCadastro: null,
    horaCadastro: null,
  };
}

export function getPessoas() {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => resolve([..._pessoas]), 300);
    });
  }
  return apiFetch('/pessoa/listar?foto=false').then((pessoas) => pessoas.map(paraPessoaDaTela));
}

export function cadastrarPessoa(formData) {
  // formData é um objeto FormData contendo os campos 'nome', 'cpf' e 'foto' (arquivo).
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const nome = formData.get('nome');
        const cpf = formData.get('cpf');
        const agora = new Date();

        const novaPessoa = {
          id: Math.max(..._pessoas.map((p) => p.id), 0) + 1,
          nome,
          cpf,
          metodoAcesso: 'Biometria Facial',
          confiancaBiometria: 97,
          status: 'liberado',
          motivoBloqueio: null,
          dataCadastro: `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`,
          horaCadastro: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
        };

        _pessoas = [novaPessoa, ..._pessoas];
        resolve(novaPessoa);
      }, 600);
    });
  }

  // O banco guarda o CPF só com dígitos (a face_api usa esse valor nos logs de acesso).
  const dados = new FormData();
  dados.append('nome', formData.get('nome'));
  dados.append('cpf', somenteDigitos(formData.get('cpf')));
  dados.append('foto', formData.get('foto'));
  return apiFetch('/pessoa/cadastro', { method: 'POST', body: dados });
}

export function atualizarPessoa(cpf, formData) {
  const cpfOriginal = somenteDigitos(cpf);
  const nome = String(formData.get('nome') ?? '').trim();
  const foto = formData.get('foto');

  if (USE_MOCK) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const pessoa = _pessoas.find((item) => somenteDigitos(item.cpf) === cpfOriginal);
        if (!pessoa) {
          reject(new Error('Pessoa não encontrada.'));
          return;
        }

        _pessoas = _pessoas.map((item) =>
          somenteDigitos(item.cpf) === cpfOriginal
            ? { ...item, nome, possuiFoto: foto ? true : item.possuiFoto }
            : item
        );
        resolve(_pessoas.find((item) => somenteDigitos(item.cpf) === cpfOriginal));
      }, 300);
    });
  }

  const dados = new FormData();
  dados.append('cpf', cpfOriginal);
  dados.append('nome', nome);
  if (foto && typeof foto !== 'string') dados.append('foto', foto);
  return apiFetch('/pessoa/atualizar', { method: 'PUT', body: dados });
}

export function excluirPessoa(cpf) {
  const cpfOriginal = somenteDigitos(cpf);

  if (USE_MOCK) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const existe = _pessoas.some((item) => somenteDigitos(item.cpf) === cpfOriginal);
        if (!existe) {
          reject(new Error('Pessoa não encontrada.'));
          return;
        }
        _pessoas = _pessoas.filter((item) => somenteDigitos(item.cpf) !== cpfOriginal);
        resolve();
      }, 300);
    });
  }

  return apiFetch(`/pessoa/${encodeURIComponent(cpfOriginal)}`, { method: 'DELETE' });
}

export function alterarStatusAcesso(id, novoStatus) {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        _pessoas = _pessoas.map((p) =>
          p.id === id
            ? { ...p, status: novoStatus, motivoBloqueio: novoStatus === 'bloqueado' ? 'Bloqueio Administrativo' : null }
            : p
        );
        resolve(_pessoas.find((p) => p.id === id));
      }, 250);
    });
  }
  // Ainda não existe na API Java (precisa de uma coluna de status em `pessoa` e da face_api respeitar o bloqueio).
  return Promise.reject(new Error('Bloqueio de acesso ainda não está disponível na API.'));
}
