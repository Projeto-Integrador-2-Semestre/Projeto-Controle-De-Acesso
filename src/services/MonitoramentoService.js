import { apiFetch, USE_MOCK } from './api.js';

/**
 * Monitoramento das estações (catraca + totem) pela API Java (/dispositivos/...).
 *
 * O que vem de verdade da API: totem online/offline e último contato (o tablet consulta a API a cada
 * 1,5 s), status do reconhecimento facial (face_api), passagens de hoje, ping, sincronização e
 * bloqueio geral. "Testar giro" e "Reiniciar" dependem do relé da catraca e a API responde 501.
 *
 * No modo simulado (desenvolvimento sem API) os dados vêm de mocks/EstacoesMock.js.
 */
export const MONITORAMENTO_SIMULADO = USE_MOCK;

async function mock() {
  return import('./mocks/EstacoesMock.js');
}
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

/** Segundos -> "há 2 s", "há 3 min", "há 2 h". */
function haQuanto(segundos) {
  if (segundos === null || segundos === undefined) return null;
  if (segundos < 60) return `há ${segundos} s`;
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
  return `há ${Math.floor(segundos / 3600)} h`;
}

/** Instante ISO -> "21:52:58" no fuso do navegador. */
function horaLocal(instante) {
  if (!instante) return '';
  const d = new Date(instante);
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())}`;
}

const STATUS_FACIAL = { reconhecendo: 'reconhecendo', carregando: 'sincronizando' };

/** Converte a estação da API para o formato usado pela tela (o mesmo dos dados simulados). */
function paraEstacaoDaTela(e) {
  const { totem, reconhecimento: rec } = e;
  return {
    id: e.id,
    numero: doisDigitos(e.id),
    nome: `${e.nome} • ${e.local || 'Local não informado'}`,
    descricao: 'Totem de reconhecimento facial (tablet) vinculado à catraca',
    statusGeral: e.statusGeral,
    bloqueioGeral: e.bloqueioGeral,
    catraca: {
      nome: e.nome,
      tipo: 'Catraca + Totem',
      modelo: 'Totem FaceTotem (Android)',
      status: totem.online ? 'online' : 'offline',
      ip: totem.ip || '—',
      porta: '—',
      ciclos: `${e.passagensHoje} passagens hoje`,
      rele: 'Não instalado',
      ping: null,
      firmware: null,
      contato: totem.segundosDesdeContato === null ? 'nunca consultou a API' : haQuanto(totem.segundosDesdeContato),
    },
    facial: {
      nome: `Reconhecimento • ${e.nome}`,
      modelo: 'face_api (InsightFace)',
      // A câmera é a do tablet: sem o totem, a estação não reconhece ninguém mesmo com a face_api no ar
      status: totem.online ? STATUS_FACIAL[rec.status] ?? 'offline' : 'offline',
      ip: '—',
      stream: 'Câmera do tablet',
      precisao: rec.antiSpoofing === null ? '—' : rec.antiSpoofing ? 'Anti-spoofing ligado' : 'Anti-spoofing desligado',
      bancoFaces: rec.rostosEmCache === null ? '—' : `${rec.rostosEmCache} rostos em cache`,
      progressoSync: null,
      ultimaSync: rec.latenciaMs === null ? null : `face_api respondeu em ${rec.latenciaMs} ms`,
      latenciaMs: rec.latenciaMs,
    },
  };
}

export async function getEstacoes() {
  if (MONITORAMENTO_SIMULADO) {
    const { estacoesMock } = await mock();
    await esperar(300);
    return estacoesMock.map((e) => ({ ...e, bloqueioGeral: false }));
  }
  const estacoes = await apiFetch('/dispositivos/estacoes');
  return estacoes.map(paraEstacaoDaTela);
}

/** Syslog da estação: [{ tipo, titulo, hora, texto }], mais recentes primeiro. */
export async function getLogsDaEstacao(estacao) {
  if (MONITORAMENTO_SIMULADO) {
    const { logsMockDaEstacao } = await mock();
    await esperar(200);
    return logsMockDaEstacao(estacao.nome);
  }
  const eventos = await apiFetch(`/dispositivos/estacoes/${estacao.id}/logs`);
  return eventos.map((ev) => ({ tipo: ev.tipo, titulo: ev.titulo, hora: horaLocal(ev.dataHora), texto: ev.texto }));
}

/** { totemOnline, segundosDesdeContato, reconhecimentoOnline, latenciaReconhecimentoMs } */
export async function enviarPing(estacao) {
  if (MONITORAMENTO_SIMULADO) {
    await esperar(500);
    return { totemOnline: true, segundosDesdeContato: 1, reconhecimentoOnline: true, latenciaReconhecimentoMs: estacao.catraca.ping };
  }
  return apiFetch(`/dispositivos/estacoes/${estacao.id}/ping`, { method: 'POST' });
}

/** Resumo da face_api: { embeddings_em_cache, novos_ou_atualizados, ... } */
export async function sincronizarFacial(estacao) {
  if (MONITORAMENTO_SIMULADO) {
    await esperar(700);
    return { embeddings_em_cache: 1428, novos_ou_atualizados: 0 };
  }
  return apiFetch(`/dispositivos/estacoes/${estacao.id}/sincronizar-facial`, { method: 'POST' });
}

export async function testarGiro(estacao) {
  if (MONITORAMENTO_SIMULADO) {
    await esperar(500);
    return { ok: true };
  }
  return apiFetch(`/dispositivos/estacoes/${estacao.id}/testar-giro`, { method: 'POST' });
}

export async function reiniciarDispositivo(estacao) {
  if (MONITORAMENTO_SIMULADO) {
    await esperar(800);
    return { ok: true };
  }
  return apiFetch(`/dispositivos/estacoes/${estacao.id}/reiniciar`, { method: 'POST' });
}

// ----- Bloqueio geral -----
let _bloqueioMock = { ativo: false, alteradoEm: null, alteradoPor: null };

/** { ativo, alteradoEm, alteradoPor } */
export async function getBloqueioGeral() {
  if (MONITORAMENTO_SIMULADO) return { ..._bloqueioMock };
  return apiFetch('/dispositivos/bloqueio-geral');
}

/** Ativa ou desativa o bloqueio geral. Ativo, a face_api recusa todos os rostos e as liberações manuais param. */
export async function alterarBloqueioGeral(ativo) {
  if (MONITORAMENTO_SIMULADO) {
    await esperar(600);
    _bloqueioMock = { ativo, alteradoEm: new Date().toISOString(), alteradoPor: 'Operador' };
    return { ..._bloqueioMock };
  }
  return apiFetch('/dispositivos/bloqueio-geral', { method: 'POST', body: { ativo } });
}
