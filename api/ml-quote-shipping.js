/**
 * Endpoint para cotizar envíos de MercadoLibre antes del pago
 * POST /api/ml-quote-shipping
 * Body: { zipCodeTo, dimensions: { width, height, length, weight } }
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON || process.env.VITE_SUPABASE_ANON;
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
    const { width, height, length, weight } = dimensions;
    const dimensionsStr = `${width}x${height}x${length},${weight}`;

    // Llamar a la API de ML para cotizar envíos
    const url = new URL('https://api.mercadolibre.com/shipments/options');
    url.searchParams.append('zip_code_from', ML_ZIP_CODE_FROM);
    url.searchParams.append('zip_code_to', zipCodeTo);
    url.searchParams.append('dimensions', dimensionsStr);

    console.log('[ML Quote] Requesting:', url.toString());

    const mlResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const responseText = await mlResponse.text();
    console.log('[ML Quote] Response status:', mlResponse.status);
    console.log('[ML Quote] Response body:', responseText);

    if (!mlResponse.ok) {
      const errorData = responseText ? JSON.parse(responseText) : {};
      console.error('[ML Quote] Failed to get shipping options:', errorData);
      
      // Si es 404 o error de ML, devolver costo estimado por defecto
      if (mlResponse.status === 404 || mlResponse.status === 400) {
        return res.status(200).json({
          success: true,
          options: [],
          defaultCost: 8000, // Costo estimado por defecto
          message: 'Using estimated shipping cost. Actual cost may vary.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to quote shipping',
        details: errorData
      });
    }

    const data = JSON.parse(responseText);
    
    // Extraer opciones de envío
    const options = (data.options || []).map(opt => ({
      id: opt.id,
      name: opt.name,
      cost: opt.cost,
      currency: opt.currency_id,
      estimatedDelivery: opt.estimated_delivery_time?.date || null,
      carrier: opt.shipping_method_id || 'standard'
    }));

    // Si no hay opciones, devolver costo estimado
    if (options.length === 0) {
      return res.status(200).json({
        success: true,
        options: [],
        defaultCost: 8000,
        message: 'No shipping options available. Using estimated cost.'
      });
    }

    // Devolver la opción más económica como costo por defecto
    const cheapestOption = options.reduce((min, opt) => 
      opt.cost < min.cost ? opt : min, options[0]
    );

    return res.status(200).json({
      success: true,
      options,
      defaultCost: cheapestOption.cost,
      selectedOption: cheapestOption
    });

  } catch (error) {
    console.error('[ML Quote] Exception:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      defaultCost: 8000 // Fallback
    });
  }
}
