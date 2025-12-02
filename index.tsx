import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './index.css';
// Log de versión para verificar build en producción
const BUILD_VERSION = (import.meta as any).env?.APP_VERSION || 'v0.0.0';
console.info('[3D2] Build version:', BUILD_VERSION);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Wrapper para manejar redirección desde 404.html (GitHub Pages SPA fallback)
const AppWithRedirect: React.FC = () => {
  const navigate = useNavigate();
  
  React.useEffect(() => {
    const redirect = sessionStorage.getItem('redirect');
    console.log('[APP] Verificando redirect:', redirect);
    if (redirect) {
      console.log('[APP] Restaurando ruta:', redirect);
      sessionStorage.removeItem('redirect');
      // Pequeño delay para asegurar que React Router está listo
      setTimeout(() => {
        navigate(redirect, { replace: true });
      }, 0);
    }
  }, [navigate]);

  return <App />;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <BrowserRouter>
    <AppWithRedirect />
  </BrowserRouter>
);