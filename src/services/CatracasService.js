import { apiFetch, USE_MOCK } from './api.js';

// ----- Simulação (sem API): o "tablet" confirma a liberação ~2 s depois do pedido -----
const _liberacoesMock = new Map();
let _proximoIdMock = 1;

async function catracasMock() {
  const { estacoesMock } = await import('./mocks/EstacoesMock.js');
  return estacoesMock.map((estacao) => ({
    id: estacao.id,
    nome: estacao.catraca.nome,
    local: estacao.nome,
  }));
}

function liberacaoMock(id) {
  const l = _liberacoesMock.get(id);
  if (!l) return null;
  const confirmou = Date.now() - new Date(l.solicitadoEm).getTime() > 2000;
  return confirmou ? { ...l, status: 'confirmada', confirmadoEm: new Date().toISOString() } : l;
}

// ----- API -----

/** Lista as catracas cadastradas: [{ id, nome, local }]. */
export function getCatracas() {
  if (USE_MOCK) {
    return catracasMock().then((catracas) => new Promise((resolve) => setTimeout(() => resolve(catracas), 200)));
  }
  return apiFetch('/catracas');
}

/**
 * Pede a liberação manual da catraca. A API guarda o pedido até o tablet da catraca buscá-lo
 * (ele então mostra "ACESSO LIBERADO"). Devolve a liberação com status "pendente".
 */
export function liberarCatraca(catracaId, { operador, motivo } = {}) {
  if (USE_MOCK) {
    return catracasMock().then((catracas) => new Promise((resolve) => {
      setTimeout(() => {
        const catraca = catracas.find((c) => c.id === catracaId);
        const agora = new Date();
        const liberacao = {
          id: _proximoIdMock++,
          catracaId,
          catracaNome: catraca?.nome,
          operador: operador ?? null,
          motivo: motivo ?? null,
          solicitadoEm: agora.toISOString(),
          expiraEm: new Date(agora.getTime() + 30000).toISOString(),
          confirmadoEm: null,
          status: 'pendente',
        };
        _liberacoesMock.set(liberacao.id, liberacao);
        resolve(liberacao);
      }, 300);
    }));
  }
  return apiFetch(`/catracas/${catracaId}/liberar`, { method: 'POST', body: { operador, motivo } });
}

/** Consulta o status de uma liberação: "pendente", "confirmada" (tablet exibiu) ou "expirada". */
export function getLiberacao(liberacaoId) {
  if (USE_MOCK) {
    return new Promise((resolve) => setTimeout(() => resolve(liberacaoMock(liberacaoId)), 150));
  }
  return apiFetch(`/catracas/liberacoes/${liberacaoId}`);
}

/** Histórico das liberações manuais, mais recentes primeiro. */
export function getLiberacoes(limite = 100) {
  if (USE_MOCK) {
    return new Promise((resolve) =>
      setTimeout(() => resolve([..._liberacoesMock.keys()].reverse().map(liberacaoMock).slice(0, limite)), 150)
    );
  }
  return apiFetch('/catracas/liberacoes', { params: { limite } });
}
