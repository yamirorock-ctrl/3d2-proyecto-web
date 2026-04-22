import { createClient } from '@supabase/supabase-js';
import OpenAI from "openai";

// VANGUARD STABLE BUILD v2.1.0 - Force Vercel Deploy

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let openai = null;
if (OPENAI_API_KEY) {
  try { openai = new OpenAI({ apiKey: OPENAI_API_KEY }); } catch (e) { console.error("OpenAI Init Error"); }
}

async function safeJson(response) {
  try {
    const text = await response.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch (e) { return {}; }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  
  const actionRaw = req.query.action || req.body?.action;
  const action = actionRaw ? String(actionRaw).trim() : null;
  const userId = req.query.userId || req.body?.userId;

  if (!action || !userId) return res.status(400).json({ error: 'Missing action/userId' });

  try {
    const needsToken = ['get-metrics', 'strategic-analysis', 'bulk-sync-stock', 'sync-product', 'get-promotions', 'auto-link', 'execute-hitl'].includes(action);
    let accessToken = null;
    let dbToken = null;

    if (needsToken) {
      const { data, error: tErr } = await supabase.from('ml_tokens').select('*').eq('user_id', String(userId)).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (tErr || !data) {
          const { data: gData } = await supabase.from('ml_tokens').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (!gData) return res.status(401).json({ error: 'No Token' });
          dbToken = gData;
      } else { dbToken = data; }
      accessToken = dbToken.access_token;
      
      const now = new Date();
      const expiresAt = new Date(new Date(dbToken.updated_at || 0).getTime() + (dbToken.expires_in || 21600) * 1000);
      if (now >= expiresAt || (expiresAt - now < 1800000)) {
        const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
        const client_secret = process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET;
        const rResp = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', client_id, client_secret, refresh_token: dbToken.refresh_token })
        });
        const rData = await safeJson(rResp);
        if (rResp.ok && rData.access_token) {
          accessToken = rData.access_token;
          await supabase.from('ml_tokens').update({ access_token: rData.access_token, refresh_token: rData.refresh_token, expires_in: rData.expires_in, updated_at: new Date().toISOString() }).eq('user_id', dbToken.user_id);
        }
      }
    }

    switch (action) {
      case 'get-vanguard-state': {
        const { data } = await supabase.from('vanguard_memory').select('*').eq('user_id', String(userId));
        const history = data?.find(d => d.event_type === 'chat_history')?.content || [];
        const blackBox = data?.find(d => d.event_type === 'black_box')?.content || { text: "" };
        return res.status(200).json({
          analysis: data?.find(d => d.event_type === 'latest_analysis')?.content?.analysis || null,
          goals: data?.find(d => d.event_type === 'latest_analysis')?.content?.goals || null,
          chat_history: history.slice(-10),
          black_box: blackBox
        });
      }

      case 'strategic-analysis': {
        const { metrics, goals, isChat, history, message, attachments } = req.body;
        if (!openai) return res.status(200).json({ reply: "Vanguard Offline" });

        // LEER CAJA NEGRA DESDE SUPABASE
        const { data: bbData } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'black_box').maybeSingle();
        const currentBlackBox = bbData?.content?.text || "";

        const contextData = {
            ...metrics,
            black_box: currentBlackBox,
            goals: goals
        };
        if (isChat) {
          const h = (history || []).slice(-20);
          try {
            // Construir contenido del mensaje actual (Multimodal si hay adjuntos)
            let currentContent = [];
            currentContent.push({ type: "text", text: `CONTEXTO TIENDA: ${JSON.stringify(contextData)}\nOBJETIVOS: ${goals}\n\nSOLICITUD DEL USUARIO: ${message}` });
            
            if (attachments && attachments.length > 0) {
              attachments.forEach(url => {
                currentContent.push({ type: "image_url", image_url: { url: url } });
              });
            }

            const r = await openai.chat.completions.create({
              model: "gpt-5.4-mini", 
              messages: [
                { role: "system", content: "Eres VANGUARD 360°, socio de 3D2 Store. Habla como un HUMANO en un chat: corto, directo, sin encabezados (##) ni listas largas. Tienes una CAJA NEGRA de memoria persistente. Si el usuario te pide guardar algo ahí (ej: 'guarda esta estrategia en la caja negra'), tu respuesta DEBE empezar con [SAVE_TO_BLACK_BOX] seguido del contenido a guardar. Si pide borrarla, empieza con [DELETE_BLACK_BOX]. Sé empático, fluido y ahorra tiempo. Faltan 10 ventas para MercadoLíder (60 en 60 días)." },
                ...h.map(m => ({ role: m.role === 'vanguard' ? 'assistant' : 'user', content: String(m.content) })),
                { role: "user", content: currentContent }
              ],
              max_completion_tokens: 1500
            });

            let reply = r.choices[0].message.content;
            let updateBlackBox = null;

            if (reply.startsWith("[SAVE_TO_BLACK_BOX]")) {
                const contentToSave = reply.replace("[SAVE_TO_BLACK_BOX]", "").trim();
                const newBB = currentBlackBox + "\n" + contentToSave;
                await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'black_box', content: { text: newBB }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
                reply = "Hecho, socio. Ya guardé esa información en la Caja Negra para tenerla siempre a mano. 🧠📦";
                updateBlackBox = { text: newBB };
            } else if (reply.startsWith("[DELETE_BLACK_BOX]")) {
                await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'black_box', content: { text: "" }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
                reply = "Caja Negra reseteada. Empezamos de cero con ese hemisferio. 🧹📦";
                updateBlackBox = { text: "" };
            }

            const newH = [...h, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
            await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'chat_history', content: newH }, { onConflict: 'user_id,event_type' });
            return res.status(200).json({ reply, history: newH, black_box: updateBlackBox });
          } catch (e) { return res.status(200).json({ reply: "Error IA: " + e.message, history: history || [] }); }
        } else {
          try {
            const r = await openai.chat.completions.create({
              model: "gpt-5.4-mini", 
              messages: [
                { role: "system", content: "Socio Estratégico 360° de 3D2 Store. Tu salida DEBE ser un JSON con este esquema exacto: { summary, performance_score, insights: [{type, title, description}], categorized_items: { protagonists:[], stagnant:[], zombies:[] }, strategic_plan, recommended_actions: [{intent, action, item_id, value, reason, impact}], ads_manager: { total_budget_active, roas_global, active_campaigns: [{name, budget, roas_target, status}] }, ads_sales, organic_sales, clicks, total_revenue, acos }. El 'summary' debe ser humano, empático y directo, como un socio hablando con otro." },
                { role: "user", content: `Analiza integralmente y devuelve el JSON requerido según el esquema: ${JSON.stringify(contextData)}` }
              ],
              response_format: { type: "json_object" },
              max_completion_tokens: 4000
            });
            const obj = JSON.parse(r.choices[0].message.content);
            await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'latest_analysis', content: { analysis: obj, goals } }, { onConflict: 'user_id,event_type' });
            return res.status(200).json(obj);
          } catch (e) { return res.status(200).json({ summary: "Error Análisis: " + e.message }); }
        }
      }

      case 'get-metrics': {
        const mlUserId = dbToken.ml_user_id || dbToken.user_id;
        const headers = { Authorization: `Bearer ${accessToken}` };
        const dF = new Date(); dF.setDate(dF.getDate() - 30);
        const [searchRes, ordersRes, userRes, questionsRes, adsAuthRes] = await Promise.all([
          fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dF.toISOString()}&sort=date_desc&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/users/${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/questions/search?seller_id=${mlUserId}&status=unanswered`, { headers }),
          fetch(`https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`, { headers: { ...headers, 'api-version': '1' } })
        ]);
        const [searchData, ordersData, userData, questionsData, adsAuthData] = await Promise.all([safeJson(searchRes), safeJson(ordersRes), safeJson(userRes), safeJson(questionsRes), safeJson(adsAuthRes)]);
        let ads = [];
        const advertiser = (adsAuthData.advertisers || []).find(a => a.site_id === 'MLA');
        if (advertiser) {
          const adsUrl = `https://api.mercadolibre.com/advertising/MLA/advertisers/${advertiser.advertiser_id}/product_ads/campaigns/search?date_from=${dF.toISOString().split('T')[0]}&date_to=${new Date().toISOString().split('T')[0]}&metrics=clicks,prints,cost,acos,roas`;
          const adsSearchRes = await fetch(adsUrl, { headers: { ...headers, 'api-version': '2' } });
          const adsJson = await safeJson(adsSearchRes);
          ads = adsJson.results || [];
        }
        let fin = { total_gross_amount: 0, accredited_amount: 0, pending_amount: 0 };
        let log = { handling: 0, ready_to_ship: 0, shipped: 0, delivered: 0, cancelled: 0 };
        if (ordersData.results) {
            ordersData.results.forEach(order => {
                const amount = order.total_amount || 0;
                fin.total_gross_amount += amount;
                if (order.status === 'paid' || order.status === 'closed') fin.accredited_amount += amount;
                else if (order.status !== 'cancelled') fin.pending_amount += amount;
                const sStatus = order.shipping?.status;
                if (sStatus && log.hasOwnProperty(sStatus)) log[sStatus]++;
            });
        }
        const mlIds = (searchData.results || []).slice(0, 25);
        const itemsMetrics = await Promise.all(mlIds.map(async (id) => {
          try {
            const [vR, dR] = await Promise.all([fetch(`https://api.mercadolibre.com/items/${id}/visits/time_window?last=30&unit=day`, { headers }), fetch(`https://api.mercadolibre.com/items/${id}`, { headers })]);
            const vD = await safeJson(vR), dD = await safeJson(dR);
            return { id, title: dD.title || "Sin título", visits_30d: vD.total_visits || 0, sold_quantity: dD.sold_quantity || 0, price: dD.price || 0, stock: dD.available_quantity || 0, status: dD.status || "active", category_id: dD.category_id, health: dD.health || 0.85 };
          } catch(e) { return { id, title: "Error" }; }
        }));
        let competition = [];
        if (itemsMetrics.length > 0) {
            try {
                const topItem = itemsMetrics[0];
                const keyword = encodeURIComponent(topItem.title.split(' ').slice(0, 2).join(' '));
                const compRes = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${keyword}&category=${topItem.category_id}&limit=5`, { headers });
                const compData = await safeJson(compRes);
                if (compData.results) competition = compData.results.filter(r => String(r.seller?.id) !== String(mlUserId)).map(r => ({ title: r.title, price: r.price, sold_quantity: r.sold_quantity || 0 }));
            } catch(e) {}
        }
        return res.status(200).json({ reputation: userData.seller_reputation, unanswered_questions: questionsData.total || 0, items_count: searchData.paging?.total || 0, recent_orders: ordersData.results?.length || 0, orders_summary: ordersData.results?.slice(0, 10) || [], ads: ads, ads_summary: ads, finance_summary: fin, logistics_summary: log, top_items: itemsMetrics, competition: competition, sales: ordersData });
      }

      case 'get-goals': {
        const { data } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'vanguard_goals').maybeSingle();
        return res.status(200).json(data?.content || { text: "" });
      }
      
      case 'save-goals': {
        await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'vanguard_goals', content: { text: req.body.goals }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
        return res.status(200).json({ success: true });
      }

      case 'save-black-box': {
        await supabase.from('vanguard_memory').upsert({ 
          user_id: String(userId), 
          event_type: 'black_box', 
          content: { text: req.body.text }, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id,event_type' });
        return res.status(200).json({ success: true });
      }

      case 'sync-product': {
          const { productId, markupPercentage = 25, productData } = req.body;
          // Si no viene productData, lo traemos de la DB
          let p = productData;
          if (!p) {
              const { data } = await supabase.from('products').select('*').eq('id', productId).single();
              p = data;
          }
          if (!p) return res.status(404).json({ error: 'Producto no encontrado' });

          const finalPrice = Math.round((p.price || 0) * (1 + (markupPercentage / 100)));
          const headers = { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          };

          // Si NO tiene ML ID, publicamos nuevo
          if (!p.ml_item_id) {
              // Validación de fotos: ML no permite publicar sin fotos
              const hasPhotos = p.images?.length || p.image || p.image_url;
              if (!hasPhotos) {
                  return res.status(400).json({ 
                      error: 'validation_error', 
                      message: 'El producto debe tener al menos una imagen para ser publicado en Mercado Libre.' 
                  });
              }
          }

          // Si YA tiene ML ID, actualizamos (Stock y Precio)
          if (p.ml_item_id) {
              const updateBody = {
                  price: finalPrice,
                  available_quantity: Math.max(0, p.stock || 0)
              };
              const r = await fetch(`https://api.mercadolibre.com/items/${p.ml_item_id}`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify(updateBody)
              });
              const d = await safeJson(r);
              if (!r.ok) return res.status(r.status).json(d);
              
              // Actualizamos db local por si acaso
              await supabase.from('products').update({ 
                  ml_status: d.status,
                  ml_sync_at: new Date().toISOString()
              }).eq('id', productId);

              return res.status(200).json({ success: true, mode: 'update', data: d });
          } else {
              // Si NO tiene ML ID, publicamos nuevo
              // 1. Predecir categoría si no tiene
              let catId = p.ml_category_id;
              if (!catId) {
                  const cR = await fetch(`https://api.mercadolibre.com/sites/MLA/domain_discovery/search?q=${encodeURIComponent(p.name)}`);
                  const cD = await safeJson(cR);
                  if (cD && cD[0]) catId = cD[0].category_id;
              }

              const publishBody = {
                  title: (p.ml_title || p.name).slice(0, 60),
                  category_id: catId || 'MLA3530', 
                  price: finalPrice,
                  currency_id: 'ARS',
                  available_quantity: Math.max(1, p.stock || 0),
                  buying_mode: 'buy_it_now',
                  listing_type_id: 'gold_special', 
                  condition: 'new',
                  description: {
                      plain_text: (p.description || `Producto ${p.name} por 3D2 Project.`).slice(0, 20000)
                  },
                  pictures: p.images?.length 
                    ? p.images.map(img => ({ source: img.url || img })) 
                    : (p.image || p.image_url) ? [{ source: p.image || p.image_url }] : [],
                  attributes: Object.entries(p.ml_attributes || {}).map(([key, val]) => ({
                      id: key,
                      value_name: String(val)
                  }))
              };

              // Si no hay atributos básicos, agregamos los mínimos por seguridad si no existen en ml_attributes
              const hasBrand = publishBody.attributes.some(a => a.id === 'BRAND');
              const hasModel = publishBody.attributes.some(a => a.id === 'MODEL');
              if (!hasBrand) publishBody.attributes.push({ id: 'BRAND', value_name: p.brand || '3D2' });
              if (!hasModel) publishBody.attributes.push({ id: 'MODEL', value_name: p.model || 'Standard' });

              const r = await fetch('https://api.mercadolibre.com/items', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(publishBody)
              });
              const d = await safeJson(r);
              if (!r.ok) {
                  return res.status(r.status).json({ 
                      error: d.error, 
                      message: d.message, 
                      causes: d.cause || d.causes || [], 
                      mlError: d.message 
                  });
              }

              // Guardamos el nuevo ML ID en Supabase
              await supabase.from('products').update({
                  ml_item_id: d.id,
                  ml_permalink: d.permalink,
                  ml_status: d.status,
                  ml_sync_at: new Date().toISOString()
              }).eq('id', productId);

              return res.status(200).json({ success: true, mode: 'create', data: d });
          }
      }

      case 'auto-link': {
          const rRes = await fetch(`https://api.mercadolibre.com/users/${dbToken.user_id}/items/search?status=active`, { headers });
          const rD = await safeJson(rRes);
          if (!rD.results?.length) return res.status(200).json({ linked: 0 });
          const detRes = await fetch(`https://api.mercadolibre.com/items?ids=${rD.results.join(',')}`, { headers });
          const items = (await safeJson(detRes)).map(x => x.body).filter(Boolean);
          const { data: prods } = await supabase.from('products').select('id, name');
          let count = 0;
          for (const i of items) {
              const match = prods.find(p => i.title.toLowerCase().includes(p.name.toLowerCase()));
              if (match) {
                  await supabase.from('products').update({ ml_item_id: i.id, ml_permalink: i.permalink, ml_status: i.status }).eq('id', match.id);
                  count++;
              }
          }
          return res.status(200).json({ linked: count });
      }

      case 'bulk-sync-stock': {
          const { productIds } = req.body;
          let q = supabase.from('products').select('id, stock, ml_item_id');
          if (productIds?.length) q = q.in('id', productIds);
          else q = q.not('ml_item_id', 'is', null);
          const { data: prods } = await q;
          const resArr = [];
          for (const p of prods) {
              if (!p.ml_item_id) continue;
              const r = await fetch(`https://api.mercadolibre.com/items/${p.ml_item_id}`, { method: 'PUT', headers, body: JSON.stringify({ available_quantity: Math.max(0, p.stock || 0) }) });
              resArr.push({ id: p.id, ok: r.ok });
          }
          return res.status(200).json({ results: resArr });
      }

      case 'oauth': {
        const { code, userId: sId } = req.body;
        const r = await fetch('https://api.mercadolibre.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.VITE_ML_APP_ID || process.env.ML_APP_ID, client_secret: process.env.VITE_ML_APP_SECRET || process.env.VITE_ML_APP_SECRET, code, redirect_uri: process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI }) });
        const d = await safeJson(r);
        if (!r.ok) return res.status(r.status).json(d);
        await supabase.from('ml_tokens').upsert({ user_id: sId || String(d.user_id), ml_user_id: String(d.user_id), access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        return res.status(200).json({ ok: true });
      }

      default: return res.status(400).json({ error: 'Action?', received: action });
    }
  } catch (err) {
    console.error("Global Error:", err);
    return res.status(200).json({ error: "Fallo global: " + err.message });
  }
}
