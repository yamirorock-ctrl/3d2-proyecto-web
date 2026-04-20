import { createClient } from '@supabase/supabase-js';
import OpenAI from "openai";

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
      case 'strategic-analysis': {
        const { metrics, goals, isChat, history, message } = req.body;
        if (!openai) return res.status(200).json({ reply: "Vanguard Offline" });
        
        // Formateo enriquecido para Vanguard (OpenAI) basado en el esquema de ayer
        const contextData = {
            reputation: metrics?.reputation || {},
            orders_30d: metrics?.recent_orders || 0,
            orders_detail: metrics?.orders_summary || [],
            advertising: metrics?.ads || [],
            competition: metrics?.competition || [],
            catalog: (metrics?.top_items || []).map(i => ({ id: i.id, title: i.title, visits: i.visits_30d, sales: i.sold_quantity, price: i.price, status: i.status })),
            finances: metrics?.finance_summary || {}
        };

        if (isChat) {
          const h = (history || []).slice(-8);
          try {
            const r = await openai.chat.completions.create({
              model: "gpt-5.4-mini", 
              messages: [
                { role: "system", content: "Eres VANGUARD 360°. Analista Senior Estratégico. Usa los datos para dar consejos directos y accionables." },
                ...h.map(m => ({ role: m.role === 'vanguard' ? 'assistant' : 'user', content: String(m.content) })),
                { role: "user", content: `CONTEXTO: ${JSON.stringify(contextData)}\nSOLICITUD: ${message}\nOBJETIVOS: ${goals}` }
              ],
              max_completion_tokens: 2500
            });
            const reply = r.choices[0].message.content;
            const newH = [...h, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
            await supabase.from('app_settings').upsert({ key: 'vanguard_history', value: newH }, { onConflict: 'key' });
            return res.status(200).json({ reply, history: newH });
          } catch (e) { return res.status(200).json({ reply: "Error IA: " + e.message, history: history || [] }); }
        } else {
          try {
            const r = await openai.chat.completions.create({
              model: "gpt-5.4-mini", 
              messages: [
                { role: "system", content: "Consultor Senior 360°. Genera un JSON estratégico profundo basado en los datos proporcionados." },
                { role: "user", content: `Analiza integralmente y devuelve JSON: ${JSON.stringify(contextData)}` }
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
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);
        const dS = dateFrom.toISOString().split('T')[0];
        const tS = new Date().toISOString().split('T')[0];

        // 1. Datos base (Igual que ayer)
        const [searchRes, ordersRes, userRes, questionsRes, adsAuthRes] = await Promise.all([
          fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dateFrom.toISOString()}&sort=date_desc&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/users/${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/questions/search?seller_id=${mlUserId}&status=unanswered`, { headers }),
          fetch(`https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`, { headers: { ...headers, 'api-version': '1' } })
        ]);

        const [searchData, ordersData, userData, questionsData, adsAuthData] = await Promise.all([
          safeJson(searchRes), safeJson(ordersRes), safeJson(userRes), safeJson(questionsRes), safeJson(adsAuthRes)
        ]);

        // 2. ADS con "La Llave Mágica" de métricas ( clicks,prints,cost,acos,roas )
        let ads = [];
        const advertiser = (adsAuthData.advertisers || []).find(a => a.site_id === 'MLA');
        if (advertiser) {
          const adsUrl = `https://api.mercadolibre.com/advertising/MLA/advertisers/${advertiser.advertiser_id}/product_ads/campaigns/search?date_from=${dS}&date_to=${tS}&metrics=clicks,prints,cost,acos,roas`;
          const adsSearchRes = await fetch(adsUrl, { headers: { ...headers, 'api-version': '2' } });
          const adsJson = await safeJson(adsSearchRes);
          ads = adsJson.results || [];
        }

        // 3. Finanzas y Logística (Calculado desde Órdenes generales + Resumen para IA)
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

        // 4. Catálogo Enriquecido (Visitas + DESCRIPCIÓN + Ventas)
        const mlIds = (searchData.results || []).slice(0, 25);
        const itemsMetrics = await Promise.all(mlIds.map(async (id) => {
          try {
            const [vRes, detRes] = await Promise.all([
              fetch(`https://api.mercadolibre.com/items/${id}/visits/time_window?last=30&unit=day`, { headers }),
              fetch(`https://api.mercadolibre.com/items/${id}`, { headers })
            ]);
            const [vData, detData] = await safeJson(vRes), [detD] = await safeJson(detRes); // fix multi-destructuring
            const vD = await safeJson(vRes);
            const dD = await safeJson(detRes);
            return {
              id,
              title: dD.title || "Sin título",
              visits_30d: vD.total_visits || 0,
              sold_quantity: dD.sold_quantity || 0,
              price: dD.price || 0,
              stock: dD.available_quantity || 0,
              status: dD.status || "active",
              category_id: dD.category_id
            };
          } catch(e) { return { id, title: "Error" }; }
        }));

        // 5. Radar de Competencia (Ayer Style)
        let competition = [];
        if (itemsMetrics.length > 0) {
            try {
                const topItem = itemsMetrics[0];
                const keyword = encodeURIComponent(topItem.title.split(' ').slice(0, 2).join(' '));
                const compRes = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${keyword}&category=${topItem.category_id}&limit=5`, { headers });
                const compData = await safeJson(compRes);
                if (compData.results) {
                    competition = compData.results
                        .filter(r => String(r.seller?.id) !== String(mlUserId))
                        .map(r => ({ title: r.title, price: r.price, sold_quantity: r.sold_quantity || 0 }));
                }
            } catch(e) {}
        }

        return res.status(200).json({
           reputation: userData.seller_reputation,
           unanswered_questions: questionsData.total || 0,
           items_count: searchData.paging?.total || 0,
           recent_orders: ordersData.results?.length || 0,
           orders_summary: ordersData.results?.slice(0, 10) || [],
           ads_summary: ads, // Estructura rica para Vanguard
           ads: ads, // Compatibilidad con prompts viejos
           finance_summary: fin,
           logistics_summary: log,
           top_items: itemsMetrics,
           competition: competition
        });
      }

      case 'get-goals': {
        const { data } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'vanguard_goals').maybeSingle();
        return res.status(200).json(data?.content || { text: "" });
      }
      
      case 'save-goals': {
        await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'vanguard_goals', content: { text: req.body.goals }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
        return res.status(200).json({ success: true });
      }

      default: return res.status(400).json({ error: 'Action?' });
    }
  } catch (err) {
    console.error("Global Error:", err);
    return res.status(200).json({ error: "Fallo global: " + err.message });
  }
}
