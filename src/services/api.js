import axios from 'axios';

const urlConfigurada = String(import.meta.env.VITE_API_URL ?? '').trim();

// URL base da API Java (Spring Boot). Só vale se for um endereço http(s) de verdade.
export const API_URL = /^https?:\/\//i.test(urlConfigurada) ? urlConfigurada.replace(/\/+$/, '') : '';

// Usa os dados simulados quando VITE_USE_MOCK=true ou quando não há VITE_API_URL configurada.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

/** Extrai a mensagem de erro enviada pela API ({"detail": "..."}) ou devolve a mensagem padrão. */
export function mensagemDeErro(error, padrao) {
  const dados = error?.response?.data;
  if (dados && typeof dados === 'object' && dados.detail) return dados.detail;
  if (typeof dados === 'string' && dados.trim() && dados.length < 200) return dados;
  if (error?.code === 'ERR_NETWORK') return 'Não foi possível conectar à API. Verifique se ela está no ar.';
  if (error?.code === 'ECONNABORTED') return 'A API demorou para responder. Tente novamente.';
  return error?.message && !error.response ? error.message : padrao;
}

export default api;
