# 🛡️ Sistema de Controle de Acesso — Front-End

> **Projeto Integrador — SENAI**
> Interface web moderna e responsiva para gerenciamento e monitoramento de controle de acesso físico (catracas e estações com biometria facial).

---

## 📌 Sobre o Projeto

Este repositório contém o código-fonte da aplicação **Front-End** do **Sistema de Controle de Acesso**.

O sistema foi desenvolvido como uma Single Page Application (SPA) para proporcionar uma gestão centralizada, intuitiva e em tempo real de entradas e saídas em ambientes controlados (como escolas, empresas ou indústrias).

> [!IMPORTANT]
> **Arquitetura Front-End / Back-End:**
> A aplicação consome a API Back-End em Java (login, pessoas, bloqueio, logs e catracas). Só o monitoramento de dispositivos ainda usa dados simulados (a tela avisa) — veja a tabela em *Integração com o Back-End em Java*.

---

## 🚀 Principais Funcionalidades

- **🔐 Autenticação e Segurança:**
  - Login administrativo com controle de sessão e token de autenticação.
  - Fluxo de recuperação de senha.
  - Menu de navegação com opções de liberação rápida de emergência e logout seguro.

- **👤 Gestão de Pessoas:**
  - Listagem completa de colaboradores, alunos e visitantes cadastrados.
  - Indicadores rápidos de status (liberados e bloqueados).
  - Bloqueio administrativo e liberação de acessos em um clique.
  - Busca rápida e filtros por status de permissão.
  - Visualização de índice de confiança da biometria facial.

- **📷 Cadastro de Pessoas com Detecção Facial:**
  - Cadastro de dados básicos com máscara e validação de CPF.
  - Captura de foto via **Webcam** em tempo real ou upload de arquivo de imagem.
  - **Inteligência Artificial no Navegador:** Detecção facial automática via **Google MediaPipe Vision**, garantindo enquadramento e validação de apenas um rosto por cadastro antes do envio ao servidor.

- **📜 Histórico e Auditoria de Acessos (Logs):**
  - Registro de acessos com data, horário, identificação da estação/catraca e direção (entrada/saída).
  - Status do acesso (liberado ou bloqueado/negado).
  - Filtros avançados por período (hoje, ontem, última semana ou intervalo personalizado), horário e busca textual.

- **🖥️ Monitoramento em Tempo Real de Catracas e Estações:**
  - Painel de telemetria das estações físicas e catracas cadastradas.
  - Monitoramento de status de conectividade (*Online*, *Offline*, *Alerta*, *Sincronizando*).
  - Ações operacionais remotas:
    - Envio de **Ping** para medição de latência da estação.
    - **Sincronização Facial** para envio de dados atualizados aos terminais.
    - **Teste de Giro** remoto de catraca.
    - **Reinicialização** de dispositivos.
    - **Bloqueio Geral de Emergência** de todas as estações.
  - Liberação manual imediata de catraca diretamente pela barra superior.

---

## 🛠️ Tecnologias Utilizadas

