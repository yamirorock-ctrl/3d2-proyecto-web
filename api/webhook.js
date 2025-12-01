/**
 * Webhook de MercadoPago para Vercel Serverless Functions
 * Recibe notificaciones de pagos y actualiza el estado en Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body;

    console.log('[Webhook] Notificación recibida:', { type, data });

    // MercadoPago envía diferentes tipos de notificaciones
    if (type === 'payment') {
      const paymentId = data.id;

      // Obtener detalles del pago desde MercadoPago
      const paymentDetails = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.VITE_MP_ACCESS_TOKEN}`
          }
        }
      );

      if (!paymentDetails.ok) {
        console.error('[Webhook] Error al obtener detalles del pago');
        return res.status(200).json({ received: true }); // Retornar 200 para evitar reintentos
      }

      const payment = await paymentDetails.json();
      console.log('[Webhook] Detalles del pago:', payment);

      // Extraer el order_id del external_reference
      const orderId = payment.external_reference;

      if (!orderId) {
        console.warn('[Webhook] No se encontró external_reference en el pago');
        return res.status(200).json({ received: true });
      }

      // Mapear el estado de MercadoPago a nuestro sistema
      let orderStatus;
      switch (payment.status) {
        case 'approved':
          orderStatus = 'processing'; // Pago aprobado, pendiente de preparación
          break;
        case 'pending':
        case 'in_process':
          orderStatus = 'pending'; // Pago pendiente
          break;
        case 'rejected':
        case 'cancelled':
          orderStatus = 'cancelled'; // Pago rechazado/cancelado
          break;
        default:
          orderStatus = 'pending';
      }

      // Actualizar la orden en Supabase
      const { error } = await supabase
        .from('orders')
        .update({
          status: orderStatus,
          payment_id: paymentId.toString(),
          payment_status: payment.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('[Webhook] Error al actualizar orden:', error);
        return res.status(500).json({ error: 'Database update failed' });
      }

      console.log(`[Webhook] Orden ${orderId} actualizada a estado: ${orderStatus}`);

      return res.status(200).json({
        success: true,
        orderId,
        status: orderStatus
      });
    }

    // Otros tipos de notificaciones (merchant_order, etc.)
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error procesando notificación:', error);
    return res.status(500).json({ error: error.message });
  }
}
