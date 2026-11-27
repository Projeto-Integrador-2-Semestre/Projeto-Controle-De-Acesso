import { apiFetch, USE_MOCK } from './api.js';

/**
 * A API Java ainda não tem os endpoints de dispositivos (/dispositivos/...).
 * Enquanto isso, esta tela usa dados simulados mesmo com a API ligada, e mostra um aviso.
 * Quando a API ganhar os endpoints, basta trocar para true: as chamadas abaixo já estão prontas.
 */
const MONITORAMENTO_NA_API = false;

export const MONITORAMENTO_SIMULADO = USE_MOCK || !MONITORAMENTO_NA_API;

async function mock() {
  return import('./mocks/EstacoesMock.js');
}
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizarIdentificador(valor, nomeParametro) {
  const texto = String(valor ?? '').trim();

  if (!texto) {
    throw new Error(`Parâmetro "${nomeParametro}" inválido: valor ausente.`);
  }

  return texto;
}

export async function getEstacoes() {
  if (MONITORAMENTO_SIMULADO) {
    const { estacoesMock } = await mock();
    await esperar(300);
    return [...estacoesMock];
  }
  return apiFetch('/dispositivos/estacoes');
}

export async function getLogsDaEstacao(idEstacao) {
  const estacao = normalizarIdentificador(idEstacao, 'idEstacao');

  if (MONITORAMENTO_SIMULADO) {
    const { logsMockDaEstacao } = await mock();
    await esperar(200);
    return logsMockDaEstacao(estacao);
  }
  return apiFetch(`/dispositivos/estacoes/${encodeURIComponent(estacao)}/logs`);
}

/** Ações remotas: POST /dispositivos/estacoes/{id}/{acao}. */
async function acaoNoDispositivo(idDispositivo, acao, respostaSimulada, atrasoMs) {
  const id = normalizarIdentificador(idDispositivo, 'idDispositivo');

  if (MONITORAMENTO_SIMULADO) {
    await esperar(atrasoMs);
    return { ok: true, nome: id, ...respostaSimulada };
  }
  return apiFetch(`/dispositivos/estacoes/${encodeURIComponent(id)}/${acao}`, { method: 'POST' });
}

export function enviarPing(idDispositivo) {
  return acaoNoDispositivo(idDispositivo, 'ping', { latenciaMs: 12 }, 500);
}

export function sincronizarFacial(idDispositivo) {
  return acaoNoDispositivo(idDispositivo, 'sincronizar-facial', {}, 700);
}

export function testarGiro(idDispositivo) {
  return acaoNoDispositivo(idDispositivo, 'testar-giro', {}, 500);
}

export function reiniciarDispositivo(idDispositivo) {
  return acaoNoDispositivo(idDispositivo, 'reiniciar', {}, 800);
}

export async function bloqueioGeral() {
  if (MONITORAMENTO_SIMULADO) {
    await esperar(600);
    return { ok: true };
  }
  return apiFetch('/dispositivos/bloqueio-geral', { method: 'POST' });
}
