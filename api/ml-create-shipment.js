/**
 * Endpoint para crear envíos en MercadoLibre después de confirmar el pago
 * POST /api/ml-create-shipment
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON || process.env.VITE_SUPABASE_ANON;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const { orderId, userId } = req.body;

    if (!orderId || !userId) {
      return res.status(400).json({ error: 'Missing orderId or userId' });
    }

    // Obtener el token de ML del usuario desde Supabase
    const { data: tokenData, error: tokenError } = await supabase
      .from('ml_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('[ML Shipment] No token found for user:', userId);
      return res.status(404).json({ error: 'ML token not found' });
    }

    const accessToken = tokenData.access_token;

    // Obtener datos de la orden
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verificar si el método de envío requiere ML
    if (order.shipping_method === 'retiro' || order.shipping_method === 'to_coordinate') {
      return res.status(200).json({ 
        success: true, 
        message: 'Shipping method does not require ML shipment',
        skipShipment: true
      });
    }

    // Preparar datos para crear el envío
    const dimensions = '15x15x15,500'; // Temporal - debería venir de la orden
    
    const shipmentBody = {
      mode: 'custom', // o 'me2' si usas MercadoEnvíos directamente
      site_id: 'MLA', // Argentina
      dimensions: dimensions,
      receiver_address: {
        street_name: order.customer_address?.split(' ')[0] || 'Unknown',
        street_number: order.customer_address?.split(' ')[1] || '0',
        zip_code: order.customer_postal_code || '1000',
        city_name: order.customer_city || 'Buenos Aires',
        state_name: order.customer_province || 'Buenos Aires',
        country_name: 'Argentina',
      },
    };

    // Crear envío en MercadoLibre
    const mlResponse = await fetch('https://api.mercadolibre.com/shipments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(shipmentBody),
    });

    if (!mlResponse.ok) {
      const errorData = await mlResponse.json().catch(() => ({}));
      console.error('[ML Shipment] Failed to create shipment:', errorData);
      return res.status(500).json({ 
        error: 'Failed to create ML shipment',
        details: errorData
      });
    }

    const shipment = await mlResponse.json();

    // Guardar información del envío en Supabase
    const { error: insertError } = await supabase
      .from('shipments')
      .insert({
        order_id: orderId,
        ml_shipment_id: shipment.id,
        tracking_number: shipment.tracking_number || null,
        carrier: shipment.logistic_type || 'custom',
        status: shipment.status || 'pending',
        estimated_delivery: shipment.shipping_option?.estimated_delivery_time?.date || null,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[ML Shipment] Failed to save shipment:', insertError);
      // No fallar la request si solo falla el guardado
    }

    // Actualizar orden con el tracking
    await supabase
      .from('orders')
      .update({
        tracking_number: shipment.tracking_number || null,
        ml_shipment_id: shipment.id,
      })
      .eq('id', orderId);

    return res.status(200).json({
      success: true,
      shipment: {
        id: shipment.id,
        tracking_number: shipment.tracking_number,
        status: shipment.status,
      },
    });
  } catch (error) {
    console.error('[ML Shipment] Exception:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
