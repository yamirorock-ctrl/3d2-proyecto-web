
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Usamos la variante de servidor (sin VITE_) para máxima seguridad
  const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS || process.env.VITE_MP_ACCESS;

  if (!accessToken) {
    return res.status(500).json({ error: 'Mercado Pago Access Token is not configured on server' });
  }

  const { action, payload } = req.body;

  try {
    // Acción: Crear Preferencia de Pago
    if (action === 'create_preference') {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error creating MP preference');

      return res.status(200).json(data);
    }

    // Acción: Obtener info de pago (Seguro porque el token está oculto)
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
    console.error('[MercadoPago Backend Error]', error);
    return res.status(500).json({ error: error.message });
  }
}