- **[React 19](https://react.dev/)**: Biblioteca principal para construção da interface declarativa em componentes.
- **[Vite](https://vite.dev/)**: Ferramenta de build e servidor de desenvolvimento ultrarrápido.
- **[React Router DOM](https://reactrouter.com/)**: Gerenciamento das rotas da aplicação (SPA).
- **Fetch API**: cliente HTTP nativo usado em `src/services/api.js` para consumir a API Back-End em Java (o Axios continua listado no `package.json`, mas não é mais usado pelos serviços).
- **[Google MediaPipe Vision](https://developers.google.com/mediapipe/solutions/vision/face_detector)**: Modelos de visão computacional para detecção facial client-side.
- **[Lucide React](https://lucide.dev/)**: Biblioteca de ícones moderna e consistente.
- **CSS3 Nativo**: Estilização modularizada, temas visuais, animações e layout responsivo.

---

## 🔌 Integração com o Back-End em Java

Os serviços em `src/services/` chamam a API Java (Spring Boot, repositório `ApiControleDeAcessoPI2`) com `fetch` (`src/services/api.js`).
Depois do login, todas as chamadas levam o header `Authorization: Bearer <token>`. Se a API responder 401 (token vencido), a sessão é limpa e o usuário volta para o login.

| Tela / recurso | Endpoint da API Java | Situação |
| :--- | :--- | :---: |
| Login | `POST /auth/login` (usuário/senha definidos nas variáveis `ADMIN_*` da API) | ✅ integrado |
| Listagem de pessoas (com status, motivo do bloqueio e data do cadastro) | `GET /pessoa/listar?foto=false` | ✅ integrado |
| Cadastro de pessoa (multipart: `nome`, `cpf`, `foto`) | `POST /pessoa/cadastro` (409 → "Já existe uma pessoa cadastrada com este CPF") | ✅ integrado |
| Editar / excluir pessoa | `PUT /pessoa/atualizar` / `DELETE /pessoa/{cpf}` | ✅ integrado |
| Bloquear/liberar acesso de uma pessoa | `PATCH /pessoa/{cpf}/status` | ✅ integrado (o totem passa a recusar a pessoa) |
| Logs de entrada/saída e Painel de Análise (com a catraca da passagem) | `GET /logs?de=&ate=&tipo=&cpf=&limite=` | ✅ integrado |
| Lista de catracas do botão "Liberar Catraca" | `GET /catracas` | ✅ integrado |
| Liberação manual de catraca | `POST /catracas/{id}/liberar` → acompanha `GET /catracas/liberacoes/{id}` | ✅ integrado |
| Histórico de liberações manuais (Painel) | `GET /catracas/liberacoes` | ✅ integrado |
| Monitoramento de dispositivos (ping, sincronizar, teste de giro, reiniciar, bloqueio geral) | `/dispositivos/...` (ainda não existe na API) | ⏳ simulado — a tela mostra o selo "Dados simulados" |

Logs gravados antes de o totem informar a catraca aparecem como "Totem de Reconhecimento Facial".
Pessoas cadastradas antes de a API guardar a data aparecem com "—" na coluna Data do Cadastro.

### Ativando a API ou o modo simulado

| Situação | O que acontece |
| :--- | :--- |
| `VITE_API_URL` preenchida | Usa a API (login real, dados reais) |
| `npm run dev` sem `VITE_API_URL`, ou `VITE_USE_MOCK=true` | Modo simulado: dados de exemplo de `src/services/mocks/`, login `admin` / `1234` |
| `npm run build` sem `VITE_API_URL` | As telas mostram erro de configuração (o build de produção nunca usa dados falsos) |

Os arquivos de `src/services/mocks/` só são carregados no modo simulado (import dinâmico), então não entram no caminho de produção.

### Sessão

O token fica no `sessionStorage` (some ao fechar a aba). Marcando **Lembrar-me** no login, ele vai para o `localStorage`.
Nos dois casos ele vence sozinho no prazo definido pela API (`JWT_VALIDADE_HORAS`, padrão 8 h). As telas internas exigem login:
quem abre uma delas sem sessão é levado ao login e, depois de entrar, volta para a tela que tentou abrir.

### Validando a integração antes da apresentação

1. A API no Render dorme no plano gratuito: abra `<url-da-api>/health` cerca de 1 minuto antes.
2. Gere o build com `VITE_API_URL` apontando para a API publicada e confira:
   login, cadastro (e cadastro repetido → mensagem de CPF duplicado), listagem, bloqueio/desbloqueio,
   logs (com a catraca) e liberação manual de catraca.
3. Para o bloqueio valer na hora no totem, a API precisa da variável `FACE_API_URL` (senão vale em até 60 s).

### Liberação manual de catraca

1. O operador clica em **Liberar Catraca** (barra superior), escolhe a catraca e, se quiser, informa o motivo.
2. A API guarda o pedido por 30 s. O tablet (app `face_totem`) configurado com o ID dessa catraca consulta a API a cada ~1,5 s e mostra **ACESSO LIBERADO**.
3. O painel acompanha o pedido e avisa quando o tablet confirmou (ou se ele não respondeu a tempo).

---

## 💻 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:
- **[Node.js](https://nodejs.org/)** (versão 18 ou superior recomendada)
- **[npm](https://www.npmjs.com/)** ou gerenciador de pacotes equivalente
- **Navegador moderno** com permissão para acesso à câmera (necessário para a captura biométrica via webcam)
- **API Back-End Java** em execução (opcional; necessária somente após habilitar a integração com dados reais)

---

## ⚙️ Instalação e Execução

1. **Clone o repositório:**
   ```bash
   git clone <url-do-repositorio-front-end>
   cd front-end-pi
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente (sem `VITE_API_URL` a aplicação usa os dados simulados):**
   Copie `.env.example` para `.env` na raiz do projeto e ajuste a URL base da API:
   ```env
   VITE_API_URL=http://localhost:8080
   ```
   Com a API local, entre com o usuário e a senha definidos nas variáveis `ADMIN_USUARIO` / `ADMIN_SENHA` da API (padrão `admin` / `1234`).

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

5. **Acesse no navegador:**
   Abra [http://localhost:5173](http://localhost:5173) (ou o endereço indicado no seu terminal).

---

## 📦 Scripts Disponíveis

No diretório do projeto, você pode executar:

- `npm run dev` — Inicia o servidor local de desenvolvimento com Hot Module Replacement (HMR).
- `npm run build` — Compila e otimiza a aplicação para produção na pasta `dist/`.
- `npm run preview` — Executa um servidor local para visualizar a versão de produção gerada pelo `build`.
- `npm run lint` — Executa o ESLint para verificar a padronização e boas práticas de código.

---

## 📂 Estrutura de Diretórios

```text
front-end-pi/
├── public/                 # Arquivos públicos estáticos
├── src/
│   ├── assets/             # Imagens, logotipos (ex: SENAI) e ícones estáticos
│   ├── components/         # Componentes compartilhados (TopBar, Sidebar, Modais)
│   ├── pages/              # Telas da aplicação
│   │   ├── Login/          # Tela de autenticação
│   │   ├── EsqueciSenha/   # Recuperação de acesso
│   │   ├── GestaoPessoas/  # Listagem e controle de status de usuários
│   │   ├── CadastroPessoa/ # Formulário com captura e validação facial (MediaPipe)
│   │   ├── Logs/           # Histórico de passagens e Painel de Análise (gráficos)
│   │   └── Monitoramento/  # Telemetria e controle de catracas em tempo real
│   ├── services/           # api.js (fetch + token), sessão, chamadas HTTP e mocks/ (modo simulado)
│   ├── App.jsx             # Definição e proteção de rotas
│   ├── index.css           # Variáveis globais de estilo e reset CSS
│   └── main.jsx            # Ponto de entrada da aplicação React
├── .env.example            # Modelo de configuração da API (o arquivo .env local não é versionado)
├── package.json            # Dependências e scripts do projeto
├── vite.config.js          # Configurações do Vite
└── README.md               # Documentação do projeto
```

---

## 👥 Integrantes do Grupo (Autores)

- **Ana Paula Maximo**
- **Gabriel Camargo Gonçalves Silva**
- **Pedro Vitor Ribeiro Silva**
- **Pietro Freire Rezende dos Santos**

---

## 🎓 Contexto Acadêmico

Projeto desenvolvido no âmbito do **Projeto Integrador (PI)** — 2º Semestre.
**Instituição:** SENAI
**Foco:** Solução integrada de hardware/software para segurança patrimonial e controle de fluxo predial.
