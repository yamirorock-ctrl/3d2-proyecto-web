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

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  
  const action = req.query.action || req.body?.action;
  const userId = req.query.userId || req.body?.userId;

  if (!action || !userId) return res.status(400).json({ error: 'Missing action/userId' });
  if (!supabase) return res.status(500).json({ error: 'Supabase Offline' });

  try {
    const needsToken = ['get-metrics', 'strategic-analysis', 'suggest-title', 'bulk-sync-stock', 'sync-product', 'get-promotions', 'auto-link', 'execute-hitl'].includes(action);
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
        const rData = await rResp.json();
        if (rResp.ok) {
          accessToken = rData.access_token;
          await supabase.from('ml_tokens').update({ access_token: rData.access_token, refresh_token: rData.refresh_token, expires_in: rData.expires_in, updated_at: new Date().toISOString() }).eq('user_id', dbToken.user_id);
        }
      }
    }

    switch (action) {
      case 'strategic-analysis': {
        const { metrics, goals, isChat, history, message } = req.body;
        if (!openai) return res.status(200).json({ reply: "Vanguard Offline" });

        // INFORMACIÓN COMPLETA Y DETALLADA (Sin reducciones para máxima precisión)
        const globalStats = {
            reputation: metrics?.reputation || 'N/A',
            general_stats: {
                total_active_items: metrics?.items_count || 0,
                orders_last_30_days: metrics?.recent_orders || 0,
                unanswered_questions: metrics?.unanswered_questions || 0
            },
            advertising_summary: metrics?.ads_summary || { message: "No hay datos de publicidad disponibles." },
            finance_summary: metrics?.finance_summary || { message: "No hay datos financieros disponibles." },
            logistics_summary: metrics?.logistics_summary || { message: "No hay datos logísticos disponibles." },
            catalog_detail: (metrics?.top_items || []).slice(0, 50).map(i => ({
                id: i.id,
                title: i.title,
                price: i.price,
                available_quantity: i.stock,
                visits_30d: i.visits_30d,
                status: i.status
            }))
        };

        if (isChat) {
          const h = (history || []).slice(-8);
          const r = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [
              { role: "system", content: "Eres VANGUARD 360°. El cerebro analítico de 3D2 Store. Tu misión es maximizar rentabilidad y reputación. Analiza Ventas, Ads, Finanzas y Logística con profundidad. Sé estratégico y directo." },
              ...h.map(m => ({ role: m.role === 'vanguard' ? 'assistant' : 'user', content: String(m.content) })),
              { role: "user", content: `CONSULTA: ${message}\nDATOS REALES DEL NEGOCIO: ${JSON.stringify(globalStats)}\nOBJETIVOS DEL DUEÑO: ${goals}` }
            ],
            max_completion_tokens: 1500 // Espacio para reportes detallados
          });
          const reply = r.choices[0].message.content;
          const newH = [...h, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
          await supabase.from('app_settings').upsert({ key: 'vanguard_history', value: newH });
          return res.status(200).json({ reply, history: newH });
        } else {
          const r = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [
              { role: "system", content: "Consultor Senior 360°. Genera un reporte estratégico profundo en formato JSON." },
              { role: "user", content: `Analiza integralmente y devuelve JSON { "summary": "...", "performance_score": 0-100, "strategic_plan": "...", "ads_analysis": "...", "financial_health": "...", "logistics_status": "..." }: ${JSON.stringify(globalStats)}` }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 2000
          });
          const obj = JSON.parse(r.choices[0].message.content);
          await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'latest_analysis', content: { analysis: obj, goals } }, { onConflict: 'user_id,event_type' });
          return res.status(200).json(obj);
        }
      }

      case 'get-metrics': {
        const mlUserId = dbToken.ml_user_id || dbToken.user_id;
        const headers = { Authorization: `Bearer ${accessToken}` };
        const dateFrom = new Date(); dateFrom.setDate(dateFrom.getDate() - 30);
        const dateStr = dateFrom.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];

        const [searchRes, ordersRes, userRes, questionsRes, mOrdersRes] = await Promise.all([
          fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dateFrom.toISOString()}&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/users/${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/questions/search?seller_id=${mlUserId}&status=unanswered`, { headers }),
          fetch(`https://api.mercadolibre.com/merchant_orders/search?seller_id=${mlUserId}&date_created.from=${dateFrom.toISOString()}`, { headers })
        ]);

        const [searchData, ordersData, userData, questionsData, mOrdersData] = await Promise.all([
          searchRes.json(), ordersRes.json(), userRes.json(), questionsRes.json(), mOrdersRes.json()
        ]);

        let ads_summary = null;
        try {
            const advRes = await fetch(`https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`, { headers: { ...headers, 'api-version': '1' } });
            const advData = await advRes.json();
            if (advRes.ok && advData.id) {
                const campaignsRes = await fetch(`https://api.mercadolibre.com/advertising/MLA/advertisers/${advData.id}/product_ads/campaigns/search?date_from=${dateStr}&date_to=${todayStr}`, { headers: { ...headers, 'api-version': '2' } });
                const campaignsData = await campaignsRes.json();
                if (campaignsRes.ok && campaignsData.results?.length > 0) {
                    const c = campaignsData.results.find(x => x.status === 'active') || campaignsData.results[0];
                    ads_summary = { impressions: c.metrics?.impressions || 0, clicks: c.metrics?.clicks || 0, cost: c.metrics?.cost || 0, advertising_revenue: c.metrics?.advertising_revenue || 0, acos: c.metrics?.acos || 0, roas: c.metrics?.roas || 0, ctr: c.metrics?.ctr || 0 };
                }
            }
        } catch (e) {}

        let finance_summary = { total_gross_amount: 0, accredited_amount: 0, pending_amount: 0 };
        let logistics_summary = { handling: 0, ready_to_ship: 0, shipped: 0, delivered: 0 };
        if (mOrdersData.results) {
            mOrdersData.results.forEach(order => {
                finance_summary.total_gross_amount += order.total_amount || 0;
                if (order.status === 'paid' || order.status === 'closed') finance_summary.accredited_amount += order.total_amount || 0;
                else finance_summary.pending_amount += order.total_amount || 0;
                const shipStatus = order.shipments?.[0]?.status;
                if (shipStatus && logistics_summary.hasOwnProperty(shipStatus)) logistics_summary[shipStatus]++;
            });
        }

        const ids = searchData.results || [];
        const itemsMetrics = await Promise.all(ids.map(async (id) => {
          const [vRes, detRes] = await Promise.all([fetch(`https://api.mercadolibre.com/items/${id}/visits/time_window?last=30&unit=day`, { headers }), fetch(`https://api.mercadolibre.com/items/${id}`, { headers })]);
          const [vData, detData] = await Promise.all([vRes.json(), detRes.json()]);
          return { id, title: detData.title, visits_30d: vData.total_visits || 0, price: detData.price, stock: detData.available_quantity, status: detData.status };
        }));

        return res.status(200).json({ reputation: userData.seller_reputation, unanswered_questions: questionsData.total || 0, items_count: searchData.paging?.total || 0, recent_orders: ordersData.results?.length || 0, top_items: itemsMetrics, ads_summary, finance_summary, logistics_summary });
      }

      case 'auto-link': {
          const r = await fetch(`https://api.mercadolibre.com/users/${dbToken.user_id}/items/search?status=active`, { headers });
          const d = await r.json();
          if (!d.results?.length) return res.status(200).json({ linked: 0 });
          const det = await fetch(`https://api.mercadolibre.com/items?ids=${d.results.join(',')}`, { headers });
          const items = (await det.json()).map(x => x.body).filter(Boolean);
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

      case 'get-goals': {
        const { data } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'vanguard_goals').maybeSingle();
        return res.status(200).json(data?.content || { text: "" });
      }

      case 'save-goals': {
        await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'vanguard_goals', content: { text: req.body.goals }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
        return res.status(200).json({ success: true });
      }

      case 'oauth': {
        const { code, userId: sId } = req.body;
        const r = await fetch('https://api.mercadolibre.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.VITE_ML_APP_ID || process.env.ML_APP_ID, client_secret: process.env.VITE_ML_APP_SECRET || process.env.VITE_ML_APP_SECRET, code, redirect_uri: process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI }) });
        const d = await r.json();
        if (!r.ok) return res.status(r.status).json(d);
        await supabase.from('ml_tokens').upsert({ user_id: sId || String(d.user_id), ml_user_id: String(d.user_id), access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        return res.status(200).json({ ok: true });
      }

      default: return res.status(400).json({ error: 'Action?' });
    }
  } catch (err) {
    console.error("Global Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
