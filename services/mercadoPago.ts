// Servicio de integración Mercado Pago (frontend)
// NOTA: Para funcionar en producción se requiere un backend que cree la preferencia.
// Nunca expongas tu access token privado en el cliente.

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

export async function loadMercadoPago(): Promise<any> {
  if (window.MercadoPago) return window.MercadoPago;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de Mercado Pago'));
    document.head.appendChild(script);
  });
  if (!window.MercadoPago) throw new Error('SDK Mercado Pago no disponible tras carga.');
  return window.MercadoPago;
}

export function initMercadoPagoInstance() {
  const publicKey = (import.meta as any).env?.VITE_MP_PUBLIC;
  if (!publicKey) throw new Error('Falta VITE_MP_PUBLIC en entorno.');
  return new window.MercadoPago(publicKey, { locale: 'es-AR' });
}

// Placeholder: espera un backend que cree la preferencia y devuelva el id
// Ejemplo esperado de respuesta: { preferenceId: 'XXX' }
export async function createPreference(items: Array<{ id: string; title: string; quantity: number; unit_price: number }>): Promise<string> {
  try {
    const resp = await fetch('/api/mp/preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    if (!resp.ok) throw new Error('Backend preference error');
    const data = await resp.json();
    if (!data.preferenceId) throw new Error('Respuesta sin preferenceId');
    return data.preferenceId;
  } catch (e) {
    console.warn('createPreference fallback (sin backend):', e);
    throw new Error('No se pudo crear la preferencia. Configura backend.');
  }
}

export async function startMercadoPagoCheckout(items: Array<{ id: string; title: string; quantity: number; unit_price: number }>) {
  await loadMercadoPago();
  const mp = initMercadoPagoInstance();
  const preferenceId = await createPreference(items); // lanza error si no hay backend
  // Redirección simple. Opcional: usar checkout bricks.
  mp.checkout({
    preference: { id: preferenceId },
    autoOpen: true, // Abre automáticamente
    render: {
      container: null // No usamos bricks aquí
    }
  });
}
