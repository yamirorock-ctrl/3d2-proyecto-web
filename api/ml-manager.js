import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Vanguard Backend: Intentamos usar la Service Role primaria para brincar bloqueos RLS al guardar memoria vital.
// Fallback a Anon key si no está expuesta en un entorno local, aunque en Vercel priorizará la maestra.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  
  const action = req.method === 'GET' ? req.query.action : req.body.action;
  const userId = req.method === 'GET' ? req.query.userId : req.body.userId;

  if (!action || !userId) return res.status(400).json({ error: 'Missing action or userId' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    // Solo requerir Token de ML si la acción lo necesita
    const needsToken = ['get-metrics', 'strategic-analysis', 'suggest-title', 'bulk-sync-stock', 'sync-product', 'get-promotions', 'auto-link'].includes(action);
    let accessToken = null;
    let dbToken = null;

    if (needsToken) {
      const { data, error: tokenError } = await supabase
        .from('ml_tokens')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenError || !data || !data.access_token) {
        return res.status(401).json({ error: 'No hay token de ML vinculado.' });
      }
      dbToken = data;
      accessToken = dbToken.access_token;

      // Refresh Token IF EXPIRED (30 mins grace)
      const now = new Date();
      const expiresAt = new Date(dbToken.expires_at || 0);
      if (now >= expiresAt || (expiresAt - now < 1800000)) {
        const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
        const client_secret = process.env.VITE_ML_APP_SECRET || process.env.VITE_ML_CLIENT_SECRET || process.env.ML_APP_SECRET;

        const refreshResp = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: String(client_id),
            client_secret: String(client_secret),
            refresh_token: String(dbToken.refresh_token)
          })
        });
        const refreshData = await refreshResp.json();
        if (refreshResp.ok) {
          accessToken = refreshData.access_token;
          await supabase.from('ml_tokens').update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }).eq('user_id', dbToken.user_id);
        } else {
             return res.status(401).json({ error: 'Sesión de ML expirada. Por favor reconecta tu cuenta.' });
        }
      }
    }

    // 3. Action Switcher
    switch (action) {
      case 'get-vanguard-state': {
        const { data } = await supabase
          .from('vanguard_memory')
          .select('*')
          .eq('user_id', String(userId));

        const state = {
          analysis: data?.find(d => d.event_type === 'latest_analysis')?.content?.analysis || null,
          goals: data?.find(d => d.event_type === 'latest_analysis')?.content?.goals || null,
          chat_history: data?.find(d => d.event_type === 'chat_history')?.content || []
        };
        return res.status(200).json(state);
      }

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

      case 'get-promotions': {
        const mlUserId = dbToken.user_id;
        const promosRes = await fetch(`https://api.mercadolibre.com/seller-promotions/principals?seller_id=${mlUserId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const promosData = await promosRes.json();
        return res.status(200).json(promosData);
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
        return res.status(200).json({ results });
      }

      case 'sync-product': {
        const { productId, productData, markupPercentage } = req.body;
        const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
        if (productData) Object.assign(product, productData);

        const markup = markupPercentage !== undefined ? markupPercentage : 25;
        const price = Math.floor(Number(product.price) * (1 + markup / 100));
        const pictures = (product.images || []).map(img => ({ source: typeof img === 'string' ? img : img.url })).filter(img => img.source?.startsWith('http'));
        if (pictures.length === 0 && product.image) pictures.push({ source: product.image });
        if (pictures.length === 0) pictures.push({ source: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/box.svg" });
        
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

        if (product.weight) itemBody.attributes.push({ id: "PACKAGE_WEIGHT", value_name: `${product.weight} g` });
        if (product.dimensions?.length) itemBody.attributes.push({ id: "PACKAGE_LENGTH", value_name: `${product.dimensions.length} cm` });
        if (product.dimensions?.width) itemBody.attributes.push({ id: "PACKAGE_WIDTH", value_name: `${product.dimensions.width} cm` });
        if (product.dimensions?.height) itemBody.attributes.push({ id: "PACKAGE_HEIGHT", value_name: `${product.dimensions.height} cm` });

        if (product.ml_item_id) {
            await fetch(`https://api.mercadolibre.com/items/${product.ml_item_id}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ price, available_quantity: product.stock, pictures })
            });
            return res.status(200).json({ success: true, ml_id: product.ml_item_id });
        } else {
            const template = product.ml_attributes?.TEMPLATE || '';
            const manualCategory = product.category?.toLowerCase() || '';
            if (!product.ml_category_id) {
                if (template === 'Bebés' || manualCategory.includes('bebé')) itemBody.category_id = "MLA417942";
                else if (template === 'Mates' || manualCategory.includes('mate')) itemBody.category_id = "MLA190013";
                else if (template === 'Llaveros' || manualCategory.includes('llavero')) itemBody.category_id = "MLA438318";
                else if (template === 'Vasos' || manualCategory.includes('vaso')) itemBody.category_id = "MLA438030";
                else if (template === 'Soportes' || manualCategory.includes('soporte')) itemBody.category_id = "MLA3530";
                else {
                    const queryText = product.name + (product.category ? ' ' + product.category : '');
                    const predResp = await fetch(`https://api.mercadolibre.com/sites/MLA/domain_discovery/search?q=${encodeURIComponent(queryText)}`);
                    const predData = await predResp.json();
                    if (predData?.[0]) itemBody.category_id = predData[0].category_id;
                }
            }
            try {
                const attrsResp = await fetch(`https://api.mercadolibre.com/categories/${itemBody.category_id}/attributes`);
                if (attrsResp.ok) {
                    const categoryAttrs = await attrsResp.json();
                    let currentAttrs = [...itemBody.attributes];
                    categoryAttrs.forEach(attrDef => {
                        if (attrDef.tags && attrDef.tags.required && !currentAttrs.find(a => a.id === attrDef.id)) {
                            let val = "Genérico";
                            if (attrDef.value_type === "number") val = "1";
                            if (attrDef.value_type === "number_unit") val = "1 cm";
                            currentAttrs.push({ id: attrDef.id, value_name: val });
                        }
                    });
                    itemBody.attributes = currentAttrs;
                }
            } catch(e) {}

            let createResp = await fetch(`https://api.mercadolibre.com/items`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(itemBody)
            });
            let createData = await createResp.json();
            if (createResp.ok) {
                await supabase.from('products').update({ ml_item_id: createData.id, ml_status: createData.status, ml_permalink: createData.permalink }).eq('id', productId);
                return res.status(200).json({ success: true, ml_id: createData.id });
            } else {
                return res.status(400).json({ error: createData.message || 'Error al crear en ML', details: createData.cause });
            }
        }
      }

      case 'get-metrics': {
        const mlUserId = dbToken.user_id;
        const headers = { Authorization: `Bearer ${accessToken}` };

        // 1. Datos base: Items, Órdenes y Campañas generales
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);

        const [searchRes, ordersRes, adsRes, userRes, questionsRes] = await Promise.all([
          fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active`, { headers }),
          fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dateFrom.toISOString()}`, { headers }),
          fetch(`https://api.mercadolibre.com/advertising/advertising_campaigns/search?seller_id=${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/users/${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/questions/search?seller_id=${mlUserId}&status=unanswered`, { headers })
        ]);

        const [searchData, ordersData, adsData, userData, questionsData] = await Promise.all([
          searchRes.json(), ordersRes.json(), adsRes.json(), userRes.json(), questionsRes.json()
        ]);

        const mlIds = (searchData.results || []).slice(0, 10);

        // 2. Métricas profundas por Item (Visitas, Salud y DESCRIPCIÓN)
        const itemsMetrics = await Promise.all(mlIds.map(async (id) => {
          const [vRes, detRes, descRes] = await Promise.all([
            fetch(`https://api.mercadolibre.com/items/${id}/visits/time_window?last=30&unit=day`, { headers }),
            fetch(`https://api.mercadolibre.com/items/${id}`, { headers }),
            fetch(`https://api.mercadolibre.com/items/${id}/description`, { headers })
          ]);
          const [vData, detData, descData] = await Promise.all([vRes.json(), detRes.json(), descRes.json()]);
          return {
            id,
            title: detData.title,
            visits_30d: vData.total_visits || 0,
            price: detData.price,
            stock: detData.available_quantity,
            permalink: detData.permalink,
            description: descData.plain_text || '',
            pictures: (detData.pictures || []).slice(0, 3).map((p: any) => p.url),
            manufacturing_days: detData.sale_terms?.find((t: any) => t.id === 'MANUFACTURING_TIME')?.value_name || '0',
            health: detData.health,
            professionalism: Math.round((detData.health || 0) * 100)
          };
        }));

        // 3. Radar de Competencia (Ejemplo para el Producto Estrella)
        const competitorRes = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=Cartel de bienvenida bebé&limit=5`);
        const competitorData = await competitorRes.json();
        const competition = (competitorData.results || []).map(r => ({
          title: r.title,
          price: r.price,
          free_shipping: r.shipping?.free_shipping,
          listing_type: r.listing_type_id
        }));

        return res.status(200).json({
           account_id: mlUserId,
           reputation: userData.seller_reputation,
           unanswered_questions: questionsData.total || 0,
           items_count: searchData.paging?.total || 0,
           recent_orders: ordersData.results?.length || 0,
           orders_summary: ordersData.results?.slice(0, 10) || [],
           ads: adsData.results || [],
           top_items: itemsMetrics,
           competition,
           sales: ordersData
        });
      }

      case 'strategic-analysis': {
        const { metrics, goals, current_inventory, isChat, history, message, attachment } = req.body;
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-3.1-pro-preview",
          systemInstruction: `
            Eres VANGUARD, el Socio Estratégico Senior de 3D2 Store. 
            Misión: Reputación (Misión #1), Ventas y Rentabilidad Neta real.
            Estilo: Consultor senior, directo y obsesionado con el margen.
            
            REGLAS DE ANÁLISIS MEJORADAS:
            1. REPUTACIÓN Y SALUD: Vigila la tasa de reclamos y demoras. Si detectas Manufacturing Days altos con demoras, sugiere ampliar plazos o pausar preventivamente.
            2. PUBLICIDAD (ADS): Analiza el ACOS. Si el ACOS es mayor al margen de producto, sugiere pausar Ads. Prioriza inversión en Protagonistas.
            3. RENTABILIDAD QUIRÚRGICA: 
               - Costo de Material: Asume $20,000 ARS por 1kg de filamento PETG/PLA. Si un producto usa 172g, el costo base es (172/1000 * 20000).
               - Impuestos/Comisiones: Calcula ~15% de comisión ML (Gold) + ~10% de retenciones impositivas estimadas.
               - Sugiere subas de precio si la Ganancia Neta es < 20%.
            4. RADAR DE COMPETENCIA: Compara el precio del "Cartel de bienvenida" con los 5 competidores del radar. Si estamos >15% arriba sin Envío Gratis, sugiere ajuste.
            5. EMBUDO ORGÁNICO: Si un ítem tiene >500 visitas/mes pero <1% de conversión, el problema no es tráfico, es la publicación (fotos/precio). Sugiere cambios.

            REGLA DE ORO HITL: NUNCA ejecutes nada solo. Propón mediante bloques \`\`\`action.
          `
        });

        if (isChat) {
          const chat = model.startChat({
            history: (history || []).map(m => ({
                role: m.role === 'vanguard' ? 'model' : 'user',
                parts: [{ text: String(m.content) }]
            }))
          });
          
          let chatParts = [];
          const contextPrompt = `
            SOLICITUD: ${message || 'Revisa esta imagen'}
            
            CONTEXTO REAL DE MERCADOLIBRE (DATOS OFICIALES API):
            - MÉTRICAS DE CUENTA: ${JSON.stringify(metrics || {})}
            - PRODUCTOS ACTIVOS (Full Data): ${JSON.stringify(metrics?.top_items || [])}
            - STOCK INTERNO (Referencia): ${JSON.stringify(current_inventory || [])}
            
            REGLA: Si hay discrepancia entre el Stock Interno y MercadoLibre, prioriza la advertencia al usuario. 
            Usa las descripciones y fotos de 'PRODUCTOS ACTIVOS' para responder dudas sobre publicaciones.
          `;
          
          chatParts.push({ text: contextPrompt });
          
          if (attachment) {
            try {
              const base64Data = attachment.split(',')[1];
              const mimeType = attachment.split(';')[0].split(':')[1];
              chatParts.push({ inlineData: { data: base64Data, mimeType } });
            } catch (err) { console.error("Error attachment", err); }
          }

          const result = await chat.sendMessage(chatParts);
          const reply = result.response.text();
          
          try {
            // Regla de Oro: Limpiamos los attachments del history para que la BD no explote guardando bytes innecesarios.
            const cleanHistory = (history || []).map(h => ({ role: h.role, content: h.content }));
            const userContent = attachment ? `🖼️ [Imagen adjunta enviada] ${message}` : message;
            
            const updatedHistory = [...cleanHistory, { role: 'user', content: String(userContent) }, { role: 'vanguard', content: String(reply) }];
            if (supabase) {
              await supabase.from('vanguard_memory').upsert({
                  user_id: String(userId),
                  event_type: 'chat_history',
                  content: updatedHistory
              }, { onConflict: 'user_id,event_type' });
            }
          } catch (e) { 
            console.error('Error no crítico guardando chat:', e); 
          }

          return res.status(200).json({ reply });
        }

        const prompt = `Analiza los siguientes datos y devuelve OBLIGATORIAMENTE un objeto JSON puro con esta estructura exacta:
        {
          "summary": "resumen breve",
          "performance_score": 0-100,
          "insights": [{"type": "warning|opportunity|success", "title": "...", "description": "..."}],
          "categorized_items": {"protagonists": [], "stagnant": [], "zombies": []},
          "strategic_plan": "...",
          "recommended_actions": [{"action": "...", "item_id": "...", "reason": "...", "impact": "alto|medio|bajo"}],
          "ads_sales": 0,
          "organic_sales": 0,
          "clicks": 0,
          "total_revenue": 0,
          "acos": 0
        }
        DATOS: MÉTRICAS: ${JSON.stringify(metrics)} | OBJETIVOS: ${JSON.stringify(goals)} | INVENTARIO: ${JSON.stringify(current_inventory)}`;
        
        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        
        // Función de extracción quirúrgica de JSON
        const extractJson = (text) => {
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace === -1 || lastBrace === -1) return null;
          
          let candidate = text.substring(firstBrace, lastBrace + 1);
          // Intentar limpiar marcadores de markdown remanentes dentro del bloque
          candidate = candidate.replace(/```json/g, "").replace(/```/g, "").trim();
          
          // Si todavía hay problemas, intentamos parsear por bloques si la IA mandó basura intermedia
          try {
            return JSON.parse(candidate);
          } catch (e) {
            // Reintento: buscar el primer bloque completo válido
            const matches = text.match(/\{[\s\S]*?\}/g);
            if (matches) {
              for (const m of matches) {
                try { return JSON.parse(m); } catch (i) {}
              }
            }
            throw e;
          }
        };

        const finalObj = extractJson(responseText);
        if (!finalObj) {
          throw new Error("La IA no devolvió un formato de datos válido.");
        }

        try {
          if (supabase) {
            await supabase.from('vanguard_memory').upsert({
                user_id: String(userId),
                event_type: 'latest_analysis',
                content: { analysis: finalObj, goals }
            }, { onConflict: 'user_id,event_type' });
          }
        } catch (e) { console.error('Error guardando análisis:', e); }

        return res.status(200).json(finalObj);
      }

      case 'execute-hitl': {
        const { intent, item_id, value } = req.body;
        if (!accessToken) return res.status(401).json({ error: "No hay token de MercadoLibre para ejecutar la acción." });
        
        let mlResponse;
        if (intent === 'update_price') {
           mlResponse = await fetch(`https://api.mercadolibre.com/items/${item_id}`, {
               method: 'PUT',
               headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ price: Number(value) })
           });
        } 
        else if (intent === 'pause_item') {
           mlResponse = await fetch(`https://api.mercadolibre.com/items/${item_id}`, {
               method: 'PUT',
               headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ status: 'paused' })
           });
        }
        else if (intent === 'activate_item') {
           mlResponse = await fetch(`https://api.mercadolibre.com/items/${item_id}`, {
               method: 'PUT',
               headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ status: 'active' })
           });
        }
        else {
           return res.status(400).json({ error: "Intención de ejecución no soportada por el motor de seguridad HITL." });
        }

        const data = await mlResponse.json();
        if (!mlResponse.ok) {
           throw new Error(data.message || 'Error desconocido al invocar la API de MercadoLibre');
        }

        return res.status(200).json({ success: true, message: `Acción externa aplicada correctamente en la publicación ${item_id}` });
      }

      case 'oauth': {
        const { code } = req.body;
        const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
        const client_secret = process.env.VITE_ML_APP_SECRET || process.env.VITE_ML_CLIENT_SECRET || process.env.ML_APP_SECRET;
        const redirect_uri = process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI;
        const tokenUrl = 'https://api.mercadolibre.com/oauth/token';
        const params = new URLSearchParams({ grant_type: 'authorization_code', client_id, client_secret, code, redirect_uri });

        const r = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: 'OAuth failed', details: data });

        const payload = {
          user_id: String(data.user_id),
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        };
        await supabase.from('ml_tokens').upsert(payload, { onConflict: 'user_id' });
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Unsupported action' });
    }

  } catch (error) {
    console.error(`[ML Manager] Error:`, error);
    return res.status(500).json({ 
      error: error.message, 
      context: 'Error en ml-manager',
      action: action,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
