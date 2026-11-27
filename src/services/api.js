import { expirarSessao, tokenAtual } from './sessao.js';

const urlConfigurada = String(import.meta.env.VITE_API_URL ?? '').trim();

// URL base da API Java (Spring Boot). Só vale se for um endereço http(s) de verdade.
export const API_URL = /^https?:\/\//i.test(urlConfigurada) ? urlConfigurada.replace(/\/+$/, '') : '';

/**
 * Modo simulado (dados de exemplo, sem API). Só existe para desenvolver a interface offline:
 * vale com VITE_USE_MOCK=true, ou em `npm run dev` quando não há VITE_API_URL.
 * No build de produção sem VITE_API_URL as telas mostram erro, em vez de dados falsos.
 * Os mocks ficam em services/mocks e são carregados sob demanda (import dinâmico).
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || (import.meta.env.DEV && !API_URL);

const TEMPO_LIMITE_MS = 20000;

/** Chamado quando a API responde 401 (token vencido ou inválido). O App registra o redirecionamento. */
let aoExpirarSessao = () => {};
export function definirAoExpirarSessao(callback) {
  aoExpirarSessao = callback;
}

export async function apiFetch(caminho, { params, autenticado = true, ...opcoes } = {}) {
  if (!API_URL) {
    const erroConfig = new Error('A URL da API não está configurada (VITE_API_URL).');
    erroConfig.code = 'ERR_CONFIG';
    throw erroConfig;
  }

  const url = new URL(`${API_URL}${caminho}`);
  Object.entries(params ?? {}).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null) url.searchParams.set(chave, valor);
  });

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);
  const corpo = opcoes.body;
  const ehFormData = typeof FormData !== 'undefined' && corpo instanceof FormData;
  const headers = new Headers(opcoes.headers);

  if (corpo && !ehFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = autenticado ? tokenAtual() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      body: corpo && !ehFormData ? JSON.stringify(corpo) : corpo,
      headers,
      signal: controlador.signal,
    });
    const texto = resposta.status === 204 ? null : await resposta.text();
    let dados = texto;

    // application/json e também application/problem+json
    if (texto && /(^|\+|\/)json\b/i.test(resposta.headers.get('content-type') ?? '')) {
      dados = JSON.parse(texto);
    }

    if (!resposta.ok) {
      const erro = new Error(`A API respondeu com o status ${resposta.status}.`);
      erro.response = { data: dados, status: resposta.status };
      if (resposta.status === 401 && autenticado) {
        expirarSessao();
        aoExpirarSessao();
      }
      throw erro;
    }

    return dados;
  } catch (erro) {
    if (controlador.signal.aborted) {
      const erroTimeout = new Error('A API demorou para responder.');
      erroTimeout.code = 'ECONNABORTED';
      throw erroTimeout;
    }
    if (erro instanceof TypeError) {
      const erroRede = new Error('Falha ao conectar à API.');
      erroRede.code = 'ERR_NETWORK';
      throw erroRede;
    }
    throw erro;
  } finally {
    clearTimeout(temporizador);
  }
}

/** Mensagens para quando a API não manda "detail" (ou manda algo genérico demais). */
const MENSAGENS_POR_STATUS = {
  401: 'Sua sessão expirou. Faça login novamente.',
  403: 'Você não tem permissão para esta ação.',
  409: 'Já existe uma pessoa cadastrada com este CPF.',
  413: 'A foto é grande demais. Envie uma imagem menor.',
  503: 'O banco de dados está indisponível no momento. Tente novamente em instantes.',
};

/** Extrai a mensagem de erro enviada pela API ({"detail": "..."}) ou devolve a mensagem padrão. */
export function mensagemDeErro(error, padrao) {
  const dados = error?.response?.data;
  if (dados && typeof dados === 'object' && dados.detail) return dados.detail;
  if (typeof dados === 'string' && dados.trim() && dados.length < 200 && !dados.trim().startsWith('<')) return dados;
  const porStatus = MENSAGENS_POR_STATUS[error?.response?.status];
  if (porStatus) return porStatus;
  if (error?.code === 'ERR_NETWORK') return 'Não foi possível conectar à API. Verifique se ela está no ar.';
  if (error?.code === 'ECONNABORTED') return 'A API demorou para responder. Tente novamente.';
  return error?.message && !error.response ? error.message : padrao;
}
