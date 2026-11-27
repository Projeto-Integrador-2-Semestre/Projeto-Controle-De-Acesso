// Guarda o token do login.
// Com "Lembrar-me" marcado ele fica no localStorage (sobrevive a fechar o navegador);
// sem marcar, fica no sessionStorage e some quando a aba é fechada. O token vence
// sozinho na API (JWT_VALIDADE_HORAS, padrão 8 h), então mesmo o "lembrar" não é eterno.

const CHAVES = ['token', 'usuarioNome', 'tokenExpiraEm'];

// Marca que a sessão caiu por token vencido/inválido (resposta 401 da API). Fica guardada até a
// tela de login exibir o aviso: assim ele aparece qualquer que seja o caminho até o login.
const AVISO_EXPIRADA = 'sessaoExpirada';

function armazenamentos() {
  const lista = [];
  try { lista.push(window.sessionStorage); } catch { /* bloqueado pelo navegador */ }
  try { lista.push(window.localStorage); } catch { /* bloqueado pelo navegador */ }
  return lista;
}

function ler(chave) {
  for (const armazenamento of armazenamentos()) {
    const valor = armazenamento.getItem(chave);
    if (valor) return valor;
  }
  return null;
}

export function salvarSessao({ token, nome, expiraEm }, lembrar) {
  limparSessao();
  limparAvisoSessaoExpirada();
  let destino;
  try {
    destino = lembrar ? window.localStorage : window.sessionStorage;
  } catch {
    return;
  }
  destino.setItem('token', token);
  destino.setItem('usuarioNome', nome ?? '');
  if (expiraEm) destino.setItem('tokenExpiraEm', expiraEm);
}

export function limparSessao() {
  for (const armazenamento of armazenamentos()) {
    CHAVES.forEach((chave) => armazenamento.removeItem(chave));
  }
}

/** Token válido ou null (o vencido já é descartado aqui, sem esperar o 401 da API). */
export function tokenAtual() {
  const token = ler('token');
  if (!token) return null;
  const expiraEm = ler('tokenExpiraEm');
  if (expiraEm && new Date(expiraEm).getTime() <= Date.now()) {
    limparSessao();
    return null;
  }
  return token;
}

export function nomeSalvo() {
  return ler('usuarioNome');
}

/** Chamado quando a API responde 401: encerra a sessão e deixa o aviso para a tela de login. */
export function expirarSessao() {
  limparSessao();
  try {
    window.sessionStorage.setItem(AVISO_EXPIRADA, '1');
  } catch {
    /* sem armazenamento: o login só não mostra o aviso */
  }
}

/** true se a última sessão caiu por token vencido (não apaga o aviso). */
export function sessaoExpirou() {
  try {
    return window.sessionStorage.getItem(AVISO_EXPIRADA) === '1';
  } catch {
    return false;
  }
}

export function limparAvisoSessaoExpirada() {
  try {
    window.sessionStorage.removeItem(AVISO_EXPIRADA);
  } catch {
    /* nada a limpar */
  }
}
