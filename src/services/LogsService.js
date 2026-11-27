import { apiFetch, USE_MOCK } from './api.js';
import { dataHoraLocal, mascararCpf } from './formatadores.js';

const LIMITE_REGISTROS = 5000;

/**
 * Converte o log da API ({id, cpf, nome, tipo, dataHora em UTC}) para o formato das telas.
 * `dataHora` vira texto local ("YYYY-MM-DDTHH:mm:ss") e `instante` guarda a data real.
 */
function paraLogDaTela(log) {
  return {
    id: log.id,
    instante: new Date(log.dataHora),
    dataHora: dataHoraLocal(log.dataHora),
    sentido: log.tipo,
    nome: log.nome ?? 'Pessoa removida',
    cpf: mascararCpf(log.cpf),
    cpfCompleto: log.cpf,
    // O totem informa a catraca à face_api; os registros antigos vêm sem ela
    catraca: log.catracaNome ?? 'Totem de Reconhecimento Facial',
    local: log.catracaLocal ?? 'Registro automático (face_api)',
    metodo: 'Facial',
    status: 'liberado', // só passagens autorizadas são gravadas
  };
}

function mockParaTela(log) {
  return { ...log, instante: new Date(log.dataHora), dataHora: dataHoraLocal(log.dataHora), cpfCompleto: log.cpf };
}

/**
 * Busca os logs de entrada/saída. `de` e `ate` (Date) limitam o período no servidor.
 */
export async function getLogs({ de, ate } = {}) {
  if (USE_MOCK) {
    // Só em desenvolvimento sem API; o mock é carregado sob demanda
    const { logsMock } = await import('./mocks/LogsMock.js');
    await new Promise((resolve) => setTimeout(resolve, 300));
    return logsMock.map(mockParaTela).filter((l) => (!de || l.instante >= de) && (!ate || l.instante <= ate));
  }
  return apiFetch('/logs', {
    params: {
      de: de ? de.toISOString() : undefined,
      ate: ate ? ate.toISOString() : undefined,
      limite: LIMITE_REGISTROS,
    },
  })
    .then((logs) => logs.map(paraLogDaTela));
}
