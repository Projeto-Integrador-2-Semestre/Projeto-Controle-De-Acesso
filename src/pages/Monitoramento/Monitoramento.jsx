import { useEffect, useMemo, useState } from 'react';
import {
    Search,
    RefreshCw,
    Activity,
    DoorOpen,
    ScanFace,
    Gauge,
    Wrench,
    RotateCw,
    Power,
    Video,
    Terminal,
    Download,
    Play,
    X,
    CheckCircle2,
    Loader2,
    MapPin,
    AlertTriangle,
    WifiOff,
} from 'lucide-react';
import {
    getEstacoes,
    getLogsDaEstacao,
    enviarPing,
    sincronizarFacial,
    testarGiro,
    reiniciarDispositivo,
    getBloqueioGeral,
    alterarBloqueioGeral,
    MONITORAMENTO_SIMULADO,
} from '../../services/MonitoramentoService';
import { mensagemDeErro } from '../../services/api.js';
import '../Monitoramento/Monitoramento.css';

// Com a API ligada a tela se atualiza sozinha (o totem é dado como offline após 10 s sem contato)
const INTERVALO_ATUALIZACAO_MS = 15000;

/** Média do ping (simulado) ou da latência da face_api medida pela API. null se ninguém respondeu. */
function calcularPingMedio(estacoes) {
    const valores = estacoes
        .map((e) => e.catraca.ping ?? e.facial.latenciaMs)
        .filter((v) => typeof v === 'number');
    if (valores.length === 0) return null;
    return Math.round(valores.reduce((acc, v) => acc + v, 0) / valores.length);
}

/** Busca estações e bloqueio geral juntos. Nunca rejeita: em caso de falha devolve { erro }. */
async function buscarTelemetria() {
    try {
        const [estacoes, bloqueio] = await Promise.all([getEstacoes(), getBloqueioGeral()]);
        return { estacoes, bloqueio };
    } catch (error) {
        return { erro: mensagemDeErro(error, 'Não foi possível carregar a telemetria.') };
    }
}

function horaAtual() {
    return new Date().toLocaleTimeString('pt-BR');
}

