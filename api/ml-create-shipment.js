/**
 * Endpoint para crear envíos en MercadoLibre después de confirmar el pago
 * POST /api/ml-create-shipment
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[ML Shipment] Missing Supabase credentials');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const { orderId, userId } = req.body;
    console.log('[ML Shipment] Request received:', { orderId, userId });

    if (!orderId || !userId) {
      console.error('[ML Shipment] Missing required params:', { orderId, userId });
      return res.status(400).json({ error: 'Missing orderId or userId' });
    }

    // Obtener el token de ML del usuario desde Supabase
    const { data: tokenData, error: tokenError } = await supabase
      .from('ml_tokens')
      .select('access_token, expires_in, updated_at')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('[ML Shipment] No token found for user:', userId, 'Error:', tokenError);
      return res.status(404).json({ error: 'ML token not found', userId, tokenError });
    }

    console.log('[ML Shipment] Token found for user:', userId, 'expires_in:', tokenData.expires_in);

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
    console.log('[ML Shipment] Creating shipment in ML for order:', orderId);
    console.log('[ML Shipment] Shipment body:', JSON.stringify(shipmentBody, null, 2));
    
    const mlResponse = await fetch('https://api.mercadolibre.com/shipments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(shipmentBody),
    });

    const responseText = await mlResponse.text();
    console.log('[ML Shipment] ML Response status:', mlResponse.status);
    console.log('[ML Shipment] ML Response body:', responseText);

    if (!mlResponse.ok) {
      const errorData = responseText ? JSON.parse(responseText) : {};
      console.error('[ML Shipment] Failed to create shipment. Status:', mlResponse.status, 'Error:', errorData);
      return res.status(500).json({ 
        error: 'Failed to create ML shipment',
        status: mlResponse.status,
        details: errorData,
        orderId
      });
    }

    const shipment = JSON.parse(responseText);
    console.log('[ML Shipment] Shipment created successfully:', {
      id: shipment.id,
      tracking: shipment.tracking_number,
      status: shipment.status
    });

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
      console.error('[ML Shipment] Failed to save shipment to DB:', insertError);
      // No fallar la request si solo falla el guardado
    } else {
      console.log('[ML Shipment] Shipment saved to DB successfully');
    }

    // Actualizar orden con el tracking
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_number: shipment.tracking_number || null,
        ml_shipment_id: shipment.id,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[ML Shipment] Failed to update order:', updateError);
    } else {
      console.log('[ML Shipment] Order updated with tracking info');
    }

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
