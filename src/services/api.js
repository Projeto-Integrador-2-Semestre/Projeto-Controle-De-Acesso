const urlConfigurada = String(import.meta.env.VITE_API_URL ?? '').trim();

// URL base da API Java (Spring Boot). Só vale se for um endereço http(s) de verdade.
export const API_URL = /^https?:\/\//i.test(urlConfigurada) ? urlConfigurada.replace(/\/+$/, '') : '';

// Usa os dados simulados quando VITE_USE_MOCK=true ou quando não há VITE_API_URL configurada.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !API_URL;

const TEMPO_LIMITE_MS = 20000;

export async function apiFetch(caminho, { params, ...opcoes } = {}) {
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

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      body: corpo && !ehFormData ? JSON.stringify(corpo) : corpo,
      headers,
      signal: controlador.signal,
    });
    const texto = resposta.status === 204 ? null : await resposta.text();
    let dados = texto;

    if (texto && resposta.headers.get('content-type')?.includes('application/json')) {
      dados = JSON.parse(texto);
    }

    if (!resposta.ok) {
      const erro = new Error(`A API respondeu com o status ${resposta.status}.`);
      erro.response = { data: dados, status: resposta.status };
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

/** Extrai a mensagem de erro enviada pela API ({"detail": "..."}) ou devolve a mensagem padrão. */
export function mensagemDeErro(error, padrao) {
  const dados = error?.response?.data;
  if (dados && typeof dados === 'object' && dados.detail) return dados.detail;
  if (typeof dados === 'string' && dados.trim() && dados.length < 200) return dados;
  if (error?.code === 'ERR_NETWORK') return 'Não foi possível conectar à API. Verifique se ela está no ar.';
  if (error?.code === 'ECONNABORTED') return 'A API demorou para responder. Tente novamente.';
  return error?.message && !error.response ? error.message : padrao;
}
