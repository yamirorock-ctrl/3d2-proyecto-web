/**
 * Webhook de MercadoPago para Vercel Serverless Functions
 * Recibe notificaciones de pagos y actualiza el estado en Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Variables de servidor sin prefijo VITE, con fallback a VITE_* para compatibilidad
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON || process.env.VITE_SUPABASE_ANON;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS || process.env.VITE_MP_ACCESS;

// Validación inicial: loguear qué está faltando
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Webhook] CRÍTICO: Faltan variables de entorno de Supabase', {
    SUPABASE_URL: Boolean(SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY)
  });
}
if (!MP_ACCESS_TOKEN) {
  console.error('[Webhook] CRÍTICO: Falta MP_ACCESS_TOKEN para consultar pagos');
}

// Crear cliente Supabase solo si tenemos las credenciales
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  // Validación temprana: si no hay variables, responder con error descriptivo
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !MP_ACCESS_TOKEN) {
    console.error('[Webhook] ERROR DE CONFIGURACIÓN: Faltan variables de entorno', {
      SUPABASE_URL: Boolean(SUPABASE_URL),
      SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
      MP_ACCESS_TOKEN: Boolean(MP_ACCESS_TOKEN)
    });
    return res.status(500).json({
      error: 'Server misconfigured',
      message: 'Missing environment variables. Configure SUPABASE_URL, SUPABASE_ANON, and MP_ACCESS in Vercel.',
      env: {
        SUPABASE_URL: Boolean(SUPABASE_URL),
        SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
        MP_ACCESS_TOKEN: Boolean(MP_ACCESS_TOKEN)
      }
    });
  }

  // Health-check GET: no expone valores, solo flags
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'Webhook activo',
      lookingFor: {
        'SUPABASE_URL o VITE_SUPABASE_URL': Boolean(SUPABASE_URL),
        'SUPABASE_ANON o VITE_SUPABASE_ANON': Boolean(SUPABASE_ANON_KEY),
        'MP_ACCESS o VITE_MP_ACCESS': Boolean(MP_ACCESS_TOKEN)
      },
      allEnvKeys: Object.keys(process.env).filter(k => 
        k.includes('SUPABASE') || k.includes('MP_') || k.includes('VITE')
      )
    });
  }

  // Solo aceptar POST para notificaciones
  if (req.method !== 'POST') {
    console.warn('[Webhook] Método no permitido:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Loguear headers básicos para diagnóstico
    console.log('[Webhook] Headers:', {
      'content-type': req.headers['content-type'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'user-agent': req.headers['user-agent'],
    });

    // Asegurar que el body exista
    const { type, data, action } = req.body || {};

    // Modo prueba: permitir ?test_payment_id=<id>&order_id=<uuid>
    if (req.query && req.query.test_payment_id) {
      const testPaymentId = req.query.test_payment_id;
      const testOrderId = req.query.order_id;
      console.log('[Webhook][TEST] Ejecutando prueba manual con payment_id:', testPaymentId, 'order_id:', testOrderId);

      const paymentDetails = await fetch(
        `https://api.mercadopago.com/v1/payments/${testPaymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
          }
        }
      );

      if (!paymentDetails.ok) {
        const errText = await paymentDetails.text().catch(() => '');
        console.error('[Webhook][TEST] Error al obtener detalles del pago', {
          status: paymentDetails.status,
          statusText: paymentDetails.statusText,
          body: errText,
        });
        return res.status(200).json({ received: true, note: 'mp fetch failed (test)' });
      }

      const payment = await paymentDetails.json();
      const orderId = testOrderId || payment.external_reference;
      let orderStatus;
      switch (payment.status) {
        case 'approved':
          orderStatus = 'processing';
          break;
        case 'pending':
        case 'in_process':
          orderStatus = 'pending';
          break;
        case 'rejected':
        case 'cancelled':
          orderStatus = 'cancelled';
          break;
        default:
          orderStatus = 'pending';
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: orderStatus,
          payment_id: String(testPaymentId),
          payment_status: payment.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('[Webhook][TEST] Error al actualizar orden:', error);
        return res.status(200).json({ received: true, error: 'db update failed (test)' });
      }

      console.log(`[Webhook][TEST] Orden ${orderId} actualizada a estado: ${orderStatus}`);
      return res.status(200).json({ success: true, orderId, status: orderStatus, test: true });
    }

    console.log('[Webhook] Notificación recibida:', { type, action, data });

    // Si no hay body, responder 200 para evitar reintentos pero loguear
    if (!type && !data) {
      console.warn('[Webhook] Body vacío o inválido recibido');
      return res.status(200).json({ received: true, note: 'empty body' });
    }

    // MercadoPago envía diferentes tipos de notificaciones
    if (type === 'payment') {
      const paymentId = data.id;

      // Obtener detalles del pago desde MercadoPago
      const paymentDetails = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
          }
        }
      );

      if (!paymentDetails.ok) {
        const errText = await paymentDetails.text().catch(() => '');
        console.error('[Webhook] Error al obtener detalles del pago', {
          status: paymentDetails.status,
          statusText: paymentDetails.statusText,
          body: errText,
        });
        // Responder 200 para evitar reintentos; el panel de simulación puede mostrar 401 si usa IDs ficticios
        return res.status(200).json({ received: true, note: 'mp fetch failed' });
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

    // Soporte básico para merchant_order: obtener payment y external_reference
    if (type === 'merchant_order') {
      const merchantOrderId = data.id;
      try {
        const moResp = await fetch(
          `https://api.mercadopago.com/merchant_orders/${merchantOrderId}`,
          { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
        );
        if (!moResp.ok) {
          const txt = await moResp.text().catch(()=> '');
          console.error('[Webhook] Error merchant_order fetch', { status: moResp.status, statusText: moResp.statusText, body: txt });
          return res.status(200).json({ received: true, note: 'merchant_order fetch failed' });
        }
        const mo = await moResp.json();
        const orderId = mo.external_reference;
        const payment = (mo.payments && mo.payments[0]) || null;
        const paymentId = payment ? payment.id : null;
        const paymentStatus = payment ? payment.status : 'pending';
        let orderStatus = 'pending';
        if (paymentStatus === 'approved') orderStatus = 'processing';
        if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') orderStatus = 'cancelled';

        if (!orderId) {
          console.warn('[Webhook] merchant_order sin external_reference');
          return res.status(200).json({ received: true, note: 'merchant_order missing external_reference' });
        }

        const { error } = await supabase
          .from('orders')
          .update({
            status: orderStatus,
            payment_id: paymentId ? String(paymentId) : null,
            payment_status: paymentStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (error) {
          console.error('[Webhook] Error al actualizar orden desde merchant_order:', error);
          return res.status(200).json({ received: true, error: 'db update failed (merchant_order)' });
        }

        console.log(`[Webhook] Orden ${orderId} actualizada vía merchant_order a estado: ${orderStatus}`);
        return res.status(200).json({ success: true, orderId, status: orderStatus, source: 'merchant_order' });
      } catch (e) {
        console.error('[Webhook] Excepción merchant_order:', e);
        return res.status(200).json({ received: true, error: 'merchant_order exception' });
      }
    }

    // Otros tipos de notificaciones (merchant_order, etc.)
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error procesando notificación:', error);
    // Responder 200 para evitar reintentos del panel de prueba, pero loguear el error
    return res.status(200).json({ received: true, error: 'processing error' });
  }
}
