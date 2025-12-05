/**
 * Endpoint auxiliar para reintentar creación de envíos ML en órdenes aprobadas sin tracking
 * GET /api/ml-retry-shipments?order_id=<uuid>
 * GET /api/ml-retry-shipments (procesa todas las órdenes aprobadas sin tracking)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON || process.env.VITE_SUPABASE_ANON;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const { order_id } = req.query;

    // Obtener el user_id de ML (vendedor)
    const { data: mlToken, error: mlTokenError } = await supabase
      .from('ml_tokens')
      .select('user_id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (mlTokenError || !mlToken) {
      return res.status(404).json({ 
        error: 'No ML token found. Complete OAuth callback first.',
        mlTokenError 
      });
    }

    const userId = String(mlToken.user_id);

    // Si se especifica un order_id, procesar solo esa orden
    if (order_id) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, payment_status, shipping_method, ml_shipment_id, tracking_number')
        .eq('id', order_id)
        .single();

      if (orderError || !order) {
        return res.status(404).json({ error: 'Order not found', order_id });
      }

      if (order.payment_status !== 'approved') {
        return res.status(400).json({ 
          error: 'Order not approved', 
          order_id,
          payment_status: order.payment_status 
        });
      }

      if (order.ml_shipment_id || order.tracking_number) {
        return res.status(200).json({ 
          message: 'Order already has tracking',
          order_id,
          ml_shipment_id: order.ml_shipment_id,
          tracking_number: order.tracking_number
        });
      }

      const needsMLShipment = ['moto', 'correo'].includes(order.shipping_method);
      if (!needsMLShipment) {
        return res.status(200).json({
          message: 'Shipping method does not require ML',
          order_id,
          shipping_method: order.shipping_method
        });
      }

      // Llamar al endpoint de creación
      const createResponse = await fetch(
        `${process.env.VERCEL_URL || 'https://3d2-bewhook.vercel.app'}/api/ml-create-shipment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order_id, userId })
        }
      );

      const result = await createResponse.json();
      
      return res.status(createResponse.ok ? 200 : 500).json({
        order_id,
        userId,
        success: createResponse.ok,
        ...result
      });
    }

    // Sin order_id: procesar todas las órdenes aprobadas sin tracking
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shipping_method, ml_shipment_id, tracking_number')
      .eq('payment_status', 'approved')
      .is('ml_shipment_id', null);

    if (ordersError) {
      return res.status(500).json({ error: 'Failed to fetch orders', ordersError });
    }

    if (!orders || orders.length === 0) {
      return res.status(200).json({ 
        message: 'No orders found requiring ML shipment retry',
        count: 0 
      });
    }

    // Filtrar solo las que necesitan ML
    const ordersNeedingML = orders.filter(o => ['moto', 'correo'].includes(o.shipping_method));

    const results = [];
    for (const order of ordersNeedingML) {
      try {
        const createResponse = await fetch(
          `${process.env.VERCEL_URL || 'https://3d2-bewhook.vercel.app'}/api/ml-create-shipment`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id, userId })
          }
        );

        const result = await createResponse.json();
        results.push({
          order_id: order.id,
          success: createResponse.ok,
          ...result
        });
      } catch (err) {
        results.push({
          order_id: order.id,
          success: false,
          error: err.message
        });
      }
    }

    return res.status(200).json({
      message: 'Retry completed',
      total: ordersNeedingML.length,
      results
    });

  } catch (error) {
    console.error('[ML Retry] Exception:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
