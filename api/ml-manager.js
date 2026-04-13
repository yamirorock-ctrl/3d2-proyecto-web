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
    const needsToken = ['get-metrics', 'strategic-analysis', 'suggest-title', 'bulk-sync-stock', 'sync-product', 'get-promotions', 'auto-link', 'execute-hitl'].includes(action);
    let accessToken = null;
    let dbToken = null;

      if (needsToken) {
        // Buscamos el token vinculado específicamente a ESTE usuario de la plataforma
        const { data, error: tokenError } = await supabase
          .from('ml_tokens')
          .select('*')
          .eq('user_id', String(userId))
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tokenError || !data || !data.access_token) {
          // Fallback: Si no hay por ID específico, intentamos el último global para evitar bloqueo total en el simulador
          const { data: globalData } = await supabase.from('ml_tokens').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (!globalData) return res.status(401).json({ error: 'No hay token de ML vinculado.' });
          dbToken = globalData;
        } else {
          dbToken = data;
        }
        accessToken = dbToken.access_token;

      // Refresh Token IF EXPIRED (30 mins grace)
      const now = new Date();
      const updatedAt = new Date(dbToken.updated_at || 0);
      const expiresIn = dbToken.expires_in || 21600; // Default ML: 6h
      const expiresAt = new Date(updatedAt.getTime() + expiresIn * 1000);
      
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
            expires_in: refreshData.expires_in,
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

        const history = data?.find(d => d.event_type === 'chat_history')?.content || [];
        
        // Solo enviamos al UI lo de las últimas 24h para el "chat limpio"
        const rollingLimit = new Date();
        rollingLimit.setHours(rollingLimit.getHours() - 24);
        const activeChat = history.filter(h => !h.timestamp || new Date(h.timestamp) > rollingLimit);

        const state = {
          analysis: data?.find(d => d.event_type === 'latest_analysis')?.content?.analysis || null,
          goals: data?.find(d => d.event_type === 'latest_analysis')?.content?.goals || null,
          chat_history: activeChat
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
                    const predResp = await fetch(`https://api.mercadolibre.com/sites/MLA/domain_discovery/search?q=${encodeURIComponent(queryText)}&limit=3`);
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

            // NUEVO: Protocolo de Seguridad Vanguard - Validación Pre-Publicación
            const validateResp = await fetch(`https://api.mercadolibre.com/items/validate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(itemBody)
            });

            if (validateResp.status !== 204) {
               const validateData = await validateResp.json();
               return res.status(400).json({ 
                 error: 'Error de validación en MercadoLibre. Corrige los siguientes puntos antes de publicar:',
                 details: validateData.error || validateData.message,
                 cause: validateData.cause
               });
            }

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
        const mlUserId = dbToken.ml_user_id || dbToken.user_id; // Priorizar ID numérico de ML
        const headers = { Authorization: `Bearer ${accessToken}` };

        // 1. Datos base: Items, Órdenes y Campañas generales
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);

        const [searchRes, ordersRes, userRes, questionsRes, adsAuthRes] = await Promise.all([
          fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active`, { headers }),
          fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dateFrom.toISOString()}`, { headers }),
          fetch(`https://api.mercadolibre.com/users/${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/questions/search?seller_id=${mlUserId}&status=unanswered`, { headers }),
          // Paso 1 de Ads V2: Obtener el ID de Anunciante
          fetch(`https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`, { headers: { ...headers, 'api-version': '1' } })
        ]);

        const [searchData, ordersData, userData, questionsData, adsAuthData] = await Promise.all([
          searchRes.json(), ordersRes.json(), userRes.json(), questionsRes.json(), adsAuthRes.json()
        ]);

        // Paso 2 de Ads V2: Consultar campañas usando Advertiser ID + Site ID
        let adsData = { results: [] };
        let adsStatus = 0;
        const advertiser = (adsAuthData.advertisers || []).find(a => a.site_id === 'MLA'); // Buscamos Argentina
        if (advertiser) {
          const dateTo = new Date();
          const adsUrl = `https://api.mercadolibre.com/advertising/MLA/advertisers/${advertiser.advertiser_id}/product_ads/campaigns/search?date_from=${dateFrom.toISOString().split('T')[0]}&date_to=${dateTo.toISOString().split('T')[0]}&metrics=clicks,prints,cost,acos,roas`;
          const adsSearchRes = await fetch(adsUrl, { headers: { ...headers, 'api-version': '2' } });
          adsData = await adsSearchRes.json();
          adsStatus = adsSearchRes.status;
        }

        // 1. Obtención de productos activos (Aumentamos el límite a 25 para evitar el recorte reportado)
        const mlIds = (searchData.results || []).slice(0, 25);

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
            pictures: (detData.pictures || []).slice(0, 3).map((p) => p.url),
            manufacturing_days: detData.sale_terms?.find((t) => t.id === 'MANUFACTURING_TIME')?.value_name || '0',
            status: detData.status,
            health: detData.health,
            professionalism: Math.round((detData.health || 0) * 100),
            category_id: detData.category_id
          };
        }));

        // 3. Radar de Competencia Dinámico (Usa el producto activo más importante)
        let competition = [];
        try {
          if (itemsMetrics.length > 0) {
            // Buscamos productos en la misma categoría usando solo las 2 primeras palabras clave para red amplia
            const topItem = itemsMetrics[0];
            const topProductKeyword = encodeURIComponent(topItem.title.split(' ').slice(0, 2).join(' '));
            
            // Endpoint público DEBE llevar Token porque sino ML tira 403 Forbidden a servidores
            const competitorRes = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${topProductKeyword}&category=${topItem.category_id}&limit=15`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const competitorData = await competitorRes.json();
            
            if (competitorData.results) {
               // Filtramos la basura y ASEGURAMOS excluir nuestros propios productos
               competition = competitorData.results
                 .filter(r => String(r.seller?.id) !== String(mlUserId))
                 .slice(0, 5)
                 .map(r => ({
                   title: r.title,
                   price: r.price,
                   free_shipping: r.shipping?.free_shipping,
                   listing_type: r.listing_type_id,
                   sold_quantity: r.sold_quantity || 0,
                   permalink: r.permalink
                 }));
            }
          }
        } catch (e) { console.error("Radar fail", e); }

        const finalAds = adsData.results || (Array.isArray(adsData) ? adsData : (adsData.campaigns || []));

        return res.status(200).json({
           account_id: mlUserId,
           reputation: userData.seller_reputation,
           unanswered_questions: questionsData.total || 0,
           items_count: searchData.paging?.total || 0,
           recent_orders: ordersData.results?.length || 0,
           orders_summary: ordersData.results?.slice(0, 10) || [],
           ads: finalAds,
           top_items: itemsMetrics,
           competition,
           sales: ordersData,
           debug_info: {
             ads_status: adsStatus,
             search_status: searchRes.status,
             competition_count: competition.length,
             items_metrics_count: itemsMetrics.length,
             ads_raw: JSON.stringify(adsData).substring(0, 500) // Telemetría para debug
           }
        });
      }

      case 'strategic-analysis': {
        const { metrics, goals, current_inventory, isChat, history, message, attachment, attachments } = req.body;
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        
        if (isChat) {
          // 1. Configuración para CHAT (Fluido y Dinámico)
          const chatModel = genAI.getGenerativeModel({ 
            model: "gemini-3.1-pro-preview",
            systemInstruction: `
              Eres VANGUARD, el Socio Estratégico Senior de 3D2 Store. 
              DINAMISMO ADAPTATIVO: No tienes límite de palabras, pero eres eficiente. 
              - Si el usuario saluda o hace una duda simple: Respuesta corta y cordial.
              - Si se debate estrategia o fallos técnicos: Respuesta profunda, detallada y analítica.
              - No uses introducciones repetitivas. No te presentes si ya hay historial.
              - Tu objetivo es una charla fluida, natural y humana.
            `
          });

          const rollingLimit = new Date();
          rollingLimit.setHours(rollingLimit.getHours() - 24);
          
          const rawHistory = history || [];
          // Filtramos y aseguramos que el historial para Gemini empiece SIEMPRE con un USER
          let activeHistory = rawHistory.filter(h => !h.timestamp || new Date(h.timestamp) > rollingLimit);
          while (activeHistory.length > 0 && activeHistory[0].role === 'vanguard') {
            activeHistory.shift(); 
          }
          
          const archivedHistory = rawHistory.filter(h => h.timestamp && new Date(h.timestamp) <= rollingLimit);

          const chat = chatModel.startChat({
            history: activeHistory.map(m => ({
                role: m.role === 'vanguard' ? 'model' : 'user',
                parts: [{ text: String(m.content) }]
            }))
          });
          
          let chatParts = [];
          
          // Resumen de Memoria Larga (HITL History)
          let longTermContext = "";
          if (archivedHistory.length > 0) {
            longTermContext = `\n[MEMORIA DE SESIONES ANTERIORES (>24hs)]:\n${archivedHistory.map(h => `${h.role}: ${h.content.substring(0, 100)}...`).join('\n')}\n`;
          }
          const contextPrompt = `
            SOLICITUD ACTUAL: ${message || 'Sin mensaje adicional'}
            ---
            CONTEXTO ESTRATÉGICO (CONOCIMIENTO DE FONDO):
            - REPUTACIÓN: ${JSON.stringify(metrics?.reputation || {})}
            - ÓRDENES (30d): ${metrics?.recent_orders || 0} órdenes. Recientes: ${JSON.stringify(metrics?.orders_summary?.slice(0, 5) || [])}
            - ADS: ${JSON.stringify(metrics?.ads || [])}
            - COMPETENCIA: ${JSON.stringify(metrics?.competition || [])}
            - STOCK INTERNO (DB): ${JSON.stringify((current_inventory || []).map(i => ({ id: i.id, stock: i.stock, cost: i.cost_usd || i.production_cost })))}
            - CATÁLOGO ML: ${JSON.stringify((metrics?.top_items || []).map(i => ({ id: i.id, title: i.title, status: i.status, visits: i.visits_30d })))}
            ---
            REGLA DE VANGUARD: Responde directamente a la SOLICITUD ACTUAL. Usa los DATOS ESTRATÉGICOS solo para validar tu respuesta o si el usuario te lo pide. No imprimas reportes completos por defecto.
          `;
          
          chatParts.push({ text: longTermContext + contextPrompt });
          
          if (attachments && Array.isArray(attachments)) {
            attachments.forEach(att => {
              try {
                const base64Data = att.split(',')[1];
                const mimeType = att.split(';')[0].split(':')[1];
                chatParts.push({ inlineData: { data: base64Data, mimeType } });
              } catch (err) { console.error("Error attachment", err); }
            });
          } else if (attachment) {
            try {
              const base64Data = attachment.split(',')[1];
              const mimeType = attachment.split(';')[0].split(':')[1];
              chatParts.push({ inlineData: { data: base64Data, mimeType } });
            } catch (err) { console.error("Error attachment", err); }
          }

          const result = await chat.sendMessage(chatParts);
          const reply = result.response.text();
          try {
            const hasAttachments = (attachments && attachments.length > 0) || attachment;
            const userContent = hasAttachments ? `🖼️ [Imágenes adjuntas enviadas] ${message}` : message;
            
            let persistentHistory = [];
            if (supabase) {
              const { data: currentMemory } = await supabase
                .from('vanguard_memory')
                .select('content')
                .eq('user_id', String(userId))
                .eq('event_type', 'chat_history')
                .maybeSingle();
              persistentHistory = currentMemory?.content || [];
            }
            
            const updatedHistory = [
              ...persistentHistory, 
              { role: 'user', content: String(userContent), timestamp: new Date().toISOString() }, 
              { role: 'vanguard', content: String(reply), timestamp: new Date().toISOString() }
            ];
            if (supabase) {
              await supabase.from('vanguard_memory').upsert({
                  user_id: String(userId),
                  event_type: 'chat_history',
                  content: updatedHistory,
                  updated_at: new Date().toISOString()
              }, { onConflict: 'user_id,event_type' });
            }
          } catch (e) { 
            console.error('Error no crítico guardando chat:', e); 
          }

          return res.status(200).json({ reply });
        }

        const analysisModel = genAI.getGenerativeModel({ 
          model: "gemini-3.1-pro-preview",
          systemInstruction: "Eres un analista senior de e-commerce. Genera reportes técnicos en formato JSON."
        });

        const prompt = `Analiza estos datos de MercadoLibre y genera un JSON con este esquema exacto:
        {
          "summary": "Resumen ejecutivo corto sobre rentabilidad",
          "performance_score": 0-100,
          "insights": [{"type": "warning|opportunity|success", "title": "...", "description": "..."}],
          "categorized_items": { "protagonists": [], "stagnant": [], "zombies": [] },
          "strategic_plan": "Plan detallado para esta semana",
          "recommended_actions": [{"intent": "update_price|pause_item|activate_item", "action": "...", "item_id": "MLA...", "value": 0, "reason": "...", "impact": "alto"}],
          "ads_manager": {
             "total_budget_active": 0,
             "roas_global": 0,
             "active_campaigns": [{"name": "...", "budget": 0, "roas_target": 0, "status": "..."}]
          },
          "ads_sales": 0, "organic_sales": 0, "clicks": 0, "total_revenue": 0, "acos": 0
        }
        DATOS REALES Y PUBLICIDAD (Campañas, Presupuesto, ROAS): ${JSON.stringify(metrics).substring(0, 30000)}`;
        
        const result = await analysisModel.generateContent(prompt);
        const responseText = result.response.text();
        
        let finalObj = null;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            finalObj = JSON.parse(jsonMatch[0].trim());
          }
        } catch (e) {
          console.error("Parse Error:", e);
        }

        if (!finalObj) {
           finalObj = {
             summary: "Hito técnico: Los datos están fluyendo pero la IA no logró estructurarlos. Recarga en unos segundos.",
             performance_score: 50,
             insights: [{type: 'warning', title: 'Sincronización en curso', description: 'El volumen de datos es alto. Intenta de nuevo.'}],
             categorized_items: { protagonists: [], stagnant: [], zombies: [] },
             strategic_plan: "Analizando señales de mercado...",
             recommended_actions: [],
             ads_manager: { total_budget_active: 0, roas_global: 0, active_campaigns: [] },
             ads_sales: 0, organic_sales: 0, clicks: 0, total_revenue: 0, acos: 0
           };
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
        const { code, userId: supabaseUserId } = req.body;
        const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
        const client_secret = process.env.VITE_ML_APP_SECRET || process.env.VITE_ML_CLIENT_SECRET || process.env.ML_APP_SECRET;
        const redirect_uri = process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI;
        const tokenUrl = 'https://api.mercadolibre.com/oauth/token';
        const params = new URLSearchParams({ grant_type: 'authorization_code', client_id, client_secret, code, redirect_uri });

        const r = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: 'OAuth failed', details: data });

        const payload = {
          user_id: supabaseUserId || String(data.user_id), // Guardamos el ID de Supabase para filtrado
          ml_user_id: String(data.user_id),              // Guardamos el ID de ML para los endpoints
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
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
