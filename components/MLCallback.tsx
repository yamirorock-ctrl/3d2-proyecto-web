import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Minimal placeholder: captures `code` from query and shows status.
// Later, we will exchange `code` for tokens via backend.
export default function MLCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle'|'processing'|'done'|'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const path = location.pathname;
    // Only act on /ml-callback route
    if (!path.endsWith('/ml-callback') && path !== '/ml-callback') return;
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Error de autorización: ${error}`);
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('No se recibió el parámetro code en el callback.');
      return;
    }

    setStatus('processing');
    setMessage('Recibimos el código, intercambiando por tokens...');

    (async () => {
      try {
        const r = await fetch('https://3d2-bewhook.vercel.app/api/ml-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const data = await r.json();
        if (!r.ok || !data?.ok) {
          throw new Error(data?.error || 'Fallo en el intercambio de tokens');
        }
        setStatus('done');
        setMessage('Tokens recibidos. Integraremos MercadoEnvíos con tu cuenta.');
        // Opcional: almacenar flag local
        try { localStorage.setItem('ml_connected', '1'); } catch {}
      } catch (e: any) {
        setStatus('error');
        setMessage('Fallo al integrar: ' + (e?.message || 'Error desconocido'));
      }
    })();
    return () => {}
  }, [location, navigate]);

  if (!(location.pathname.endsWith('/ml-callback') || location.pathname === '/ml-callback')) {
    return null;
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-6 bg-white border rounded-xl shadow-sm">
      <h2 className="text-xl font-bold mb-2">MercadoLibre Callback</h2>
      <p className="text-slate-600 text-sm">Estado: {status}</p>
      <p className="text-slate-500 mt-2 text-sm">{message}</p>
      <div className="mt-4">
        <button
          className="px-4 py-2 bg-slate-900 text-white rounded-lg"
          onClick={() => navigate('/')}
        >Volver a Inicio</button>
      </div>
    </div>
  );
}
