const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, userId } = req.body;
  if (!action || !userId) return res.status(400).json({ error: 'Missing action or userId' });

  try {
    // 1. Get ML Token
    const { data: dbToken, error: tokenError } = await supabase
      .from('ml_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !dbToken || !dbToken.access_token) {
      return res.status(401).json({ error: 'No hay token de ML vinculado. Conecta tu cuenta primero.' });
    }

    let accessToken = dbToken.access_token;
    const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
    const client_secret = process.env.VITE_ML_APP_SECRET || process.env.VITE_ML_CLIENT_SECRET || process.env.ML_APP_SECRET;

    // 2. Refresh Token IF EXPIRED (Grace period 30 mins)
    const now = new Date();
    const expiresAt = new Date(dbToken.expires_at || 0);
    if (now >= expiresAt || (expiresAt - now < 1800000)) {
      console.log(`[ML Manager] Refreshing token for action: ${action}`);
      const refreshResp = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'refresh_token',
        client_id: String(client_id),
        client_secret: String(client_secret),
        refresh_token: dbToken.refresh_token
      });

      if (refreshResp.status === 200) {
        accessToken = refreshResp.data.access_token;
        const newExpiresAt = new Date(Date.now() + refreshResp.data.expires_in * 1000).toISOString();
        await supabase.from('ml_tokens').update({
          access_token: accessToken,
          refresh_token: refreshResp.data.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        }).eq('id', dbToken.id);
      } else {
         return res.status(401).json({ error: 'Sesión de ML expirada. Por favor reconecta tu cuenta.' });
      }
    }

    // 3. Action Switcher
    switch (action) {
      case 'auto-link': {
        const mlUserId = dbToken.user_id;
        const searchRes = await axios.get(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const mlIds = searchRes.data.results || [];
        if (mlIds.length === 0) return res.status(200).json({ message: 'No hay publicaciones activas', linked: 0 });

        const detailsRes = await axios.get(`https://api.mercadolibre.com/items?ids=${mlIds.join(',')}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const mlItems = detailsRes.data.map(d => d.body).filter(Boolean);
        const { data: localProducts } = await supabase.from('products').select('id, name, ml_item_id');

        let linkedCount = 0;
        let logs = [];
        for (const item of mlItems) {
            const mlTitle = item.title.toLowerCase();
            const match = localProducts.find(p => {
                if (p.ml_item_id === item.id) return false;
                if (mlTitle === p.name.toLowerCase()) return true;
                if (mlTitle.includes(p.name.toLowerCase())) return true;
                const localWords = p.name.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 3);
                if (localWords.length > 0 && localWords.every(w => mlTitle.includes(w))) return true;
                return false;
            });
            if (match) {
                await supabase.from('products').update({ ml_item_id: item.id, ml_permalink: item.permalink, ml_status: item.status }).eq('id', match.id);
                linkedCount++;
                logs.push(`Vinculado [${item.id}] -> "${match.name}"`);
            }
        }
        return res.status(200).json({ message: 'Búsqueda completada', linked: linkedCount, logs });
      }

      case 'bulk-sync-stock': {
        const { productIds } = req.body;
        let query = supabase.from('products').select('id, name, stock, ml_item_id');
        if (productIds && productIds.length > 0) query = query.in('id', productIds);
        else query = query.not('ml_item_id', 'is', null);

        const { data: products } = await query;
        const results = [];
        for (const prod of products) {
            if (!prod.ml_item_id) continue;
            try {
                await axios.put(`https://api.mercadolibre.com/items/${prod.ml_item_id}`, 
                    { available_quantity: Math.max(0, prod.stock || 0) },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                results.push({ id: prod.id, status: 'success' });
            } catch (err) {
                results.push({ id: prod.id, status: 'error', error: err.response?.data?.message || err.message });
            }
        }
        return res.status(200).json({ summary: { total: products.length, success: results.filter(r => r.status === 'success').length, errors: results.filter(r => r.status === 'error').length }, results });
      }

      case 'sync-product': {
        const { productId, productData, markupPercentage } = req.body;
        const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
        if (productData) Object.assign(product, productData);

        const markup = markupPercentage !== undefined ? markupPercentage : 25;
        const price = Math.floor(Number(product.price) * (1 + markup / 100));
        const pictures = (product.images || []).map(img => ({ source: typeof img === 'string' ? img : img.url })).filter(img => img.source?.startsWith('http'));
        if (pictures.length === 0 && product.image) pictures.push({ source: product.image });

        const itemBody = {
            family_name: (product.ml_title || product.name).slice(0, 60),
            category_id: product.ml_category_id || "MLA3530", // Simplificado para el manager masivo, en produccion usar prediccion si no hay
            price,
            currency_id: "ARS",
            available_quantity: product.stock || 0,
            buying_mode: "buy_it_now",
            condition: "new",
            listing_type_id: "gold_special",
            pictures,
            attributes: [
                { id: "BRAND", value_name: product.brand || "3D2Store" },
                { id: "MODEL", value_name: product.model || "Personalizado" },
                { id: "ITEM_CONDITION", value_id: "2230284" }
            ]
        };

        let mlResp;
        if (product.ml_item_id) {
            mlResp = await axios.put(`https://api.mercadolibre.com/items/${product.ml_item_id}`, { price, available_quantity: product.stock, pictures }, { headers: { Authorization: `Bearer ${accessToken}` } });
        } else {
            // Prediccion de categoria si es nuevo
            const pred = await axios.get(`https://api.mercadolibre.com/sites/MLA/domain_discovery/search?q=${encodeURIComponent(product.name)}`);
            if (pred.data?.[0]) itemBody.category_id = pred.data[0].category_id;
            mlResp = await axios.post(`https://api.mercadolibre.com/items`, itemBody, { headers: { Authorization: `Bearer ${accessToken}` } });
        }

        await supabase.from('products').update({ ml_item_id: mlResp.data.id, ml_status: mlResp.data.status, ml_permalink: mlResp.data.permalink }).eq('id', productId);
        return res.status(200).json({ success: true, ml_id: mlResp.data.id });
      }

      default:
        return res.status(400).json({ error: 'Unsupported action' });
    }

  } catch (error) {
    console.error(`[ML Manager] Error in action ${action}:`, error);
    return res.status(500).json({ error: error.response?.data?.message || error.message });
  }
};
