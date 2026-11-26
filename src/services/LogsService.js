import { apiFetch, USE_MOCK } from './api.js';
import { logsMock } from './LogsMock.js';
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
    // O totem ainda não informa à face_api qual catraca registrou a passagem
    catraca: 'Totem de Reconhecimento Facial',
    local: 'Registro automático (face_api)',
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
export function getLogs({ de, ate } = {}) {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const dados = logsMock.map(mockParaTela).filter((l) => (!de || l.instante >= de) && (!ate || l.instante <= ate));
        resolve(dados);
      }, 300);
    });
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
