import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MenuNavegacao from './components/MenuNavegacao.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Login from './pages/Login/Login.jsx';
import RecuperarSenha from './pages/EsqueciSenha/RecuperarSenha.jsx';
import GestaoPessoas from './pages/GestaoPessoas/GestaoPessoas.jsx';
import LogsAcesso from './pages/Logs/LogsAcesso.jsx';
import PainelLogs from './pages/Logs/PainelLogs.jsx';
import CadastroPessoas from './pages/CadastroPessoa/CadastroPessoas.jsx';
import Monitoramento from './pages/Monitoramento/Monitoramento.jsx';

// ==========================================
// GESTOR DE ROTAS
// ==========================================
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota raiz (Login) fora do menu */}
        <Route path="/" element={<Login />} />

        <Route path="/recuperarsenha" element={<RecuperarSenha />} />

        {/* Rotas envolvidas pelo MenuNavegacao (exigem login) */}
        <Route path="/gestao" element={
          <RotaProtegida>
            <MenuNavegacao>
              <GestaoPessoas />
            </MenuNavegacao>
          </RotaProtegida>
        } />
        
        <Route path="/logs" element={
          <RotaProtegida>
            <MenuNavegacao>
              <LogsAcesso />
            </MenuNavegacao>
          </RotaProtegida>
        } />

        <Route path="/logs/painel" element={
          <RotaProtegida>
            <MenuNavegacao>
              <PainelLogs />
            </MenuNavegacao>
          </RotaProtegida>
        } />

        <Route path="/monitoramento" element={
          <RotaProtegida>
            <MenuNavegacao>
              <Monitoramento />
            </MenuNavegacao>
          </RotaProtegida>
        } />

        <Route path="/pessoas/cadastro" element={
          <RotaProtegida>
            <MenuNavegacao>
              <CadastroPessoas />
            </MenuNavegacao>
          </RotaProtegida>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;