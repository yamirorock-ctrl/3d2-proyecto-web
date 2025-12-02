import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
// Log de versión para verificar build en producción
const BUILD_VERSION = (import.meta as any).env?.APP_VERSION || 'v0.0.0';
console.info('[3D2] Build version:', BUILD_VERSION);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);