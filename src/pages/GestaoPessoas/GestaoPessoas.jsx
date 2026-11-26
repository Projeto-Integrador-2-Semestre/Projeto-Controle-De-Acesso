import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Home,
    ChevronRight,
    CircleCheck,
    Search,
    SlidersHorizontal,
    Download,
    UserPlus,
    ScanFace,
    Pencil,
    Lock,
    Unlock,
    ChevronLeft,
    Trash2,
    X,
} from 'lucide-react';
import {
    getPessoas,
    atualizarPessoa,
    excluirPessoa,
    alterarStatusAcesso,
    RECURSOS_PESSOAS,
} from '../../services/PessoasService.js';
import { mensagemDeErro } from '../../services/api.js';
import './GestaoPessoas.css';

const ITENS_POR_PAGINA = 10;
const CORES_AVATAR = ['#e53e3e', '#2563eb', '#059669', '#9333ea', '#d97706', '#0891b2'];

function formatarHoraAtual() {
    const agora = new Date();
    return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
}

function iniciais(nome) {
    const partes = nome.trim().split(' ');
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function corAvatar(nome) {
    const soma = nome.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return CORES_AVATAR[soma % CORES_AVATAR.length];
}

function GestaoPessoas() {
    const [pessoas, setPessoas] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [pagina, setPagina] = useState(1);
    const [sincronizadoAs, setSincronizadoAs] = useState(() => formatarHoraAtual());
    const [erro, setErro] = useState('');
    const [pessoaEmEdicao, setPessoaEmEdicao] = useState(null);
    const [nomeEdicao, setNomeEdicao] = useState('');
    const [fotoEdicao, setFotoEdicao] = useState(null);
    const [pessoaParaExcluir, setPessoaParaExcluir] = useState(null);
    const [erroAcao, setErroAcao] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [excluindo, setExcluindo] = useState(false);

    useEffect(() => {
        getPessoas()
            .then((dados) => {
                setPessoas(dados);
                setSincronizadoAs(formatarHoraAtual());
            })
            .catch((error) => setErro(mensagemDeErro(error, 'Não foi possível carregar as pessoas.')))
            .finally(() => setCarregando(false));
    }, []);

    const totalLiberados = pessoas.filter((p) => p.status === 'liberado').length;
    const totalBloqueados = pessoas.filter((p) => p.status === 'bloqueado').length;

    const pessoasFiltradas = useMemo(() => {
        return pessoas.filter((p) => {
            const combinaStatus = filtroStatus === 'todos' || p.status === filtroStatus;
            const termo = busca.trim().toLowerCase();
            const combinaBusca =
                termo === '' || p.nome.toLowerCase().includes(termo) || p.cpf.includes(termo);
            return combinaStatus && combinaBusca;
        });
    }, [pessoas, filtroStatus, busca]);

    const totalPaginas = Math.max(1, Math.ceil(pessoasFiltradas.length / ITENS_POR_PAGINA));
    const paginaAtual = Math.min(pagina, totalPaginas);
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const pessoasDaPagina = pessoasFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);

    function mudarFiltro(novoFiltro) {
        setFiltroStatus(novoFiltro);
        setPagina(1);
    }

    function mudarBusca(valor) {
        setBusca(valor);
        setPagina(1);
    }

    async function alternarBloqueio(pessoa) {
        const novoStatus = pessoa.status === 'liberado' ? 'bloqueado' : 'liberado';
        try {
            const atualizada = await alterarStatusAcesso(pessoa.id, novoStatus);
            setPessoas((atual) => atual.map((p) => (p.id === atualizada.id ? atualizada : p)));
        } catch (error) {
            setErro(mensagemDeErro(error, 'Não foi possível alterar o acesso.'));
        }
    }

    function abrirEdicao(pessoa) {
        setPessoaEmEdicao(pessoa);
        setNomeEdicao(pessoa.nome);
        setFotoEdicao(null);
        setErroAcao('');
    }

    function fecharEdicao() {
        if (salvando) return;
        setPessoaEmEdicao(null);
        setFotoEdicao(null);
        setErroAcao('');
    }

    async function salvarEdicao(event) {
        event.preventDefault();
        const nome = nomeEdicao.trim();
        if (!nome) {
            setErroAcao('Informe o nome da pessoa.');
            return;
        }

        const dados = new FormData();
        dados.append('nome', nome);
        if (fotoEdicao) dados.append('foto', fotoEdicao);

        setSalvando(true);
        setErroAcao('');
        try {
            await atualizarPessoa(pessoaEmEdicao.cpf, dados);
            setPessoas((atual) => atual.map((p) => (
                p.id === pessoaEmEdicao.id
                    ? { ...p, nome, possuiFoto: fotoEdicao ? true : p.possuiFoto }
                    : p
            )));
            setSincronizadoAs(formatarHoraAtual());
            setPessoaEmEdicao(null);
            setFotoEdicao(null);
        } catch (error) {
            setErroAcao(mensagemDeErro(error, 'Não foi possível atualizar a pessoa.'));
        } finally {
            setSalvando(false);
        }
    }

    async function confirmarExclusao() {
        if (!pessoaParaExcluir) return;
        setExcluindo(true);
        setErroAcao('');
        try {
            await excluirPessoa(pessoaParaExcluir.cpf);
            setPessoas((atual) => atual.filter((p) => p.id !== pessoaParaExcluir.id));
            setSincronizadoAs(formatarHoraAtual());
            setPessoaParaExcluir(null);
        } catch (error) {
            setErroAcao(mensagemDeErro(error, 'Não foi possível excluir a pessoa.'));
        } finally {
            setExcluindo(false);
        }
    }

    function numerosPagina() {
        const numeros = [];
        const janela = 1;
        for (let n = 1; n <= totalPaginas; n++) {
            const pertoDoInicio = n === 1;
            const pertoDoFim = n === totalPaginas;
            const pertoDaAtual = Math.abs(n - paginaAtual) <= janela;
            if (pertoDoInicio || pertoDoFim || pertoDaAtual) {
                numeros.push(n);
            } else if (numeros[numeros.length - 1] !== '...') {
                numeros.push('...');
            }
        }
        return numeros;
    }

    return (
            <div className="gestao">
            {pessoaEmEdicao && (
                <div className="modal__overlay" onClick={fecharEdicao}>
                    <form
                        className="modal__container gestao__modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="gestao-editar-titulo"
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={salvarEdicao}
                    >
                        <div className="modal__header">
                            <div>
                                <span className="modal__eyebrow">Cadastro de pessoa</span>
                                <h2 id="gestao-editar-titulo">Editar pessoa</h2>
                            </div>
                            <button
                                type="button"
                                className="modal__fechar"
                                onClick={fecharEdicao}
                                disabled={salvando}
                                aria-label="Fechar edição"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="modal__descricao">
                            Atualize o nome ou envie uma nova foto. O CPF identifica o cadastro e não pode ser alterado.
                        </p>

                        <label className="modal__campo">
                            <span>CPF</span>
                            <input type="text" value={pessoaEmEdicao.cpf} readOnly />
                        </label>
                        <label className="modal__campo">
                            <span>Nome completo</span>
                            <input
                                type="text"
                                value={nomeEdicao}
                                onChange={(event) => setNomeEdicao(event.target.value)}
                                maxLength={150}
                                autoFocus
                                required
                            />
                        </label>
                        <label className="modal__campo">
                            <span>Nova foto (opcional)</span>
                            <input
                                type="file"
                                accept="image/jpeg,image/jpg"
                                onChange={(event) => setFotoEdicao(event.target.files?.[0] ?? null)}
                            />
                        </label>

                        {erroAcao && <p className="modal__erro" role="alert">{erroAcao}</p>}

                        <div className="modal__acoes">
                            <button type="button" className="modal__cancelar" onClick={fecharEdicao} disabled={salvando}>
                                Cancelar
                            </button>
                            <button type="submit" className="modal__confirmar" disabled={salvando}>
                                {salvando ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {pessoaParaExcluir && (
                <div className="modal__overlay" onClick={() => !excluindo && setPessoaParaExcluir(null)}>
                    <div
                        className="modal__container gestao__modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="gestao-excluir-titulo"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="modal__header">
                            <div>
                                <span className="modal__eyebrow">Ação permanente</span>
                                <h2 id="gestao-excluir-titulo">Excluir pessoa</h2>
                            </div>
                            <button
                                type="button"
                                className="modal__fechar"
                                onClick={() => setPessoaParaExcluir(null)}
                                disabled={excluindo}
                                aria-label="Fechar confirmação"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="modal__descricao">
                            Tem certeza de que deseja excluir <strong>{pessoaParaExcluir.nome}</strong> (CPF {pessoaParaExcluir.cpf})?
                            Esta ação não pode ser desfeita.
                        </p>
                        {erroAcao && <p className="modal__erro" role="alert">{erroAcao}</p>}
                        <div className="modal__acoes">
                            <button
                                type="button"
                                className="modal__cancelar"
                                onClick={() => setPessoaParaExcluir(null)}
                                disabled={excluindo}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="gestao__excluir-confirmar"
                                onClick={confirmarExclusao}
                                disabled={excluindo}
                            >
                                {excluindo ? 'Excluindo...' : 'Excluir pessoa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

                {/* Cabeçalho da página */}
                <div className="gestao__topo">
                    <div className="gestao__breadcrumb">
                        <Home size={14} />
                        <span>Início</span>
                        <ChevronRight size={14} />
                        <strong>Pessoas Cadastradas</strong>
                    </div>
                    <div className="gestao__status-sistema">
                        <span className="gestao__status-item">
                             <span className="ponto ponto--verde" /> Catracas Ativas:  {/* {getCatracasAtivas} */}
                        </span>
                        <span className="gestao__status-divisor">|</span>
                        <span className="gestao__status-item">
                            <CircleCheck size={14} className="gestao__status-check" /> Sincronização Facial: 100%
                        </span>
                    </div>
                </div>

                <span className="gestao__badge">Módulo Acadêmico &amp; Operacional • SENAI Sorocaba</span>

                <div className="gestao__cabecalho">
                    <div>
                        <h1>Pessoas Cadastradas</h1>
                        <p>Gestão unificada de pessoas com biometria facial e permissões de acesso às catracas.</p>
                    </div>
                    <div className="gestao__acoes-topo">
                        <button className="botao botao--outline">
                            <Download size={16} />
                            Exportar Lista
                        </button>
                        <Link to="/pessoas/cadastro" className="botao botao--primario">
                            <UserPlus size={16} />
                            Cadastrar Nova Pessoa
                        </Link>
                    </div>
                </div>

                {/* Busca e filtros */}
                <div className="gestao__filtros">
                    <div className="gestao__busca">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou CPF..."
                            value={busca}
                            onChange={(e) => mudarBusca(e.target.value)}
                        />
                    </div>

                    <button
                        className={`chip chip--todos ${filtroStatus === 'todos' ? 'chip--ativo' : ''}`}
                        onClick={() => mudarFiltro('todos')}
                    >
                        Todos <span className="chip__contador">{pessoas.length}</span>
                    </button>
                    <button
                        className={`chip chip--liberado ${filtroStatus === 'liberado' ? 'chip--ativo' : ''}`}
                        onClick={() => mudarFiltro('liberado')}
                    >
                        <span className="ponto ponto--verde" /> Acesso Liberado
                        <span className="chip__contador">{totalLiberados}</span>
                    </button>
                    <button
                        className={`chip chip--bloqueado ${filtroStatus === 'bloqueado' ? 'chip--ativo' : ''}`}
                        onClick={() => mudarFiltro('bloqueado')}
                    >
                        <span className="ponto ponto--vermelho" /> Acesso Bloqueado
                        <span className="chip__contador">{totalBloqueados}</span>
                    </button>

                    <button className="botao botao--outline">
                        <SlidersHorizontal size={16} />
                        Filtros
                    </button>
                </div>

                <div className="gestao__resumo">
                    <span>
                        <strong>{pessoas.length}</strong> pessoas autorizadas no sistema{' '}
                        <span className="gestao__resumo-separador">•</span> 99,8% com biometria facial ativa
                    </span>
                    <span className="gestao__resumo-sync">
                        Banco de Dados Local: Sincronizado às {sincronizadoAs}
                    </span>
                </div>

                {/* Tabela */}
                <div className="gestao__tabela-wrapper">
                    <table className="gestao__tabela">
                        <thead>
                            <tr>
                                <th>Foto / Biometria</th>
                                <th>Nome Completo</th>
                                <th>CPF</th>
                                <th>Método de Acesso</th>
                                <th>Status do Acesso</th>
                                <th>Data do Cadastro</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {carregando && (
                                <tr>
                                    <td colSpan={7} className="gestao__estado-vazio">
                                        Carregando pessoas...
                                    </td>
                                </tr>
                            )}

                            {!carregando && erro && (
                                <tr>
                                    <td colSpan={7} className="gestao__estado-vazio">
                                        {erro}
                                    </td>
                                </tr>
                            )}

                            {!carregando && !erro && pessoasDaPagina.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="gestao__estado-vazio">
                                        Nenhuma pessoa encontrada para esse filtro.
                                    </td>
                                </tr>
                            )}

                            {pessoasDaPagina.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        <div className="avatar" style={{ backgroundColor: corAvatar(p.nome) }}>
                                            {iniciais(p.nome)}
                                            <span className="avatar__ponto" />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="gestao__nome">{p.nome}</div>
                                        <div className="gestao__id">ID: #SP-{String(p.id).slice(-5)}</div>
                                        {p.motivoBloqueio && (
                                            <div className="gestao__motivo-bloqueio">{p.motivoBloqueio}</div>
                                        )}
                                    </td>
                                    <td>{p.cpf}</td>
                                    <td>
                                        <span className="pill pill--metodo">
                                            <ScanFace size={14} />
                                            {p.metodoAcesso}
                                        </span>
                                    </td>
                                    <td>
                                        {p.status === 'liberado' ? (
                                            <span className="pill pill--liberado">
                                                <span className="ponto ponto--verde" /> Liberado
                                            </span>
                                        ) : (
                                            <span className="pill pill--bloqueado">
                                                <span className="ponto ponto--vermelho" /> Bloqueado
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {p.dataCadastro ? (
                                            <>
                                                <div>{p.dataCadastro}</div>
                                                <div className="gestao__hora">às {p.horaCadastro}</div>
                                            </>
                                        ) : (
                                            <div className="gestao__hora" title="A API ainda não guarda a data do cadastro">—</div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="gestao__acoes-linha">
                                            <button
                                                type="button"
                                                className="icone-acao"
                                                title={`Editar ${p.nome}`}
                                                aria-label={`Editar ${p.nome}`}
                                                onClick={() => abrirEdicao(p)}
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                className={`icone-acao ${p.status === 'bloqueado' ? 'icone-acao--verde' : ''}`}
                                                title={
                                                    !RECURSOS_PESSOAS.bloqueio
                                                        ? 'Bloqueio ainda não disponível na API'
                                                        : p.status === 'liberado' ? 'Bloquear acesso' : 'Liberar acesso'
                                                }
                                                disabled={!RECURSOS_PESSOAS.bloqueio}
                                                onClick={() => alternarBloqueio(p)}
                                            >
                                                {p.status === 'liberado' ? <Lock size={16} /> : <Unlock size={16} />}
                                            </button>
                                            <button
                                                type="button"
                                                className="icone-acao icone-acao--excluir"
                                                title={`Excluir ${p.nome}`}
                                                aria-label={`Excluir ${p.nome}`}
                                                onClick={() => {
                                                    setPessoaParaExcluir(p);
                                                    setErroAcao('');
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="gestao__paginacao">
                    <span>
                        Mostrando {pessoasFiltradas.length === 0 ? 0 : inicio + 1} a{' '}
                        {Math.min(inicio + ITENS_POR_PAGINA, pessoasFiltradas.length)} de{' '}
                        {pessoasFiltradas.length} pessoas cadastradas
                    </span>

                    <div className="gestao__paginacao-botoes">
                        <button
                            className="botao botao--outline botao--pequeno"
                            disabled={paginaAtual === 1}
                            onClick={() => setPagina((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft size={14} />
                            Anterior
                        </button>

                        {numerosPagina().map((n, idx) =>
                            n === '...' ? (
                                <span key={`ellipsis-${idx}`} className="gestao__paginacao-ellipsis">
                                    ...
                                </span>
                            ) : (
                                <button
                                    key={n}
                                    className={`pagina-numero ${n === paginaAtual ? 'pagina-numero--ativo' : ''}`}
                                    onClick={() => setPagina(n)}
                                >
                                    {n}
                                </button>
                            )
                        )}

                        <button
                            className="botao botao--outline botao--pequeno"
                            disabled={paginaAtual === totalPaginas}
                            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                        >
                            Próxima
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
    );
}

export default GestaoPessoas;