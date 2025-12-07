/**
 * Endpoint para cotizar envíos de MercadoLibre antes del pago
 * POST /api/ml-quote-shipping
 * Body: { zipCodeTo, dimensions: { width, height, length, weight } }
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON;
const ML_ZIP_CODE_FROM = process.env.ML_ZIP_CODE_FROM || '1842'; // Código postal del vendedor (El Jagüel)

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, message: 'ml-quote-shipping up' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const { zipCodeTo, dimensions } = req.body;

    if (!zipCodeTo || !dimensions) {
      return res.status(400).json({ error: 'Missing zipCodeTo or dimensions' });
    }

<<<<<<< HEAD
=======
    // Eliminar la validación estricta de dimensiones y peso mínimo MercadoEnvíos

>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
    // Obtener el token de ML del vendedor (el más reciente)
    const { data: tokenData, error: tokenError } = await supabase
      .from('ml_tokens')
      .select('access_token')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error('[ML Quote] No ML token found:', tokenError);
      return res.status(404).json({ 
        error: 'ML not configured', 
        message: 'MercadoLibre shipping not available. Please contact support.'
      });
    }

    const accessToken = tokenData.access_token;

    // Construir dimensiones en formato ML: "ancho x alto x largo,peso_en_gramos"
    let { width, height, length, weight } = dimensions;
    // Normalizar y acotar valores a rangos seguros aceptados por ML
    width = Math.max(1, Math.min(40, Math.round(Number(width))));
    height = Math.max(1, Math.min(30, Math.round(Number(height))));
    length = Math.max(1, Math.min(50, Math.round(Number(length))));
    weight = Math.max(100, Math.min(30000, Math.round(Number(weight)))); // 100g a 30kg
    const dimensionsStr = `${width}x${height}x${length},${weight}`;

    // Llamar a la API de ML para cotizar envíos
    const url = new URL('https://api.mercadolibre.com/shipments/options');
    url.searchParams.append('zip_code_from', ML_ZIP_CODE_FROM);
    url.searchParams.append('zip_code_to', zipCodeTo);
    url.searchParams.append('dimensions', dimensionsStr);

<<<<<<< HEAD
    console.log('[ML Quote] Requesting:', url.toString());

=======
>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
    const mlResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const responseText = await mlResponse.text();
<<<<<<< HEAD
    console.log('[ML Quote] Request params:', { from: ML_ZIP_CODE_FROM, to: zipCodeTo, dimensions: dimensionsStr });
    console.log('[ML Quote] Response status:', mlResponse.status);
    console.log('[ML Quote] Response body:', responseText);

    if (!mlResponse.ok) {
      const errorData = responseText ? JSON.parse(responseText) : {};
      console.error('[ML Quote] Failed to get shipping options:', errorData);
=======

    if (!mlResponse.ok) {
      const errorData = responseText ? JSON.parse(responseText) : {};
>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
      
      // Si es 404 o error de ML, devolver costo estimado por defecto
      if (mlResponse.status === 404 || mlResponse.status === 400) {
        // Fallback dinámico según peso
        let fallback = 8000;
        if (weight <= 500) fallback = 4500;
        else if (weight <= 1500) fallback = 6500;
        else if (weight <= 3000) fallback = 9000;
        else if (weight <= 7000) fallback = 11000;
        else fallback = 14000;
        return res.status(200).json({
          success: true,
          options: [],
          defaultCost: fallback,
          message: 'Using dynamic estimated shipping cost due to no ML options.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to quote shipping',
        details: errorData
      });
    }

    const data = JSON.parse(responseText);
<<<<<<< HEAD
    console.log('[ML Quote] Parsed data options count:', data.options?.length || 0);
=======
>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
    
    // Extraer opciones de envío con más detalles de estimación
    const options = (data.options || []).map(opt => ({
      id: opt.id,
      name: opt.name,
      cost: opt.cost,
      currency: opt.currency_id,
      // Campos de estimación comunes en ML:
      // - estimated_delivery_time: { date, time_from, time_to, unit, value }
      // - shipping_time: { unit, value }
      estimatedDelivery: opt.estimated_delivery_time?.date || null,
      estimatedWindow: opt.estimated_delivery_time
        ? {
            date: opt.estimated_delivery_time.date || null,
            from: opt.estimated_delivery_time.time_from || null,
            to: opt.estimated_delivery_time.time_to || null,
            unit: opt.estimated_delivery_time.unit || null,
            value: opt.estimated_delivery_time.value || null,
          }
        : null,
      shippingTime: opt.shipping_time || null,
      carrier: opt.shipping_method_id || 'standard'
    }));

    // Si no hay opciones, devolver costo estimado
    if (options.length === 0) {
      // Fallback dinámico según peso
      let fallback = 8000;
      if (weight <= 500) fallback = 4500;
      else if (weight <= 1500) fallback = 6500;
      else if (weight <= 3000) fallback = 9000;
      else if (weight <= 7000) fallback = 11000;
      else fallback = 14000;
      return res.status(200).json({
        success: true,
        options: [],
        defaultCost: fallback,
        message: 'No ML options; using dynamic estimated cost.'
      });
    }

    // Devolver la opción más económica como costo por defecto
    const cheapestOption = options.reduce((min, opt) => 
      opt.cost < min.cost ? opt : min, options[0]
    );

<<<<<<< HEAD
    console.log('[ML Quote] Returning cheapest option:', { cost: cheapestOption.cost, carrier: cheapestOption.carrier });

=======
>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
    return res.status(200).json({
      success: true,
      options,
      defaultCost: cheapestOption.cost,
      selectedOption: cheapestOption
    });

  } catch (error) {
<<<<<<< HEAD
    console.error('[ML Quote] Exception:', error);
=======
    // ...existing code...
>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      defaultCost: 8000 // Fallback
    });
  }
}
