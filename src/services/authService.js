// Enquanto a API Java não está pronta, o login valida contra um usuário fixo de teste.
// Quando a API estiver disponível, troque o conteúdo desta função por uma chamada
// real (ex: usando o `api.js` com axios) — o restante do app não muda,
// porque tudo aqui chama sempre `login(usuario, senha)`.

const USUARIO_TESTE = {
  usuario: 'admin',
  senha: '1234',
  nome: 'Marcos Vinicius Silva',
};

export function login(usuario, senha) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (usuario === USUARIO_TESTE.usuario && senha === USUARIO_TESTE.senha) {
        const tokenFake = 'mock-token-' + Date.now();
        localStorage.setItem('token', tokenFake);
        localStorage.setItem('usuarioNome', USUARIO_TESTE.nome);
        resolve({ token: tokenFake, nome: USUARIO_TESTE.nome });
      } else {
        reject(new Error('Usuário ou senha inválidos.'));
      }
    }, 500); // simula o tempo de resposta de uma API real
  });
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuarioNome');
}

/** Nome do operador logado (enviado junto com as liberações manuais de catraca). */
export function nomeDoUsuario() {
  try {
    return localStorage.getItem('usuarioNome') || 'Operador';
  } catch {
    return 'Operador';
  }
}

export function estaAutenticado() {
  return Boolean(localStorage.getItem('token'));
}