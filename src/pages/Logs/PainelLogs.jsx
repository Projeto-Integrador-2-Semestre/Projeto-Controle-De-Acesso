import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock3,
  DoorOpen,
  KeyRound,
  RefreshCw,
  Search,
  Timer,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { getLogs } from '../../services/LogsService.js';
import { getLiberacoes } from '../../services/CatracasService.js';
import { mensagemDeErro } from '../../services/api.js';
import { dataLocalISO, fimDoDia, inicioDoDia } from '../../services/formatadores.js';
import {
  DIAS_SEMANA,
  fluxoPorHora,
  formatarDuracao,
  formatarHora,
  formatarMinutoDoDia,
  horaDePico,
  indicadores,
  mapaDeCalor,
  movimentoDiario,
  recortarHorasComMovimento,
  resumoPorPessoa,
} from './analiseLogs.js';
import './PainelLogs.css';

// Paleta validada (dataviz): slot 1 azul = entrada, slot 2 laranja = saída
const COR_ENTRADA = '#2a78d6';
const COR_SAIDA = '#eb6834';
// Rampa sequencial azul (um só tom, claro -> escuro) para o mapa de calor
const RAMPA_CALOR = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

const PERIODOS = [
  { chave: 'hoje', rotulo: 'Hoje', dias: 1 },
  { chave: '7dias', rotulo: '7 dias', dias: 7 },
  { chave: '30dias', rotulo: '30 dias', dias: 30 },
  { chave: '90dias', rotulo: '90 dias', dias: 90 },
];

function intervaloDoAtalho(dias) {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(fim.getDate() - (dias - 1));
  return { inicio: dataLocalISO(inicio), fim: dataLocalISO(fim) };
}

function corDoCalor(valor, maximo) {
  if (!valor || !maximo) return null;
  const indice = Math.min(RAMPA_CALOR.length - 1, Math.floor((valor / maximo) * RAMPA_CALOR.length));
  return RAMPA_CALOR[indice];
}

const numero = new Intl.NumberFormat('pt-BR');

