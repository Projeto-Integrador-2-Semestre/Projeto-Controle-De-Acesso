// Cálculos do Painel de Análise de Acessos. Funções puras sobre a lista de logs do LogsService
// ({ id, instante: Date, dataHora: 'YYYY-MM-DDTHH:mm:ss' local, sentido, nome, cpf, cpfCompleto }).

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function chavePessoa(log) {
  return log.cpfCompleto || log.cpf || log.nome;
}

function diaLocal(log) {
  return log.dataHora.slice(0, 10);
}

/** Entradas e saídas por hora do dia (0–23). */
export function fluxoPorHora(logs) {
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, rotulo: `${String(h).padStart(2, '0')}h`, entradas: 0, saidas: 0 }));
  logs.forEach((l) => {
    const h = l.instante.getHours();
    if (l.sentido === 'entrada') horas[h].entradas += 1;
    else horas[h].saidas += 1;
  });
  return horas;
}

/** Recorta o intervalo de horas com movimento (com 1 h de folga) para o gráfico não ficar vazio nas pontas. */
export function recortarHorasComMovimento(horas) {
  const comDados = horas.filter((h) => h.entradas + h.saidas > 0).map((h) => h.hora);
  if (comDados.length === 0) return horas.slice(6, 23);
  const inicio = Math.max(0, Math.min(...comDados) - 1);
  const fim = Math.min(23, Math.max(...comDados) + 1);
  return horas.slice(inicio, fim + 1);
}

/** Hora com mais registros de um sentido: { hora, rotulo, total } ou null. */
export function horaDePico(horas, campo) {
  const pico = horas.reduce((melhor, h) => (h[campo] > (melhor?.[campo] ?? 0) ? h : melhor), null);
  return pico ? { hora: pico.hora, rotulo: pico.rotulo, total: pico[campo] } : null;
}

/** Entradas e saídas por dia, cobrindo todos os dias do período (inclusive os sem movimento). */
export function movimentoDiario(logs, inicio, fim) {
  const mapa = new Map();
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const ultimo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  while (cursor <= ultimo) {
    const chave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    mapa.set(chave, {
      dia: chave,
      rotulo: `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      semana: DIAS_SEMANA[cursor.getDay()],
      entradas: 0,
      saidas: 0,
      pessoas: new Set(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  logs.forEach((l) => {
    const item = mapa.get(diaLocal(l));
    if (!item) return;
    if (l.sentido === 'entrada') item.entradas += 1;
    else item.saidas += 1;
    item.pessoas.add(chavePessoa(l));
  });
  return [...mapa.values()].map(({ pessoas, ...resto }) => ({ ...resto, pessoasUnicas: pessoas.size }));
}

/** Matriz dia da semana × hora com o total de passagens: { celulas: number[7][24], maximo }. */
export function mapaDeCalor(logs) {
  const celulas = Array.from({ length: 7 }, () => Array(24).fill(0));
  logs.forEach((l) => {
    celulas[l.instante.getDay()][l.instante.getHours()] += 1;
  });
  const maximo = Math.max(0, ...celulas.flat());
  return { celulas, maximo };
}

/**
 * Agrupa as passagens de cada pessoa em visitas (entrada -> saída no mesmo dia).
 * Entrada sem saída no mesmo dia vira visita "em aberto" (sem duração).
 */
export function visitasPorPessoa(logs) {
  const porPessoa = new Map();
  [...logs]
    .sort((a, b) => a.instante - b.instante)
    .forEach((l) => {
      const chave = chavePessoa(l);
      if (!porPessoa.has(chave)) porPessoa.set(chave, { chave, nome: l.nome, cpf: l.cpf, passagens: [] });
      porPessoa.get(chave).passagens.push(l);
    });

  return [...porPessoa.values()].map((pessoa) => {
    const visitas = [];
    let aberta = null;
    pessoa.passagens.forEach((l) => {
      if (l.sentido === 'entrada') {
        if (aberta) visitas.push(aberta);
        aberta = { dia: diaLocal(l), entrada: l.instante, saida: null, duracaoMin: null };
      } else if (aberta && diaLocal(l) === aberta.dia) {
        aberta.saida = l.instante;
        aberta.duracaoMin = Math.round((l.instante - aberta.entrada) / 60000);
        visitas.push(aberta);
        aberta = null;
      } else {
        // saída sem entrada registrada no período (ex.: entrou antes do início do filtro)
        if (aberta) visitas.push(aberta);
        aberta = null;
        visitas.push({ dia: diaLocal(l), entrada: null, saida: l.instante, duracaoMin: null });
      }
    });
    if (aberta) visitas.push(aberta);
    return { ...pessoa, visitas };
  });
}

/** Resumo por pessoa para a tabela do painel. */
export function resumoPorPessoa(logs, agora = new Date()) {
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  return visitasPorPessoa(logs)
    .map((p) => {
      const entradas = p.passagens.filter((l) => l.sentido === 'entrada').length;
      const saidas = p.passagens.length - entradas;
      const comDuracao = p.visitas.filter((v) => v.duracaoMin != null);
      const permanenciaMediaMin = comDuracao.length
        ? Math.round(comDuracao.reduce((s, v) => s + v.duracaoMin, 0) / comDuracao.length)
        : null;
      const ultima = p.passagens[p.passagens.length - 1];
      const dentroAgora = ultima.sentido === 'entrada' && diaLocal(ultima) === hoje;
      const minutosEntrada = p.visitas.filter((v) => v.entrada).map((v) => v.entrada.getHours() * 60 + v.entrada.getMinutes());
      return {
        chave: p.chave,
        nome: p.nome,
        cpf: p.cpf,
        dias: new Set(p.passagens.map(diaLocal)).size,
        entradas,
        saidas,
        permanenciaMediaMin,
        horarioMedioEntradaMin: minutosEntrada.length
          ? Math.round(minutosEntrada.reduce((s, m) => s + m, 0) / minutosEntrada.length)
          : null,
        ultimaPassagem: ultima,
        dentroAgora,
        visitas: p.visitas,
      };
    })
    .sort((a, b) => b.ultimaPassagem.instante - a.ultimaPassagem.instante);
}

/** Indicadores do topo do painel. */
export function indicadores(logs, resumo) {
  const entradas = logs.filter((l) => l.sentido === 'entrada').length;
  const duracoes = resumo.flatMap((p) => p.visitas.filter((v) => v.duracaoMin != null).map((v) => v.duracaoMin));
  return {
    passagens: logs.length,
    entradas,
    saidas: logs.length - entradas,
    pessoasUnicas: resumo.length,
    presentesAgora: resumo.filter((p) => p.dentroAgora).length,
    permanenciaMediaMin: duracoes.length ? Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length) : null,
  };
}

export function formatarDuracao(minutos) {
  if (minutos == null) return '—';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

export function formatarMinutoDoDia(minutos) {
  if (minutos == null) return '—';
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

export function formatarHora(data) {
  if (!data) return '—';
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}
