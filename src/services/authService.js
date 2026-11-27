import { apiFetch, USE_MOCK } from './api.js';
import { limparSessao, nomeSalvo, salvarSessao, tokenAtual } from './sessao.js';

// Usuário do modo simulado (só em desenvolvimento, sem API). Com a API, quem confere é o
// POST /auth/login, com o usuário e a senha definidos nas variáveis ADMIN_* da API.
const USUARIO_TESTE = {
  usuario: 'admin',
  senha: '1234',
  nome: 'Marcos Vinicius Silva',
};

/** Faz login e guarda o token. `lembrar` mantém a sessão depois de fechar o navegador. */
export async function login(usuario, senha, lembrar = false) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (usuario !== USUARIO_TESTE.usuario || senha !== USUARIO_TESTE.senha) {
      throw new Error('Usuário ou senha inválidos.');
    }
    const sessao = { token: 'mock-token-' + Date.now(), nome: USUARIO_TESTE.nome };
    salvarSessao(sessao, lembrar);
    return sessao;
  }

  // autenticado: false -> um 401 aqui é "senha errada", não "sessão expirada"
  const resposta = await apiFetch('/auth/login', {
    method: 'POST',
    body: { usuario, senha },
    autenticado: false,
  });
  salvarSessao({ token: resposta.token, nome: resposta.nome, expiraEm: resposta.expiraEm }, lembrar);
  return resposta;
}

export function logout() {
  limparSessao();
}

/** Nome do operador logado (enviado junto com as liberações manuais de catraca). */
export function nomeDoUsuario() {
  return nomeSalvo() || 'Operador';
}

export function estaAutenticado() {
  return Boolean(tokenAtual());
}