function TooltipFluxo({ active, payload, label, titulo }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="painel__tooltip">
      <strong>{titulo ? titulo(payload[0].payload) : label}</strong>
      {payload.map((p) => (
        <div key={p.dataKey} className="painel__tooltip-linha">
          <span className="painel__tooltip-marca" style={{ backgroundColor: p.color }} />
          <span>{p.name}</span>
          <b>{numero.format(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

function Indicador({ icone: Icone, rotulo, valor, detalhe, destaque }) {
  return (
    <div className={`painel__kpi ${destaque ? 'painel__kpi--destaque' : ''}`}>
      <span className="painel__kpi-icone">
        <Icone size={18} />
      </span>
      <div>
        <span className="painel__kpi-rotulo">{rotulo}</span>
        <span className="painel__kpi-valor">{valor}</span>
        {detalhe && <span className="painel__kpi-detalhe">{detalhe}</span>}
      </div>
    </div>
  );
}

function PainelLogs() {
  const [periodo, setPeriodo] = useState('7dias');
  const [{ inicio, fim }, setIntervalo] = useState(() => intervaloDoAtalho(7));
  const [recarga, setRecarga] = useState(0);
  // Resultado da última busca; enquanto a chave dele não bate com o período atual, está carregando
  const [resultado, setResultado] = useState({ chave: null, logs: [], liberacoes: [], erro: '', atualizadoAs: null });
  const [busca, setBusca] = useState('');
  const [pessoaAberta, setPessoaAberta] = useState(null);

  const intervaloValido = Boolean(inicio && fim && inicio <= fim);
  const chave = `${inicio}|${fim}|${recarga}`;
  const carregando = intervaloValido && resultado.chave !== chave;
  const { logs, liberacoes, erro, atualizadoAs } = resultado;

  useEffect(() => {
    if (!intervaloValido) return undefined;
    let ativo = true;
    Promise.all([
      getLogs({ de: inicioDoDia(inicio), ate: fimDoDia(fim) }),
      getLiberacoes(200).catch(() => []),
    ])
      .then(([dados, libs]) => {
        if (!ativo) return;
        setResultado({
          chave,
          logs: dados,
          liberacoes: libs.filter((l) => {
            const dia = dataLocalISO(new Date(l.solicitadoEm));
            return dia >= inicio && dia <= fim;
          }),
          erro: '',
          atualizadoAs: new Date(),
        });
      })
      .catch((error) => {
        if (!ativo) return;
        setResultado({ chave, logs: [], liberacoes: [], erro: mensagemDeErro(error, 'Não foi possível carregar os registros.'), atualizadoAs: null });
      });
    return () => {
      ativo = false;
    };
  }, [chave, inicio, fim, intervaloValido]);

  const carregar = () => setRecarga((n) => n + 1);

  // Esc fecha a linha do tempo da pessoa
  useEffect(() => {
    if (!pessoaAberta) return undefined;
    const aoTeclar = (e) => e.key === 'Escape' && setPessoaAberta(null);
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [pessoaAberta]);

  function escolherPeriodo(item) {
    setPeriodo(item.chave);
    setIntervalo(intervaloDoAtalho(item.dias));
    setPessoaAberta(null);
  }

  function mudarData(campo, valor) {
    setPeriodo(null);
    setIntervalo((atual) => ({ ...atual, [campo]: valor }));
  }

  const analise = useMemo(() => {
    const horas = fluxoPorHora(logs);
    const resumo = resumoPorPessoa(logs);
    return {
      horas: recortarHorasComMovimento(horas),
      picoEntrada: horaDePico(horas, 'entradas'),
      picoSaida: horaDePico(horas, 'saidas'),
      dias: inicio && fim ? movimentoDiario(logs, inicioDoDia(inicio), inicioDoDia(fim)) : [],
      calor: mapaDeCalor(logs),
      resumo,
      kpis: indicadores(logs, resumo),
    };
  }, [logs, inicio, fim]);

  const diaMaisMovimentado = analise.dias.reduce(
    (melhor, d) => (d.entradas + d.saidas > (melhor ? melhor.entradas + melhor.saidas : 0) ? d : melhor),
    null
  );
  const maisFrequentes = [...analise.resumo]
    .sort((a, b) => b.dias - a.dias || b.entradas - a.entradas)
    .slice(0, 8)
    .map((p) => ({ nome: p.nome.split(' ').slice(0, 2).join(' '), nomeCompleto: p.nome, dias: p.dias, entradas: p.entradas }));

  const termo = busca.trim().toLowerCase();
  const pessoasFiltradas = analise.resumo.filter(
    (p) => !termo || p.nome.toLowerCase().includes(termo) || String(p.cpf).includes(termo)
  );
  const pessoaSelecionada = analise.resumo.find((p) => p.chave === pessoaAberta);
  const horasCalor = recortarHorasComMovimento(fluxoPorHora(logs)).map((h) => h.hora);
  const variosDias = analise.dias.length > 1;
  const semDados = !carregando && !erro && logs.length === 0;

  return (
    <div className="painel">
      <div className="painel__cabecalho">
        <div>
          <span className="painel__selo">
            <BarChart3 size={14} /> Análise de Acessos
          </span>
          <h1>Painel de Entradas e Saídas</h1>
          <p>Fluxo de pessoas, horários de pico e permanência calculados a partir dos logs das catracas.</p>
        </div>
        <div className="painel__atualizacao">
          {atualizadoAs && <span>Atualizado às {formatarHora(atualizadoAs)}</span>}
          <button type="button" className="painel__botao" onClick={carregar} disabled={carregando}>
            <RefreshCw size={14} className={carregando ? 'painel__girando' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros: uma linha acima de todos os gráficos */}
      <section className="painel__filtros" aria-label="Período">
        <div className="painel__atalhos" role="group">
          {PERIODOS.map((item) => (
            <button
              key={item.chave}
              type="button"
              className={periodo === item.chave ? 'painel__atalho--ativo' : ''}
              aria-pressed={periodo === item.chave}
              onClick={() => escolherPeriodo(item)}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
        <div className="painel__datas">
          <label>
            De
            <input type="date" value={inicio} max={fim} onChange={(e) => mudarData('inicio', e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" value={fim} min={inicio} onChange={(e) => mudarData('fim', e.target.value)} />
          </label>
        </div>
      </section>

      {erro && (
        <div className="painel__aviso painel__aviso--erro" role="alert">
          {erro}
        </div>
      )}
      {semDados && <div className="painel__aviso">Nenhuma passagem registrada neste período.</div>}

      {/* Indicadores */}
      <section className="painel__kpis">
        <Indicador icone={Activity} rotulo="Passagens" valor={numero.format(analise.kpis.passagens)}
          detalhe={variosDias ? `${numero.format(Math.round(analise.kpis.passagens / analise.dias.length))} por dia em média` : null} />
        <Indicador icone={ArrowDown} rotulo="Entradas" valor={numero.format(analise.kpis.entradas)}
          detalhe={analise.picoEntrada?.total ? `Pico às ${analise.picoEntrada.rotulo}` : null} />
        <Indicador icone={ArrowUp} rotulo="Saídas" valor={numero.format(analise.kpis.saidas)}
          detalhe={analise.picoSaida?.total ? `Pico às ${analise.picoSaida.rotulo}` : null} />
        <Indicador icone={Users} rotulo="Pessoas distintas" valor={numero.format(analise.kpis.pessoasUnicas)} />
        <Indicador icone={UserCheck} rotulo="Na unidade agora" valor={numero.format(analise.kpis.presentesAgora)}
          detalhe="Última passagem hoje foi entrada" destaque />
        <Indicador icone={Timer} rotulo="Permanência média" valor={formatarDuracao(analise.kpis.permanenciaMediaMin)}
          detalhe="Entrada → saída no mesmo dia" />
      </section>

      <div className="painel__grade">
        {/* Horários de pico */}
        <section className="painel__cartao painel__cartao--largo">
          <div className="painel__cartao-topo">
            <div>
              <h2>Fluxo por horário do dia</h2>
              <p>Entradas e saídas somadas por hora em todo o período — mostra os horários de pico.</p>
            </div>
            {analise.picoEntrada?.total > 0 && (
              <div className="painel__picos">
                <span><i style={{ backgroundColor: COR_ENTRADA }} /> Pico de entrada: <b>{analise.picoEntrada.rotulo}</b> ({analise.picoEntrada.total})</span>
                {analise.picoSaida?.total > 0 && (
                  <span><i style={{ backgroundColor: COR_SAIDA }} /> Pico de saída: <b>{analise.picoSaida.rotulo}</b> ({analise.picoSaida.total})</span>
                )}
              </div>
            )}
          </div>
          <div className="painel__grafico">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analise.horas} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef2f6" />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.14)' }} content={<TooltipFluxo titulo={(d) => `${d.rotulo} – ${String(d.hora + 1).padStart(2, '0')}h`} />} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
                <Bar dataKey="entradas" name="Entradas" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="saidas" name="Saídas" fill={COR_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Movimento diário */}
        {variosDias && (
          <section className="painel__cartao painel__cartao--largo">
            <div className="painel__cartao-topo">
              <div>
                <h2>Movimento por dia</h2>
                <p>
                  Total de entradas e saídas em cada dia do período.
                  {diaMaisMovimentado && diaMaisMovimentado.entradas + diaMaisMovimentado.saidas > 0 && (
                    <> Dia mais movimentado: <b>{diaMaisMovimentado.semana}, {diaMaisMovimentado.rotulo}</b>.</>
                  )}
                </p>
              </div>
            </div>
            <div className="painel__grafico">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analise.dias} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f6" />
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={18} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={<TooltipFluxo titulo={(d) => `${d.semana}, ${d.rotulo} · ${d.pessoasUnicas} pessoas`} />} />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
                  <Line type="monotone" dataKey="entradas" name="Entradas" stroke={COR_ENTRADA} strokeWidth={2} dot={analise.dias.length <= 14 ? { r: 4, strokeWidth: 2, stroke: '#fff', fill: COR_ENTRADA } : false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: COR_ENTRADA }} />
                  <Line type="monotone" dataKey="saidas" name="Saídas" stroke={COR_SAIDA} strokeWidth={2} dot={analise.dias.length <= 14 ? { r: 4, strokeWidth: 2, stroke: '#fff', fill: COR_SAIDA } : false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: COR_SAIDA }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Mapa de calor */}
        <section className="painel__cartao painel__cartao--largo">
          <div className="painel__cartao-topo">
            <div>
              <h2>Concentração por dia da semana e horário</h2>
              <p>Quanto mais escuro, mais passagens (entradas + saídas) naquele dia e hora.</p>
            </div>
          </div>
          <div className="painel__calor-rolagem">
            <div className="painel__calor" style={{ gridTemplateColumns: `40px repeat(${horasCalor.length}, minmax(22px, 1fr))` }}>
              <span />
              {horasCalor.map((h) => (
                <span key={`h${h}`} className="painel__calor-hora">{String(h).padStart(2, '0')}</span>
              ))}
              {DIAS_SEMANA.map((dia, d) => (
                <div key={dia} className="painel__calor-linha">
                  <span className="painel__calor-dia">{dia}</span>
                  {horasCalor.map((h) => {
                    const valor = analise.calor.celulas[d][h];
                    const cor = corDoCalor(valor, analise.calor.maximo);
                    return (
                      <span
                        key={`${dia}${h}`}
                        className="painel__calor-celula"
                        style={cor ? { backgroundColor: cor } : undefined}
                        data-dica={`${dia} ${String(h).padStart(2, '0')}h: ${valor} passage${valor === 1 ? 'm' : 'ns'}`}
                        aria-label={`${dia} ${h} horas: ${valor} passagens`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="painel__calor-legenda" aria-hidden="true">
            <span>Menos</span>
            {RAMPA_CALOR.map((c) => <i key={c} style={{ backgroundColor: c }} />)}
            <span>Mais ({analise.calor.maximo})</span>
          </div>
        </section>

        {/* Mais frequentes */}
        <section className="painel__cartao">
          <div className="painel__cartao-topo">
            <div>
              <h2>Pessoas mais frequentes</h2>
              <p>Dias com presença no período.</p>
            </div>
          </div>
          {maisFrequentes.length === 0 ? (
            <p className="painel__vazio">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, maisFrequentes.length * 34)}>
              <BarChart data={maisFrequentes} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#334155' }} />
                <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.14)' }} content={<TooltipFluxo titulo={(d) => d.nomeCompleto} />} />
                <Bar dataKey="dias" name="Dias presentes" fill={COR_ENTRADA} radius={[0, 4, 4, 0]} maxBarSize={16}
                  label={{ position: 'right', fontSize: 11, fill: '#475569' }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Liberações manuais */}
        <section className="painel__cartao">
          <div className="painel__cartao-topo">
            <div>
              <h2>Liberações manuais</h2>
              <p>Catracas abertas pelo operador no período.</p>
            </div>
            <span className="painel__contador"><KeyRound size={14} /> {liberacoes.length}</span>
          </div>
          {liberacoes.length === 0 ? (
            <p className="painel__vazio">Nenhuma liberação manual no período.</p>
          ) : (
            <ul className="painel__liberacoes">
              {liberacoes.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <div>
                    <strong>{l.catracaNome ?? `Catraca ${l.catracaId}`}</strong>
                    <span>
                      {new Date(l.solicitadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {l.operador ? ` · ${l.operador}` : ''}
                      {l.motivo ? ` · ${l.motivo}` : ''}
                    </span>
                  </div>
                  <span className={`painel__status painel__status--${l.status}`}>
                    {l.status === 'confirmada' ? 'Confirmada' : l.status === 'expirada' ? 'Não confirmada' : 'Aguardando'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Entradas e saídas por pessoa */}
      <section className="painel__cartao painel__pessoas">
        <div className="painel__cartao-topo">
          <div>
            <h2>Entradas e saídas por pessoa</h2>
            <p>Clique em uma pessoa para ver cada entrada e saída no período.</p>
          </div>
          <div className="painel__busca">
            <Search size={15} />
            <input type="text" placeholder="Buscar por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>

        <div className="painel__tabela-rolagem">
          <table className="painel__tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Situação</th>
                <th className="num">Dias</th>
                <th className="num">Entradas</th>
                <th className="num">Saídas</th>
                <th>Chegada média</th>
                <th>Permanência média</th>
                <th>Última passagem</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={8} className="painel__vazio">Carregando...</td></tr>
              )}
              {!carregando && pessoasFiltradas.length === 0 && (
                <tr><td colSpan={8} className="painel__vazio">Nenhuma pessoa encontrada.</td></tr>
              )}
              {!carregando && pessoasFiltradas.map((p) => (
                <tr
                  key={p.chave}
                  className={pessoaAberta === p.chave ? 'painel__linha--ativa' : ''}
                  onClick={() => setPessoaAberta(pessoaAberta === p.chave ? null : p.chave)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setPessoaAberta(pessoaAberta === p.chave ? null : p.chave)}
                >
                  <td>
                    <span className="painel__nome">{p.nome}</span>
                    <span className="painel__cpf">CPF: {p.cpf}</span>
                  </td>
                  <td>
                    {p.dentroAgora ? (
                      <span className="painel__situacao painel__situacao--dentro"><DoorOpen size={13} /> Na unidade</span>
                    ) : (
                      <span className="painel__situacao">Fora</span>
                    )}
                  </td>
                  <td className="num">{p.dias}</td>
                  <td className="num">{p.entradas}</td>
                  <td className="num">{p.saidas}</td>
                  <td>{formatarMinutoDoDia(p.horarioMedioEntradaMin)}</td>
                  <td>{formatarDuracao(p.permanenciaMediaMin)}</td>
                  <td>
                    {p.ultimaPassagem.sentido === 'entrada' ? 'Entrada' : 'Saída'} ·{' '}
                    {p.ultimaPassagem.instante.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Linha do tempo da pessoa selecionada */}
      {pessoaSelecionada && (
        <div className="painel__gaveta-fundo" onClick={() => setPessoaAberta(null)}>
          <aside className="painel__gaveta" role="dialog" aria-modal="true" aria-label={`Passagens de ${pessoaSelecionada.nome}`} onClick={(e) => e.stopPropagation()}>
            <div className="painel__gaveta-topo">
              <div>
                <h3>{pessoaSelecionada.nome}</h3>
                <span>CPF: {pessoaSelecionada.cpf}</span>
              </div>
              <button type="button" className="painel__fechar" onClick={() => setPessoaAberta(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="painel__gaveta-resumo">
              <span><b>{pessoaSelecionada.dias}</b> dias</span>
              <span><b>{pessoaSelecionada.entradas}</b> entradas</span>
              <span><b>{pessoaSelecionada.saidas}</b> saídas</span>
              <span>Permanência média <b>{formatarDuracao(pessoaSelecionada.permanenciaMediaMin)}</b></span>
            </div>
            <ol className="painel__visitas">
              {[...pessoaSelecionada.visitas].reverse().map((v, i) => (
                <li key={i}>
                  <span className="painel__visita-dia">
                    {v.dia.split('-').reverse().join('/')}
                  </span>
                  <span className="painel__visita-horario">
                    <span className="painel__visita-marca painel__visita-marca--entrada"><ArrowDown size={12} /> {formatarHora(v.entrada)}</span>
                    <span className="painel__visita-seta">→</span>
                    <span className="painel__visita-marca painel__visita-marca--saida"><ArrowUp size={12} /> {v.saida ? formatarHora(v.saida) : 'sem saída'}</span>
                  </span>
                  <span className="painel__visita-duracao"><Clock3 size={12} /> {formatarDuracao(v.duracaoMin)}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}

export default PainelLogs;
