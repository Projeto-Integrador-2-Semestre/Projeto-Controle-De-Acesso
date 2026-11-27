import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { definirAoExpirarSessao } from '../services/api.js';
import { estaAutenticado } from '../services/authService.js';

/**
 * Só mostra a tela se houver login válido; senão volta para o Login.
 * Também trata o 401 da API (token vencido no meio do uso): limpa a sessão e volta para o Login.
 */
function RotaProtegida({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    definirAoExpirarSessao(() => navigate('/', { replace: true, state: { expirada: true } }));
    return () => definirAoExpirarSessao(() => {});
  }, [navigate]);

  if (!estaAutenticado()) {
    return <Navigate to="/" replace state={{ de: location.pathname }} />;
  }
  return children;
}

export default RotaProtegida;
