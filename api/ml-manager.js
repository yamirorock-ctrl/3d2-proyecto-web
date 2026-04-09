import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

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
      
      const refreshResp = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: String(client_id),
          client_secret: String(client_secret),
          refresh_token: dbToken.refresh_token
        })
      });

      if (refreshResp.ok) {
        const refreshData = await refreshResp.json();
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
        await supabase.from('ml_tokens').update({
          access_token: accessToken,
          refresh_token: refreshData.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        }).eq('id', dbToken.id);
      } else {
         const errData = await refreshResp.json();
         console.error("[ML Manager] Refresh error:", errData);
         return res.status(401).json({ error: 'Sesión de ML expirada. Por favor reconecta tu cuenta.' });
      }
    }

    // 3. Action Switcher
    switch (action) {
      case 'auto-link': {
        const mlUserId = dbToken.user_id;
        const searchRes = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const searchData = await searchRes.json();
        const mlIds = searchData.results || [];
        if (mlIds.length === 0) return res.status(200).json({ message: 'No hay publicaciones activas', linked: 0 });

        const detailsRes = await fetch(`https://api.mercadolibre.com/items?ids=${mlIds.join(',')}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const detailsData = await detailsRes.json();
        const mlItems = detailsData.map(d => d.body).filter(Boolean);
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
                const mlResp = await fetch(`https://api.mercadolibre.com/items/${prod.ml_item_id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ available_quantity: Math.max(0, prod.stock || 0) })
                });
                if (mlResp.ok) results.push({ id: prod.id, status: 'success' });
                else throw new Error(mlResp.statusText);
            } catch (err) {
                results.push({ id: prod.id, status: 'error', error: err.message });
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
        if (pictures.length === 0) pictures.push({ source: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/box.svg" }); // Fallback seguro
        
        const itemBody = {
            title: (product.ml_title || product.name).slice(0, 60),
            category_id: product.ml_category_id || "MLA3530",
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

        if (product.ml_item_id) {
            await fetch(`https://api.mercadolibre.com/items/${product.ml_item_id}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ price, available_quantity: product.stock, pictures })
            });
            return res.status(200).json({ success: true, ml_id: product.ml_item_id });
        } else {
            // Prediccion basica si no hay categoria explicita
            if (!product.ml_category_id) {
                const queryText = product.name + (product.category ? ' ' + product.category : '');
                const predResp = await fetch(`https://api.mercadolibre.com/sites/MLA/domain_discovery/search?q=${encodeURIComponent(queryText)}`);
                const predData = await predResp.json();
                if (predData?.[0]) itemBody.category_id = predData[0].category_id;
            }
            
            // Auto-rellenar atributos obligatorios de la categoría para evitar Validation Error
            try {
                const attrsResp = await fetch(`https://api.mercadolibre.com/categories/${itemBody.category_id}/attributes`);
                if (attrsResp.ok) {
                    const categoryAttrs = await attrsResp.json();
                    let currentAttrs = [...itemBody.attributes];
                    
                    categoryAttrs.forEach(attrDef => {
                        if (attrDef.tags && attrDef.tags.required) {
                            if (!currentAttrs.find(a => a.id === attrDef.id)) {
                                let defaultValue = "N/A";
                                if (attrDef.value_type === "number") defaultValue = "1";
                                if (attrDef.value_type === "number_unit") defaultValue = "1 cm";
                                
                                // Tweak for common 3D toys/baby requirements
                                if (attrDef.id.includes("MIN_AGE")) defaultValue = "3 años";
                                else if (attrDef.id.includes("MAX_AGE")) defaultValue = "99 años";
                                else if (attrDef.id === "COLOR") defaultValue = "Multicolor";
                                else if (attrDef.id === "MATERIAL") defaultValue = "Plástico PLA";
                                else if (attrDef.id === "FRANCHISE") defaultValue = "Genérica";
                                else if (attrDef.id === "CHARACTER") defaultValue = "Genérico";
                                else if (attrDef.id === "MANUFACTURER") defaultValue = "Creart 3D2";
                                else if (attrDef.id === "LINE") defaultValue = "Genérica";
                                else if (attrDef.id.includes("BATTERY")) defaultValue = "No";

                                // If the attribute has a predefined list of values, try to pick "Otros" or the first one
                                if (attrDef.values && attrDef.values.length > 0 && attrDef.tags.allow_custom_value === false) {
                                    const otherVal = attrDef.values.find(v => v.name && v.name.toLowerCase().includes("otro"));
                                    if (otherVal) {
                                        currentAttrs.push({ id: attrDef.id, value_id: otherVal.id });
                                        return;
                                    } else {
                                        currentAttrs.push({ id: attrDef.id, value_id: attrDef.values[0].id });
                                        return;
                                    }
                                }
                                
                                currentAttrs.push({ id: attrDef.id, value_name: String(defaultValue) });
                            }
                        }
                    });
                    itemBody.attributes = currentAttrs;
                }
            } catch(e) {
                console.error("[ML] Error auto-filling attributes:", e);
            }

            let createResp = await fetch(`https://api.mercadolibre.com/items`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(itemBody)
            });
            let createData = await createResp.json();

            // Auto-recovery para el loco comportamiento de ML que a veces exige family_name en vez de title
            if (!createResp.ok && createData.cause && JSON.stringify(createData.cause).includes("family_name")) {
                console.log("[ML] Categoría estricta detectada. Reintentando con family_name en vez de title...");
                itemBody.family_name = itemBody.title;
                delete itemBody.title;
                createResp = await fetch(`https://api.mercadolibre.com/items`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemBody)
                });
                createData = await createResp.json();
            }

            if (createResp.ok) {
                await supabase.from('products').update({ ml_item_id: createData.id, ml_status: createData.status, ml_permalink: createData.permalink }).eq('id', productId);
                return res.status(200).json({ success: true, ml_id: createData.id });
            } else {
                console.error("ML Create Error:", JSON.stringify(createData, null, 2));
                return res.status(400).json({ error: createData.message || 'Error al crear en ML', details: createData.cause });
            }
        }
      }

      default:
        return res.status(400).json({ error: 'Unsupported action' });
    }

  } catch (error) {
    console.error(`[ML Manager] Error in action ${action}:`, error);
    return res.status(500).json({ error: error.message });
  }
}
