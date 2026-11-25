import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  KeyRound,
  Users,
  Clock,
  Radio,
  Ban,
  HelpCircle,
  LogOut,
  GraduationCap,
  Menu,
  X,
  BarChart3,
} from 'lucide-react';
import { getCatracas, getLiberacao, liberarCatraca } from '../services/CatracasService.js';
import { mensagemDeErro } from '../services/api.js';
import { nomeDoUsuario } from '../services/authService.js';
import './MenuNavegacao.css';
import logoSenai from '../assets/logo_senai.png';

// Quanto tempo o painel acompanha a liberação esperando o tablet confirmar
const ACOMPANHAMENTO_MS = 35000;
const INTERVALO_CONSULTA_MS = 1000;

function MenuNavegacao({ children }) {
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [catracas, setCatracas] = useState([]);
  const [carregandoCatracas, setCarregandoCatracas] = useState(false);
  const [erroModal, setErroModal] = useState('');
  const [catracaSelecionada, setCatracaSelecionada] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });
  const toastTimerRef = useRef(null);
  const acompanhamentoRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(toastTimerRef.current);
      clearInterval(acompanhamentoRef.current);
    };
  }, []);

  const isActive = (path) => location.pathname === path;
  const usuario = nomeDoUsuario();

  function irPara() {
    // fecha a sidebar ao navegar (relevante no mobile)
    setMenuAberto(false);
  }

  function mostrarToast(mensagem, tipo, duracaoMs) {
    clearTimeout(toastTimerRef.current);
    setToast({ visivel: true, mensagem, tipo });
    if (duracaoMs) {
      toastTimerRef.current = setTimeout(() => setToast((prev) => ({ ...prev, visivel: false })), duracaoMs);
    }
  }

  async function abrirModalLiberacao() {
    setModalAberto(true);
    setErroModal('');
    setMotivo('');
    setCarregandoCatracas(true);
    try {
      const lista = await getCatracas();
      setCatracas(lista);
      setCatracaSelecionada((atual) => lista.find((c) => c.id === atual?.id) ?? lista[0] ?? null);
    } catch (error) {
      setErroModal(mensagemDeErro(error, 'Não foi possível carregar as catracas.'));
    } finally {
      setCarregandoCatracas(false);
    }
  }

  /** Consulta a API até o tablet da catraca confirmar (ou o pedido expirar). */
  function acompanharLiberacao(liberacao, nomeCatraca) {
    clearInterval(acompanhamentoRef.current);
    const limite = Date.now() + ACOMPANHAMENTO_MS;

    acompanhamentoRef.current = setInterval(async () => {
      try {
        const atual = await getLiberacao(liberacao.id);
        if (atual?.status === 'confirmada') {
          clearInterval(acompanhamentoRef.current);
          mostrarToast(`${nomeCatraca} liberada — o tablet exibiu "Acesso liberado".`, 'sucesso', 5000);
          return;
        }
        if (atual?.status === 'expirada' || Date.now() > limite) {
          clearInterval(acompanhamentoRef.current);
          mostrarToast(
            `O tablet da ${nomeCatraca} não respondeu. Verifique se ele está ligado e configurado com esta catraca.`,
            'erro',
            7000
          );
        }
      } catch {
        // falha pontual de rede: tenta de novo no próximo intervalo
      }
    }, INTERVALO_CONSULTA_MS);
  }

  async function confirmarLiberacao() {
    if (!catracaSelecionada || enviando) return;

    setEnviando(true);
    setErroModal('');
    try {
      const liberacao = await liberarCatraca(catracaSelecionada.id, {
        operador: usuario,
        motivo: motivo.trim() || undefined,
      });
      setModalAberto(false);
      mostrarToast(`Liberação enviada para ${catracaSelecionada.nome}. Aguardando o tablet...`, 'aguardando');
      acompanharLiberacao(liberacao, catracaSelecionada.nome);
    } catch (error) {
      setErroModal(mensagemDeErro(error, 'Não foi possível liberar a catraca.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="layout">
      {/* ========================================== */}
      {/* BARRA SUPERIOR (TOP BAR)                    */}
      {/* ========================================== */}
      <header className="topbar">
        <div className="topbar__esquerda">
          <button
            className="topbar__hamburguer"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuAberto ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="topbar__marca">
            <img src={logoSenai} alt="Logo SENAI" className="topbar__logo" />
            <div className="topbar__titulo">
              <h1>Controle de Acesso</h1>
              <span>Portaria Segura • Sorocaba</span>
            </div>
          </div>
        </div>

        <div className="topbar__centro">
          <div className="topbar__status">
            <span className="topbar__status-ponto" /> Rede Online (SP-01)
          </div>
        </div>

        <div className="topbar__direita">
          <button type="button" className="topbar__acao" onClick={abrirModalLiberacao}>
            <KeyRound size={16} />
            <span>Liberar Catraca</span>
          </button>
          <div className="topbar__perfil">
            <strong>{usuario}</strong>
            <span>
              Operador de Portaria • <span className="destaque">SENAI SP</span>
            </span>
          </div>
          <div className="topbar__avatar" />
        </div>
      </header>

      {/* ========================================== */}
      {/* ÁREA INFERIOR (MENU LATERAL + CONTEÚDO)     */}
      {/* ========================================== */}
      <div className="corpo">
        {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)} />}

        {modalAberto && (
          <div className="modal__overlay" onClick={() => setModalAberto(false)}>
            <div
              className="modal__container"
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-liberar-catraca"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal__header">
                <div>
                  <span className="modal__eyebrow">Acesso manual</span>
                  <h2 id="titulo-liberar-catraca">Liberar catraca</h2>
                </div>
                <button
                  type="button"
                  className="modal__fechar"
                  onClick={() => setModalAberto(false)}
                  aria-label="Fechar modal"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="modal__descricao">
                Selecione a catraca que será liberada manualmente. O tablet dela exibirá
                <strong> &quot;Acesso liberado&quot;</strong> em poucos segundos.
              </p>

              <div className="modal__lista">
                {carregandoCatracas && <p className="modal__info">Carregando catracas...</p>}

                {!carregandoCatracas && !erroModal && catracas.length === 0 && (
                  <p className="modal__info">Nenhuma catraca cadastrada.</p>
                )}

                {catracas.map((catraca) => {
                  const ativa = catracaSelecionada?.id === catraca.id;
                  return (
                    <button
                      key={catraca.id}
                      type="button"
                      className={`modal__item ${ativa ? 'modal__item--ativo' : ''}`}
                      onClick={() => setCatracaSelecionada(catraca)}
                      aria-pressed={ativa}
                    >
                      <div className="modal__item-texto">
                        <strong>{catraca.nome}</strong>
                        <span>{catraca.local}</span>
                      </div>
                      {ativa && <span className="modal__check">✓</span>}
                    </button>
                  );
                })}
              </div>

              <label className="modal__campo">
                <span>Motivo (opcional)</span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ex: visitante autorizado pela coordenação"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>

              {erroModal && (
                <p className="modal__erro" role="alert">
                  {erroModal}
                </p>
              )}

              <div className="modal__acoes">
                <button type="button" className="modal__cancelar" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="modal__confirmar"
                  onClick={confirmarLiberacao}
                  disabled={!catracaSelecionada || enviando}
                >
                  {enviando ? 'Liberando...' : 'Liberar acesso'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast.visivel && (
          <div className={`menu-toast menu-toast--visivel menu-toast--${toast.tipo}`} role="status" aria-live="polite">
            <span className="menu-toast__ponto" />
            {toast.mensagem}
            {toast.tipo !== 'aguardando' && (
              <button
                type="button"
                className="menu-toast__fechar"
                onClick={() => setToast((prev) => ({ ...prev, visivel: false }))}
                aria-label="Fechar aviso"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <aside className={`sidebar ${menuAberto ? 'sidebar--aberta' : ''}`}>
          <div className="sidebar__unidade">
            <span className="sidebar__unidade-icone">
              <GraduationCap size={20} color="white" />
            </span>
            <div>
              <strong>SENAI SP - Operação</strong>
              <span>Unidade Sorocaba</span>
            </div>
          </div>

          <nav className="sidebar__nav">
            <Link
              to="/gestao"
              onClick={irPara}
              className={`sidebar__link ${isActive('/gestao') ? 'sidebar__link--ativo' : ''}`}
            >
              <Users size={18} />
              Pessoas Cadastradas
            </Link>

            <Link
              to="/logs"
              onClick={irPara}
              className={`sidebar__link ${isActive('/logs') ? 'sidebar__link--ativo' : ''}`}
            >
              <Clock size={18} />
              Logs de Entrada/Saída
            </Link>

            <Link
              to="/logs/painel"
              onClick={irPara}
              className={`sidebar__link ${isActive('/logs/painel') ? 'sidebar__link--ativo' : ''}`}
            >
              <BarChart3 size={18} />
              Análise de Acessos
            </Link>

            <Link
              to="/monitoramento"
              onClick={irPara}
              className={`sidebar__link ${isActive('/monitoramento') ? 'sidebar__link--ativo' : ''}`}
            >
              <Radio size={18} />
              Dispositivos & Catracas
            </Link>
          </nav>

          <div className="sidebar__rodape">
            <button className="sidebar__bloqueio">
              <Ban size={16} />
              Bloqueio Geral Catracas
            </button>
            <button className="sidebar__suporte">
              <HelpCircle size={16} />
              Suporte Técnico SENAI
            </button>
            <Link to="/" className="sidebar__sair">
              <LogOut size={16} />
              Encerrar Sessão
            </Link>
          </div>
        </aside>

        <main className="conteudo">{children}</main>
      </div>
    </div>
  );
}

export default MenuNavegacao;