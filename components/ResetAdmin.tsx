import React, { useEffect } from 'react';

interface Props { onDone?: () => void }

export default function ResetAdmin({ onDone }: Props) {
  useEffect(() => {
    try {
      const keys = [
        'ADMIN_SECRET',
        'admin_user',
        'admin_pass_hash',
        'admin_session_id',
        'adminAccessAttempts',
        'orders',
        'cart',
        'customOrders',
        'categories',
        'products'
      ];
      keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });
      try { sessionStorage.removeItem('admin_entry_token'); sessionStorage.removeItem('admin_entry_ts'); } catch {}
      alert('Reseteo local completado. Vuelve a intentar el flujo.');
    } catch {}
    onDone?.();
  }, [onDone]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-center text-slate-600">Reseteando datos locales...</div>
    </div>
  );
}
