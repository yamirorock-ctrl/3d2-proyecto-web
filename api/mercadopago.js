import { MercadoPagoConfig, Order } from 'mercadopago';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Credenciales seguras (Backend)
  const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS || process.env.VITE_MP_ACCESS;

  if (!accessToken) {
    return res.status(500).json({ error: 'Mercado Pago Access Token is not configured on server' });
  }

  // Inicializar Cliente MP SDK v2
  const client = new MercadoPagoConfig({ 
    accessToken: accessToken,
    options: { timeout: 5000 } 
  });

  const { action, payload, deviceId } = req.body;

  try {
    // ACCIÓN: Crear Orden (API de Orders - Reemplaza a Preferences)
    if (action === 'create_order') {
      const order = new Order(client);
      
      // Implementación de Idempotencia (Checklist Calidad 100/100)
      const idempotencyKey = payload.external_reference || `order-${Date.now()}`;

      const response = await order.create({
        body: {
          type: 'online', // Checkout API
          processing_mode: 'automatic',
          total_amount: parseFloat(payload.total_amount),
          external_reference: payload.external_reference,
          payer: payload.payer,
          items: payload.items,
          shipments: payload.shipments,
          notification_url: payload.notification_url,
          back_urls: payload.back_urls,
          auto_return: 'all'
        },
        requestOptions: {
          idempotencyKey: idempotencyKey
        }
      });

      return res.status(200).json(response);
    }

    // ACCIÓN: Consultar Pago (Mantenida por compatibilidad)
    if (action === 'get_payment') {
      const { paymentId } = payload;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error fetching payment info');

      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('[MercadoPago SDK Error]', error);
    return res.status(500).json({ 
      error: error.message,
      detail: error.cause || 'An unexpected error occurred with Mercado Pago SDK'
    });
  }
}
