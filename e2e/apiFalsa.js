// API Java simulada para os testes: responde no mesmo formato da ApiControleDeAcessoPI2
// (JSON, erros como {"detail": "..."}, 401 sem token), guardando o estado em memória.

export const API = 'http://api.e2e.test';
export const TOKEN_VALIDO = 'token-e2e';

function pessoasIniciais() {
  return [
    { cpf: '47811936844', nome: 'Maria Souza', possuiFoto: true, status: 'liberado', motivoBloqueio: null, dataCadastro: '2026-11-26T15:30:00Z' },
    { cpf: '11122233344', nome: 'Pessoa Antiga', possuiFoto: true, status: 'bloqueado', motivoBloqueio: 'Documentação Pendente', dataCadastro: null },
  ];
}

function estacoesIniciais() {
  const reconhecimento = { status: 'reconhecendo', rostosEmCache: 2, antiSpoofing: true, latenciaMs: 230 };
  return [
    {
      id: 1, nome: 'Catraca 01', local: 'Portaria Principal (Entrada A)', statusGeral: 'operacional',
      totem: { online: true, ultimoContato: new Date().toISOString(), segundosDesdeContato: 1, ip: '177.10.20.30' },
      reconhecimento, passagensHoje: 12, ultimaPassagem: new Date().toISOString(), bloqueioGeral: false,
    },
    {
      id: 2, nome: 'Catraca 02', local: 'Portão Docentes', statusGeral: 'alerta',
      totem: { online: false, ultimoContato: null, segundosDesdeContato: null, ip: null },
      reconhecimento, passagensHoje: 0, ultimaPassagem: null, bloqueioGeral: false,
    },
  ];
}

export async function instalarApiFalsa(page) {
  const estado = {
    pessoas: pessoasIniciais(),
    chamadas: [],
    estacoes: estacoesIniciais(),
    bloqueioGeral: { ativo: false, alteradoEm: null, alteradoPor: null },
  };
  const agora = new Date().toISOString();
  const ontem = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const logs = [
    { id: 2, cpf: '47811936844', nome: 'Maria Souza', tipo: 'entrada', dataHora: agora, catracaId: 1, catracaNome: 'Catraca 01', catracaLocal: 'Portaria Principal (Entrada A)' },
    { id: 1, cpf: '11122233344', nome: 'Pessoa Antiga', tipo: 'saida', dataHora: agora, catracaId: null, catracaNome: null, catracaLocal: null },
    { id: 0, cpf: '55566677788', nome: 'Visitante de Ontem', tipo: 'entrada', dataHora: ontem, catracaId: 1, catracaNome: 'Catraca 01', catracaLocal: 'Portaria Principal (Entrada A)' },
  ];

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname;
    const metodo = req.method();
    const json = (status, corpo) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
    estado.chamadas.push(`${metodo} ${caminho}`);

    if (metodo === 'OPTIONS') return route.fulfill({ status: 200 });

    if (caminho === '/auth/login' && metodo === 'POST') {
      const { usuario, senha } = req.postDataJSON();
      if (usuario === 'admin' && senha === '1234') {
        const expiraEm = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
        return json(200, { token: TOKEN_VALIDO, tipo: 'Bearer', expiraEm, usuario: 'admin', nome: 'Operador E2E' });
      }
      return json(401, { detail: 'Usuário ou senha inválidos.' });
    }

    if (req.headers()['authorization'] !== `Bearer ${TOKEN_VALIDO}`) {
      return json(401, { detail: 'Faça login para continuar.' });
    }

    if (caminho === '/pessoa/listar') return json(200, estado.pessoas);

    if (caminho === '/pessoa/cadastro' && metodo === 'POST') {
      return json(409, { detail: 'Já existe uma pessoa cadastrada com este CPF.' });
    }

    const status = caminho.match(/^\/pessoa\/(\d+)\/status$/);
    if (status && metodo === 'PATCH') {
      const pessoa = estado.pessoas.find((p) => p.cpf === status[1]);
      if (!pessoa) return json(404, { detail: 'Pessoa não encontrada.' });
      const corpo = req.postDataJSON();
      pessoa.status = corpo.status;
      pessoa.motivoBloqueio = corpo.status === 'bloqueado' ? corpo.motivo : null;
      return json(200, pessoa);
    }

    if (caminho === '/logs') {
      // Respeita o período pedido, como a API (de/ate em ISO)
      const de = url.searchParams.get('de');
      const ate = url.searchParams.get('ate');
      return json(200, logs.filter((l) => (!de || l.dataHora >= de) && (!ate || l.dataHora <= ate)));
    }

    // ----- Monitoramento (/dispositivos) -----
    if (caminho === '/dispositivos/estacoes') return json(200, estado.estacoes);
    if (caminho === '/dispositivos/bloqueio-geral') {
      if (metodo === 'POST') {
        const { ativo } = req.postDataJSON() ?? { ativo: true };
        estado.bloqueioGeral = { ativo, alteradoEm: new Date().toISOString(), alteradoPor: 'Operador E2E' };
      }
      return json(200, estado.bloqueioGeral);
    }
    const disp = caminho.match(/^\/dispositivos\/estacoes\/(\d+)\/([a-z-]+)$/);
    if (disp) {
      const [, id, acao] = disp;
      const estacao = estado.estacoes.find((e) => String(e.id) === id);
      if (!estacao) return json(404, { detail: 'Estação não encontrada.' });
      if (acao === 'logs') {
        return json(200, [
          { dataHora: agora, tipo: 'heartbeat', titulo: '[HEARTBEAT] TOTEM CONECTADO', texto: 'Primeira consulta do totem.' },
          { dataHora: agora, tipo: 'facial', titulo: '[FACIAL_MATCH] ENTRADA', texto: 'Maria Souza reconhecida.' },
        ]);
      }
      if (acao === 'ping') {
        return json(200, {
          totemOnline: estacao.totem.online,
          segundosDesdeContato: estacao.totem.segundosDesdeContato,
          reconhecimentoOnline: true,
          latenciaReconhecimentoMs: 230,
        });
      }
      if (acao === 'sincronizar-facial') return json(200, { embeddings_em_cache: 2, novos_ou_atualizados: 1 });
      if (acao === 'testar-giro' || acao === 'reiniciar') {
        return json(501, { detail: `O totem ainda não executa "${acao === 'reiniciar' ? 'reiniciar' : 'testar giro'}": depende do acionamento físico da catraca (relé).` });
      }
    }
    if (caminho === '/catracas/liberacoes') return json(200, []);
    if (caminho === '/catracas') return json(200, [{ id: 1, nome: 'Catraca 01', local: 'Portaria Principal (Entrada A)' }]);

    return json(404, { detail: 'Recurso não encontrado.' });
  });

  return estado;
}

/** Faz login pela tela (com a API falsa já instalada). */
export async function entrar(page, { senha = '1234' } = {}) {
  await page.goto('/');
  await page.getByPlaceholder('Digite seu usuário').fill('admin');
  await page.locator('input[type=password]').fill(senha);
  await page.locator('button[type=submit]').click();
}
