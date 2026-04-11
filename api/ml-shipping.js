/**
 * Centralized Endpoint for MercadoLibre Shipping operations
 * Reduces Vercel Serverless Function count by combining:
 * 1. ml-quote-shipping
 * 2. ml-create-shipment
 * 3. ml-retry-shipments
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;
const ML_ZIP_CODE_FROM = process.env.ML_ZIP_CODE_FROM || "1842"; // Código postal del vendedor (El Jagüel)

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  // Determine action (from query string for GETs, or body for POSTs)
  const action = req.method === "GET" ? req.query.action : (req.body?.action || req.query.action);
  
  if (!action) {
    if (req.method === "GET") return res.status(200).json({ ok: true, message: "ml-shipping up" });
    return res.status(400).json({ error: "Missing action in request" });
  }

  try {
    switch (action) {

      // ==========================================
      // ACTION: QUOTE
      // ==========================================
      case 'quote': {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed for quote" });
        const { zipCodeTo, dimensions } = req.body;
        if (!zipCodeTo || !dimensions) return res.status(400).json({ error: "Missing zipCodeTo or dimensions" });

        const { data: tokenData, error: tokenError } = await supabase
          .from("ml_tokens")
          .select("access_token")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (tokenError || !tokenData) {
          return res.status(404).json({ error: "ML not configured", message: "MercadoLibre shipping not available." });
        }

        const accessToken = tokenData.access_token;

        let { width, height, length, weight } = dimensions;
        width = Math.max(1, Math.min(40, Math.round(Number(width))));
        height = Math.max(1, Math.min(30, Math.round(Number(height))));
        length = Math.max(1, Math.min(50, Math.round(Number(length))));

        const volumetricWeightGrams = Math.round(((width * height * length) / 4000) * 1000);
        let providedWeight = Math.round(Number(weight));
        weight = Math.max(100, Math.min(30000, Math.max(providedWeight, volumetricWeightGrams)));

        const dimensionsStr = `${width}x${height}x${length},${weight}`;
        const url = new URL("https://api.mercadolibre.com/shipments/options");
        url.searchParams.append("zip_code_from", ML_ZIP_CODE_FROM);
        url.searchParams.append("zip_code_to", zipCodeTo);
        url.searchParams.append("dimensions", dimensionsStr);

        const mlResponse = await fetch(url.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });

        if (!mlResponse.ok) {
          let fallback = 8000;
          if (weight <= 500) fallback = 4500;
          else if (weight <= 1500) fallback = 6500;
          else if (weight <= 3000) fallback = 9000;
          else if (weight <= 7000) fallback = 11000;
          else fallback = 14000;
          return res.status(200).json({ success: true, options: [], defaultCost: fallback, message: "Using dynamic estimated shipping cost due to no ML options." });
        }

        const data = JSON.parse(await mlResponse.text());
        const options = (data.options || []).map((opt) => ({
          id: opt.id,
          name: opt.name,
          cost: opt.cost,
          currency: opt.currency_id,
          estimatedDelivery: opt.estimated_delivery_time?.date || null,
          estimatedWindow: opt.estimated_delivery_time ? {
            date: opt.estimated_delivery_time.date || null,
            from: opt.estimated_delivery_time.time_from || null,
            to: opt.estimated_delivery_time.time_to || null,
            unit: opt.estimated_delivery_time.unit || null,
            value: opt.estimated_delivery_time.value || null,
          } : null,
          shippingTime: opt.shipping_time || null,
          carrier: opt.shipping_method_id || "standard",
        }));

        if (options.length === 0) {
          let fallback = 8000;
          if (weight <= 500) fallback = 4500;
          else if (weight <= 1500) fallback = 6500;
          else if (weight <= 3000) fallback = 9000;
          else if (weight <= 7000) fallback = 11000;
          else fallback = 14000;
          return res.status(200).json({ success: true, options: [], defaultCost: fallback, message: "No ML options; using dynamic estimated cost." });
        }

        const cheapestOption = options.reduce((min, opt) => (opt.cost < min.cost ? opt : min), options[0]);
        return res.status(200).json({ success: true, options, defaultCost: cheapestOption.cost, selectedOption: cheapestOption });
      }

      // ==========================================
      // ACTION: CREATE
      // ==========================================
      case 'create': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed for create' });
        const { orderId, userId } = req.body;
        if (!orderId || !userId) return res.status(400).json({ error: 'Missing orderId or userId' });

        return await internalCreateShipment(orderId, userId, res, supabase);
      }

      // ==========================================
      // ACTION: RETRY
      // ==========================================
      case 'retry': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed for retry' });
        const { order_id } = req.query;

        const { data: mlToken, error: mlTokenError } = await supabase
          .from('ml_tokens')
          .select('user_id')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (mlTokenError || !mlToken) return res.status(404).json({ error: 'No ML token found.', mlTokenError });
        const userId = String(mlToken.user_id);

        if (order_id) {
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, payment_status, shipping_method, ml_shipment_id, tracking_number')
            .eq('id', order_id)
            .single();

          if (orderError || !order) return res.status(404).json({ error: 'Order not found', order_id });
          if (order.payment_status !== 'approved') return res.status(400).json({ error: 'Order not approved', order_id });
          if (order.ml_shipment_id || order.tracking_number) return res.status(200).json({ message: 'Order already has tracking' });
          if (!['moto', 'correo'].includes(order.shipping_method)) return res.status(200).json({ message: 'Shipping method does not require ML' });

          // Call local create logic immediately, ignoring res inside unless we need it
          const result = await internalCreateShipment(order_id, userId, { status: () => ({ json: r => r }) }, supabase);
          return res.status(result?.success ? 200 : 500).json({ order_id, userId, success: result?.success, ...result });
        }

        // Retry all
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, shipping_method, ml_shipment_id, tracking_number')
          .eq('payment_status', 'approved')
          .is('ml_shipment_id', null);

        if (ordersError) return res.status(500).json({ error: 'Failed to fetch orders', ordersError });
        if (!orders || orders.length === 0) return res.status(200).json({ message: 'No orders found requiring ML shipment retry', count: 0 });

        const ordersNeedingML = orders.filter(o => ['moto', 'correo'].includes(o.shipping_method));
        const results = [];
        for (const order of ordersNeedingML) {
          try {
            const createResponse = await internalCreateShipment(order.id, userId, { status: () => ({ json: r => r }) }, supabase);
            results.push({ order_id: order.id, success: !!createResponse?.success, ...createResponse });
          } catch (err) {
            results.push({ order_id: order.id, success: false, error: err.message });
          }
        }
        return res.status(200).json({ message: 'Retry completed', total: ordersNeedingML.length, results });
      }

      default:
        return res.status(400).json({ error: "Unsupported action in ml-shipping" });
    }
  } catch (error) {
    console.error(`[ML Shipping] Exception:`, error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}

// ----------------------------------------------------
// Reusable Internal Logic
// ----------------------------------------------------
async function internalCreateShipment(orderId, userId, res, supabase) {
  const { data: tokenData, error: tokenError } = await supabase
    .from('ml_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (tokenError || !tokenData) {
    return res.status(404).json({ error: 'ML token not found', userId });
  }

  const accessToken = tokenData.access_token;
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
  if (order.shipping_method === 'retiro' || order.shipping_method === 'to_coordinate') {
    return res.status(200).json({ success: true, message: 'Shipping method does not require ML shipment', skipShipment: true });
  }

  const dimensions = '15x15x15,500'; 
  const shipmentBody = {
    mode: 'custom', 
    site_id: 'MLA',
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

  const mlResponse = await fetch('https://api.mercadolibre.com/shipments', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(shipmentBody),
  });

  const responseText = await mlResponse.text();
  if (!mlResponse.ok) {
    const errorData = responseText ? JSON.parse(responseText) : {};
    return res.status(500).json({ error: 'Failed to create ML shipment', status: mlResponse.status, details: errorData, orderId });
  }

  const shipment = JSON.parse(responseText);
  await supabase.from('shipments').insert({
    order_id: orderId,
    ml_shipment_id: shipment.id,
    tracking_number: shipment.tracking_number || null,
    carrier: shipment.logistic_type || 'custom',
    status: shipment.status || 'pending',
    estimated_delivery: shipment.shipping_option?.estimated_delivery_time?.date || null,
    created_at: new Date().toISOString(),
  });

  await supabase.from('orders').update({
    tracking_number: shipment.tracking_number || null,
    ml_shipment_id: shipment.id,
  }).eq('id', orderId);

  return res.status(200).json({
    success: true,
    shipment: { id: shipment.id, tracking_number: shipment.tracking_number, status: shipment.status },
  });
}
