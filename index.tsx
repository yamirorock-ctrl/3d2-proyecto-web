import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
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
    if (redirect) {
      sessionStorage.removeItem('redirect');
      navigate(redirect, { replace: true });
    }
  }, [navigate]);

  return <App />;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <HelmetProvider>
    <BrowserRouter>
      <AppWithRedirect />
    </BrowserRouter>
  </HelmetProvider>
);