function Monitoramento() {
    const [estacoes, setEstacoes] = useState([]);
    const [carregando, setCarregando] = useState(true);

    const [busca, setBusca] = useState('');
    const [tipoFiltro, setTipoFiltro] = useState('todos'); // todos | catracas | facial
    const [statusFiltro, setStatusFiltro] = useState('todos'); // todos | online | sincronizando | alerta

    const [toast, setToast] = useState({ visivel: false, mensagem: '', Icone: CheckCircle2, cor: '#34d399' });
    const [drawer, setDrawer] = useState(null); // estação aberta no painel lateral
    const [logsDrawer, setLogsDrawer] = useState([]);
    const [erroCarga, setErroCarga] = useState('');
    const [atualizadoAs, setAtualizadoAs] = useState('');
    const [bloqueio, setBloqueio] = useState({ ativo: false });

    function aplicarTelemetria(resultado) {
        if (resultado.erro) {
            setErroCarga(resultado.erro);
        } else {
            setEstacoes(resultado.estacoes);
            setBloqueio(resultado.bloqueio);
            setErroCarga('');
            setAtualizadoAs(horaAtual());
        }
        setCarregando(false);
    }

    function carregar() {
        return buscarTelemetria().then(aplicarTelemetria);
    }

    useEffect(() => {
        let ativo = true;
        const atualizar = () => buscarTelemetria().then((resultado) => ativo && aplicarTelemetria(resultado));
        atualizar();
        const timer = MONITORAMENTO_SIMULADO ? null : setInterval(atualizar, INTERVALO_ATUALIZACAO_MS);
        return () => {
            ativo = false;
            if (timer) clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        function aoPressionarTecla(e) {
            if (e.key === 'Escape') fecharDrawer();
        }
        document.addEventListener('keydown', aoPressionarTecla);
        return () => document.removeEventListener('keydown', aoPressionarTecla);
    }, []);

    function mostrarToast(mensagem, Icone = CheckCircle2, cor = '#34d399') {
        setToast({ visivel: true, mensagem, Icone, cor });
        setTimeout(() => setToast((t) => ({ ...t, visivel: false })), 3200);
    }

    function mostrarErro(error, padrao) {
        mostrarToast(mensagemDeErro(error, padrao), AlertTriangle, '#f59e0b');
    }

    async function handlePing(estacao, parte) {
        try {
            const r = await enviarPing(estacao);
            if (parte === 'facial') {
                if (r.reconhecimentoOnline) {
                    mostrarToast(`face_api respondeu em ${r.latenciaReconhecimentoMs} ms (${estacao.facial.nome}).`, Activity, '#34d399');
                } else {
                    mostrarToast('A face_api não respondeu ao ping.', WifiOff, '#ef4444');
                }
            } else if (r.totemOnline) {
                mostrarToast(`Totem da ${estacao.catraca.nome} respondeu há ${r.segundosDesdeContato} s.`, Activity, '#34d399');
            } else {
                mostrarToast(
                    r.segundosDesdeContato === null
                        ? `O totem da ${estacao.catraca.nome} nunca consultou a API.`
                        : `Totem da ${estacao.catraca.nome} sem contato há ${r.segundosDesdeContato} s.`,
                    WifiOff,
                    '#ef4444'
                );
            }
        } catch (error) {
            mostrarErro(error, 'Não foi possível enviar o ping.');
        }
    }

    async function handlePingGeral() {
        mostrarToast('Ping geral em andamento...', Activity, '#60a5fa');
        try {
            const respostas = await Promise.all(estacoes.map((e) => enviarPing(e)));
            const online = respostas.filter((r) => r.totemOnline).length;
            const latencias = respostas.map((r) => r.latenciaReconhecimentoMs).filter((v) => typeof v === 'number');
            const media = latencias.length ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length) : null;
            mostrarToast(
                `Ping geral: ${online} de ${estacoes.length} totens respondendo` +
                    (media === null ? '; face_api sem resposta.' : `; face_api em ${media} ms.`),
                Activity,
                online === estacoes.length ? '#34d399' : '#f59e0b'
            );
        } catch (error) {
            mostrarErro(error, 'Não foi possível concluir o ping geral.');
        }
    }

    async function handleSincronizarFacial(estacao) {
        try {
            const r = await sincronizarFacial(estacao);
            mostrarToast(
                `Base de rostos atualizada: ${r.embeddings_em_cache ?? '?'} em cache, ${r.novos_ou_atualizados ?? 0} novos ou alterados.`,
                RefreshCw,
                '#34d399'
            );
            carregar();
        } catch (error) {
            mostrarErro(error, 'Não foi possível sincronizar a base de rostos.');
        }
    }

    async function handleSincronizarFacialGeral() {
        if (estacoes.length === 0) return;
        mostrarToast('Sincronizando a base de rostos...', RefreshCw, '#60a5fa');
        // A face_api é uma só para todas as estações: basta pedir uma vez
        await handleSincronizarFacial(estacoes[0]);
    }

    async function handleTestarGiro(estacao) {
        try {
            await testarGiro(estacao);
            mostrarToast(`Comando de teste de giro eletromecânico disparado em [${estacao.catraca.nome}].`, RotateCw, '#f59e0b');
        } catch (error) {
            mostrarErro(error, 'Não foi possível testar o giro.');
        }
    }

    async function handleTestarGiroGeral() {
        if (estacoes.length === 0) return;
        try {
            await Promise.all(estacoes.map((e) => testarGiro(e)));
            mostrarToast('Rotina de teste mecânico executada em todas as catracas.', RotateCw, '#f59e0b');
        } catch (error) {
            mostrarErro(error, 'Não foi possível testar o giro.');
        }
    }

    async function handleReiniciar(estacao) {
        const confirmado = window.confirm(
            `Confirma o comando de reinício remoto seguro para o equipamento: ${estacao.catraca.nome}?`
        );
        if (!confirmado) return;
        try {
            await reiniciarDispositivo(estacao);
            mostrarToast(`Reinicialização remota disparada em [${estacao.catraca.nome}].`, Power, '#e53e3e');
        } catch (error) {
            mostrarErro(error, 'Não foi possível reiniciar o equipamento.');
        }
    }

    async function handleBloqueioGeral() {
        const ativar = !bloqueio.ativo;
        const confirmado = window.confirm(
            ativar
                ? 'ATENÇÃO: Deseja acionar o BLOQUEIO GERAL de emergência de todas as catracas físicas?'
                : 'Deseja DESATIVAR o bloqueio geral e normalizar o acesso?'
        );
        if (!confirmado) return;
        try {
            const estado = await alterarBloqueioGeral(ativar);
            setBloqueio(estado);
            setEstacoes((atual) => atual.map((e) => ({ ...e, bloqueioGeral: estado.ativo })));
            if (estado.ativo) {
                mostrarToast('BLOQUEIO GERAL ATIVADO! Reconhecimento e liberações manuais suspensos.', Power, '#ef4444');
            } else {
                mostrarToast('Bloqueio geral desativado. Acesso normalizado.', CheckCircle2, '#34d399');
            }
        } catch (error) {
            mostrarErro(error, 'Não foi possível alterar o bloqueio geral.');
        }
    }

    function handleVerVideo(estacao) {
        if (!MONITORAMENTO_SIMULADO) {
            mostrarToast('Sem transmissão de vídeo: a câmera é a do próprio tablet do totem.', Video, '#f59e0b');
            return;
        }
        mostrarToast(`Conectando feed de vídeo HD de [${estacao.facial.nome}] (${estacao.facial.ip}:554)...`, Video, '#60a5fa');
    }

    async function handleAtualizarTudo() {
        mostrarToast('Atualizando telemetria em tempo real...', RefreshCw, '#60a5fa');
        await carregar();
        mostrarToast('Dados de todas as catracas e terminais faciais atualizados!', CheckCircle2, '#34d399');
    }

    async function abrirDrawer(estacao) {
        setDrawer(estacao);
        setLogsDrawer([]);
        try {
            setLogsDrawer(await getLogsDaEstacao(estacao));
        } catch (error) {
            mostrarErro(error, 'Não foi possível carregar o syslog da estação.');
        }
    }

    function fecharDrawer() {
        setDrawer(null);
    }

    /** Baixa o syslog aberto no painel lateral como arquivo .log. */
    function exportarLog() {
        if (!drawer) return;
        const linhas = logsDrawer.map((log) => `${log.hora}  ${log.titulo}  ${log.texto}`);
        const arquivo = new Blob([`Syslog - ${drawer.nome}\n\n${linhas.join('\n')}\n`], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(arquivo);
        link.download = `syslog-estacao-${drawer.numero}.log`;
        link.click();
        URL.revokeObjectURL(link.href);
        mostrarToast('Arquivo Syslog (.LOG) exportado com sucesso.', Download, '#60a5fa');
    }

    function pulsoDeTeste() {
        if (drawer) handleTestarGiro(drawer);
    }

    const estacoesFiltradas = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        return estacoes.filter((e) => {
            const textoCombinado = `${e.nome} ${e.descricao} ${e.catraca.nome} ${e.catraca.ip} ${e.facial.nome} ${e.facial.ip}`.toLowerCase();
            const combinaBusca = termo === '' || textoCombinado.includes(termo);

            let combinaStatus = true;
            if (statusFiltro === 'online') combinaStatus = e.statusGeral === 'operacional';
            else if (statusFiltro === 'sincronizando') combinaStatus = e.statusGeral === 'sincronizando';
            else if (statusFiltro === 'alerta') combinaStatus = e.statusGeral === 'alerta';

            return combinaBusca && combinaStatus;
        });
    }, [estacoes, busca, statusFiltro]);

    const catracasOnline = estacoes.filter((e) => e.catraca.status === 'online').length;
    const terminaisAtivos = estacoes.filter((e) => e.facial.status !== 'offline').length;
    const terminaisOffline = estacoes.length - terminaisAtivos;
    const pingMedio = calcularPingMedio(estacoes);

    return (
        <div className="monitoramento">
            {/* Cabeçalho */}
            <div className="mon__cabecalho">
                <div>
                    <div className="mon__titulo-linha">
                        <h1>Monitoramento de Dispositivos &amp; Catracas</h1>
                        <span className="mon__selo-campus">Campus Sorocaba</span>
                        <span className="mon__selo-pontos">{estacoes.length} Pontos de Acesso Integrados</span>
                        {MONITORAMENTO_SIMULADO && (
                            <span
                                className="mon__selo-simulado"
                                title="A API ainda não tem os endpoints de dispositivos. Os dados e as ações desta tela são simulados."
                            >
                                Dados simulados
                            </span>
                        )}
                    </div>
                    <p className="mon__subtitulo">
                        Telemetria e status em tempo real das catracas físicas e dos terminais de biometria facial
                        acoplados da Unidade Sorocaba.
                        {MONITORAMENTO_SIMULADO ? (
                            <span className="mon__sync-ativo">
                                <span className="pulso" /> Sync Ativo: ws://telemetry.sorocaba.senai.br:8443
                            </span>
                        ) : (
                            <span className="mon__sync-ativo">
                                <span className="pulso" /> Atualização automática a cada 15 s
                                {atualizadoAs && ` • última às ${atualizadoAs}`}
                            </span>
                        )}
                    </p>
                </div>

                <div className="mon__acoes-topo">
                    <button className="botao botao--outline" onClick={handlePingGeral}>
                        <Activity size={16} />
                        Ping Geral
                    </button>
                    <button className="botao botao--primario" onClick={handleSincronizarFacialGeral}>
                        <RefreshCw size={16} />
                        Sincronizar Terminais Faciais
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="mon__kpis">
                <div className="mon__kpi mon__kpi--vermelho">
                    <div className="mon__kpi-topo">
                        <div>
                            <span className="mon__kpi-rotulo">Equipamento Mecânico</span>
                            <h3>Catracas Físicas</h3>
                        </div>
                        <span className="mon__kpi-icone mon__kpi-icone--vermelho">
                            <DoorOpen size={20} />
                        </span>
                    </div>
                    <div className="mon__kpi-valor-linha">
                        <span className="mon__kpi-valor">
                            {catracasOnline} / {estacoes.length}
                        </span>
                        <span className="mon__kpi-nota mon__kpi-nota--verde">
                            {estacoes.length > 0 ? Math.round((catracasOnline / estacoes.length) * 100) : 0}% Prontas
                        </span>
                    </div>
                    <div className="mon__kpi-rodape">
                        <span>Catracas monitoradas em tempo real</span>
                        <span className="mon__kpi-rodape-forte">{MONITORAMENTO_SIMULADO ? 'Relês OK' : 'Relé não instalado'}</span>
                    </div>
                </div>

                <div className="mon__kpi mon__kpi--verde">
                    <div className="mon__kpi-topo">
                        <div>
                            <span className="mon__kpi-rotulo">Dispositivos Acoplados</span>
                            <h3>Terminais de Biometria Facial</h3>
                        </div>
                        <span className="mon__kpi-icone mon__kpi-icone--verde">
                            <ScanFace size={20} />
                        </span>
                    </div>
                    <div className="mon__kpi-valor-linha">
                        <span className="mon__kpi-valor mon__kpi-valor--verde">{terminaisAtivos}</span>
                        <span className="mon__kpi-nota mon__kpi-nota--verde">
                            {MONITORAMENTO_SIMULADO ? '99,8% Sincronia' : terminaisOffline === 0 ? 'Reconhecendo' : 'Com falha'}
                        </span>
                    </div>
                    <div className="mon__kpi-rodape">
                        <span>{MONITORAMENTO_SIMULADO ? '1.428 faces sincronizadas' : estacoes[0]?.facial.bancoFaces ?? '—'}</span>
                        <span className="mon__kpi-rodape-forte">{terminaisOffline} Offline</span>
                    </div>
                </div>

                <div className="mon__kpi">
                    <div className="mon__kpi-topo">
                        <div>
                            <span className="mon__kpi-rotulo">Rede &amp; Telemetria</span>
                            <h3>Status Geral da Conexão</h3>
                        </div>
                        <span className="mon__kpi-icone mon__kpi-icone--azul">
                            <Gauge size={20} />
                        </span>
                    </div>
                    <div className="mon__kpi-valor-linha">
                        <span className="mon__kpi-valor">
                            {pingMedio ?? '—'}
                            <small>{MONITORAMENTO_SIMULADO ? ' ms ping médio' : ' ms face_api'}</small>
                        </span>
                        <span className="mon__kpi-nota mon__kpi-nota--verde">
                            {pingMedio === null ? 'Sem resposta' : <><span className="ponto ponto--verde" /> Conectado</>}
                        </span>
                    </div>
                    <div className="mon__kpi-rodape">
                        <span>{MONITORAMENTO_SIMULADO ? 'Sub-rede: 192.168.10.0/24' : 'Latência medida pela API'}</span>
                        <span className="mon__kpi-rodape-forte">Taxa Instantânea</span>
                    </div>
                </div>

                <div className="mon__kpi mon__kpi--diagnostico">
                    <div className="mon__kpi-topo">
                        <span className="mon__kpi-rotulo">Diagnóstico Operacional</span>
                        <Wrench size={18} color="#e53e3e" />
                    </div>
                    <div className="mon__diagnostico-grade">
                        <button onClick={handlePingGeral}>
                            <Activity size={14} />
                            Ping Geral
                        </button>
                        <button onClick={handleTestarGiroGeral}>
                            <RotateCw size={14} />
                            Testar Giro
                        </button>
                    </div>
                    <button className="mon__diagnostico-sync" onClick={handleSincronizarFacialGeral}>
                        <RefreshCw size={14} />
                        Forçar Sincronização Facial
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="mon__filtros">
                <div className="mon__busca">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por IP (ex: 192.168.10.x), nome ou local da passagem..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                    />
                </div>

                <div className="mon__filtros-direita">
                    <div className="mon__tipo-filtro">
                        <button className={tipoFiltro === 'todos' ? 'ativo' : ''} onClick={() => setTipoFiltro('todos')}>
                            Todos ({estacoes.length} Estações)
                        </button>
                        <button className={tipoFiltro === 'catracas' ? 'ativo' : ''} onClick={() => setTipoFiltro('catracas')}>
                            Somente Catracas
                        </button>
                        <button className={tipoFiltro === 'facial' ? 'ativo' : ''} onClick={() => setTipoFiltro('facial')}>
                            Somente Biometria Facial
                        </button>
                    </div>

                    <div className="mon__status-select">
                        <label>Status:</label>
                        <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
                            <option value="todos">Todos os Status</option>
                            <option value="online">Online / Ativos</option>
                            <option value="sincronizando">Sincronizando</option>
                            <option value="alerta">Com Alerta / Falha</option>
                        </select>
                    </div>

                    <button className="mon__botao-refresh" onClick={handleAtualizarTudo} title="Recarregar Telemetria">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Lista de estações */}
            <div className="mon__secao-estacoes">
                <div className="mon__secao-titulo">
                    <MapPin size={20} color="#e53e3e" />
                    <h2>Estações de Passagem • Catraca + Terminal Facial Acoplado</h2>
                </div>

                {carregando && <div className="mon__estado-vazio">Carregando telemetria...</div>}
                {erroCarga && <div className="mon__estado-vazio mon__estado-erro" role="alert">{erroCarga}</div>}
                {!carregando && !erroCarga && estacoesFiltradas.length === 0 && (
                    <div className="mon__estado-vazio">Nenhuma estação encontrada para esse filtro.</div>
                )}

                <div className="mon__lista-estacoes">
                    {estacoesFiltradas.map((e) => (
                        <div className="mon__card-estacao" key={e.id}>
                            <div className="mon__card-banner">
                                <div className="mon__card-banner-esquerda">
                                    <span className="mon__numero">{e.numero}</span>
                                    <div>
                                        <h3>{e.nome}</h3>
                                        <span className="mon__descricao">{e.descricao}</span>
                                    </div>
                                </div>
                                <div className="mon__card-banner-direita">
                                    {e.statusGeral === 'operacional' && (
                                        <span className="selo-status selo-status--verde">
                                            <span className="pulso pulso--verde" /> ESTAÇÃO 100% OPERACIONAL
                                        </span>
                                    )}
                                    {e.statusGeral === 'sincronizando' && (
                                        <span className="selo-status selo-status--ambar">
                                            <span className="pulso pulso--ambar" /> SINCRONIZANDO BIOMETRIA
                                            {e.facial.progressoSync !== null && ` (${e.facial.progressoSync}%)`}
                                        </span>
                                    )}
                                    {e.statusGeral === 'alerta' && (
                                        <span className="selo-status selo-status--vermelho">
                                            <AlertTriangle size={12} /> ESTAÇÃO COM ALERTA
                                        </span>
                                    )}
                                    <button className="botao botao--outline botao--pequeno" onClick={() => abrirDrawer(e)}>
                                        <Terminal size={15} />
                                        Syslog da Estação
                                    </button>
                                </div>
                            </div>

                            <div className="mon__card-corpo">
                                {(tipoFiltro === 'todos' || tipoFiltro === 'catracas') && (
                                    <div className="mon__hardware">
                                        <div className="mon__hardware-topo">
                                            <div className="mon__hardware-info">
                                                <span className="mon__hardware-icone mon__hardware-icone--vermelho">
                                                    <DoorOpen size={22} />
                                                </span>
                                                <div>
                                                    <div className="mon__hardware-nome-linha">
                                                        <strong>{e.catraca.nome}</strong>
                                                        <span className="etiqueta">{e.catraca.tipo}</span>
                                                    </div>
                                                    <span className="mon__hardware-modelo">
                                                        {e.catraca.modelo} •{' '}
                                                        {MONITORAMENTO_SIMULADO ? 'Travada pronta'
                                                            : e.catraca.status === 'online' ? 'Totem respondendo' : 'Totem sem contato'}
                                                    </span>
                                                </div>
                                            </div>
                                            {e.catraca.status === 'online' ? (
                                                <span className="selo-status selo-status--verde-solido">
                                                    <span className="ponto ponto--verde" /> ONLINE
                                                </span>
                                            ) : (
                                                <span className="selo-status selo-status--vermelho-solido">
                                                    <WifiOff size={12} /> OFFLINE
                                                </span>
                                            )}
                                        </div>

                                        <div className="mon__specs">
                                            <div>
                                                <span>Endereço IP</span>
                                                <strong>{e.catraca.ip}</strong>
                                            </div>
                                            <div>
                                                <span>Porta TCP</span>
                                                <strong>{e.catraca.porta}</strong>
                                            </div>
                                            <div>
                                                <span>Ciclos / Giros</span>
                                                <strong>{e.catraca.ciclos}</strong>
                                            </div>
                                            <div>
                                                <span>Relê Eletromecânico</span>
                                                <strong className={MONITORAMENTO_SIMULADO ? 'verde' : 'ambar'}>{e.catraca.rele}</strong>
                                            </div>
                                        </div>

                                        <div className="mon__hardware-rodape">
                                            <span>
                                                {e.catraca.ping !== null ? (
                                                    <>Ping: <strong className="verde">{e.catraca.ping}ms</strong> • Firmware {e.catraca.firmware}</>
                                                ) : (
                                                    <>Último contato: <strong className={e.catraca.status === 'online' ? 'verde' : 'ambar'}>{e.catraca.contato}</strong></>
                                                )}
                                            </span>
                                            <div className="mon__hardware-botoes">
                                                <button onClick={() => handlePing(e, 'catraca')}>
                                                    <Activity size={14} />
                                                    Ping
                                                </button>
                                                <button onClick={() => handleTestarGiro(e)}>
                                                    <RotateCw size={14} />
                                                    Testar Giro
                                                </button>
                                                <button className="perigo" onClick={() => handleReiniciar(e)}>
                                                    <Power size={14} />
                                                    Reiniciar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(tipoFiltro === 'todos' || tipoFiltro === 'facial') && (
                                    <div className="mon__hardware">
                                        <div className="mon__hardware-topo">
                                            <div className="mon__hardware-info">
                                                <span
                                                    className={`mon__hardware-icone ${e.facial.status === 'sincronizando'
                                                            ? 'mon__hardware-icone--ambar'
                                                            : e.facial.status === 'offline'
                                                                ? 'mon__hardware-icone--vermelho'
                                                                : 'mon__hardware-icone--verde'
                                                        }`}
                                                >
                                                    {e.facial.status === 'sincronizando' ? (
                                                        <Loader2 size={22} className="girando" />
                                                    ) : (
                                                        <ScanFace size={22} />
                                                    )}
                                                </span>
                                                <div>
                                                    <div className="mon__hardware-nome-linha">
                                                        <strong>{e.facial.nome}</strong>
                                                        <span className="etiqueta etiqueta--verde">Acoplado Superior</span>
                                                    </div>
                                                    <span className="mon__hardware-modelo">
                                                        {e.facial.modelo} •{' '}
                                                        {e.facial.status === 'sincronizando' ? 'Atualizando base de dados'
                                                            : e.facial.status === 'offline'
                                                                ? e.catraca.status === 'offline' ? 'Câmera do totem sem contato' : 'Sem resposta'
                                                                : 'Reconhecendo ativo'}
                                                    </span>
                                                </div>
                                            </div>
                                            {e.facial.status === 'reconhecendo' && (
                                                <span className="selo-status selo-status--verde-solido">
                                                    <span className="ponto ponto--verde" /> RECONHECENDO
                                                </span>
                                            )}
                                            {e.facial.status === 'sincronizando' && (
                                                <span className="selo-status selo-status--ambar-solido">
                                                    <RefreshCw size={12} className="girando" /> SYNC
                                                    {e.facial.progressoSync !== null && ` (${e.facial.progressoSync}%)`}
                                                </span>
                                            )}
                                            {e.facial.status === 'offline' && (
                                                <span className="selo-status selo-status--vermelho-solido">
                                                    <WifiOff size={12} /> OFFLINE
                                                </span>
                                            )}
                                        </div>

                                        <div className="mon__specs">
                                            <div>
                                                <span>IP Câmera</span>
                                                <strong>{e.facial.ip}</strong>
                                            </div>
                                            <div>
                                                <span>Stream RTSP</span>
                                                <strong>{e.facial.stream}</strong>
                                            </div>
                                            <div>
                                                <span>Precisão IA</span>
                                                <strong className="verde">{e.facial.precisao}</strong>
                                            </div>
                                            <div>
                                                <span>Banco de Faces</span>
                                                <strong className={e.facial.progressoSync ? 'ambar' : ''}>{e.facial.bancoFaces}</strong>
                                            </div>
                                        </div>

                                        <div className="mon__hardware-rodape">
                                            <span>
                                                {e.facial.ultimaSync ? (
                                                    <>
                                                        {MONITORAMENTO_SIMULADO ? 'Sincronizado: ' : ''}<strong>{e.facial.ultimaSync}</strong>
                                                    </>
                                                ) : (
                                                    <strong className="ambar">
                                                        {MONITORAMENTO_SIMULADO ? 'Upload em andamento' : 'face_api sem resposta'}
                                                    </strong>
                                                )}
                                            </span>
                                            <div className="mon__hardware-botoes">
                                                <button onClick={() => handlePing(e, 'facial')}>
                                                    <Activity size={14} />
                                                    Ping
                                                </button>
                                                <button onClick={() => handleVerVideo(e)}>
                                                    <Video size={14} />
                                                    Ver Vídeo
                                                </button>
                                                <button className="destaque" onClick={() => handleSincronizarFacial(e)}>
                                                    <RefreshCw size={14} />
                                                    Sincronizar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rodapé técnico */}
            <div className="mon__rodape-matriz">
                <div className="mon__rodape-esquerda">
                    {bloqueio.ativo ? (
                        <span className="mon__rodape-ok mon__rodape-bloqueio">
                            <AlertTriangle size={14} /> Bloqueio geral ATIVO: reconhecimento e liberações suspensos
                        </span>
                    ) : (
                        <span className="mon__rodape-ok">
                            <span className="ponto ponto--verde" /> Todas as Catracas Liberadas para Giro Autorizado
                        </span>
                    )}
                    <span className="mon__rodape-separador">•</span>
                    {MONITORAMENTO_SIMULADO ? (
                        <span>
                            Anti-Passback Central: <strong>Ativado (5 min)</strong>
                        </span>
                    ) : (
                        <span>
                            Totens online: <strong>{catracasOnline} de {estacoes.length}</strong>
                        </span>
                    )}
                </div>
                <div className="mon__rodape-direita">
                    <span>
                        Tempo de Resposta Facial Médio:{' '}
                        <strong className="vermelho">
                            {MONITORAMENTO_SIMULADO ? '0.24s' : pingMedio === null ? '—' : `${pingMedio} ms`}
                        </strong>
                    </span>
                    <span>
                        {MONITORAMENTO_SIMULADO ? <>Firmware Facial: <strong>v2.4.18-SENAI</strong></>
                            : <>Reconhecimento: <strong>face_api (InsightFace)</strong></>}
                    </span>
                </div>
            </div>

            {/* Botão de bloqueio geral (ação crítica, fica sempre acessível) */}
            <button
                className={`mon__bloqueio-flutuante ${bloqueio.ativo ? 'mon__bloqueio-flutuante--ativo' : ''}`}
                onClick={handleBloqueioGeral}
            >
                <Power size={16} />
                {bloqueio.ativo ? 'Desativar Bloqueio Geral' : 'Bloqueio Geral de Catracas'}
            </button>

            {/* Drawer lateral de syslog */}
            {drawer && (
                <div className="drawer">
                    <div className="drawer__fundo" onClick={fecharDrawer} />
                    <div className="drawer__painel">
                        <div className="drawer__topo">
                            <div className="drawer__topo-linha">
                                <span className="drawer__topo-rotulo">
                                    <Terminal size={16} />
                                    Syslog do Par: Catraca &amp; Facial
                                </span>
                                <button className="drawer__fechar" onClick={fecharDrawer}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2>{drawer.nome}</h2>
                            <div className="drawer__ips">
                                <span>Catraca: {drawer.catraca.ip}</span>
                                <span>Facial: {drawer.facial.ip}</span>
                            </div>
                        </div>

                        <div className="drawer__logs">
                            <div className="drawer__logs-topo">
                                <span>EVENT LOG BUFFER (CATRACA + CÂMERA FACIAL)</span>
                                <span className="drawer__live">
                                    <span className="pulso pulso--verde" /> LIVE
                                </span>
                            </div>

                            {logsDrawer.length === 0 && (
                                <div className="drawer__log drawer__log--heartbeat">
                                    <p>Nenhum evento registrado para esta estação.</p>
                                </div>
                            )}
                            {logsDrawer.map((log, i) => (
                                <div key={i} className={`drawer__log drawer__log--${log.tipo}`}>
                                    <div className="drawer__log-topo">
                                        <strong>{log.titulo}</strong>
                                        <span>{log.hora}</span>
                                    </div>
                                    <p>{log.texto}</p>
                                </div>
                            ))}
                        </div>

                        <div className="drawer__rodape">
                            <button className="botao botao--outline" onClick={exportarLog}>
                                <Download size={16} />
                                Exportar .LOG
                            </button>
                            <button className="botao botao--primario" onClick={pulsoDeTeste}>
                                <Play size={16} />
                                Pulso de Teste
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            <div className={`toast-monitor ${toast.visivel ? 'toast-monitor--visivel' : ''}`}>
                <toast.Icone size={18} color={toast.cor} />
                <span>{toast.mensagem}</span>
            </div>
        </div>
    );
}

export default Monitoramento;