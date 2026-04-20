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
  
  // Limpieza agresiva de parámetros
  const actionRaw = req.query.action || req.body?.action;
  const action = actionRaw ? String(actionRaw).trim() : null;
  const userId = req.query.userId || req.body?.userId;

  if (!action || !userId) {
    return res.status(400).json({ error: 'Missing action/userId', received: { action, userId } });
  }

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
      case 'get-vanguard-state': {
        const { data } = await supabase.from('vanguard_memory').select('*').eq('user_id', String(userId));
        const history = data?.find(d => d.event_type === 'chat_history')?.content || [];
        const rollingLimit = new Date();
        rollingLimit.setHours(rollingLimit.getHours() - 24);
        const activeChat = history.filter(h => !h.timestamp || new Date(h.timestamp) > rollingLimit);
        return res.status(200).json({
          analysis: data?.find(d => d.event_type === 'latest_analysis')?.content?.analysis || null,
          goals: data?.find(d => d.event_type === 'latest_analysis')?.content?.goals || null,
          chat_history: activeChat
        });
      }

      case 'strategic-analysis': {
        const { metrics, goals, isChat, history, message } = req.body;
        if (!openai) return res.status(200).json({ reply: "Vanguard Offline" });
        const globalStats = {
            reputation: metrics?.reputation || 'N/A',
            general_stats: { total_active_items: metrics?.items_count || 0, orders_last_30_days: metrics?.recent_orders || 0, unanswered_questions: metrics?.unanswered_questions || 0 },
            advertising_summary: metrics?.ads_summary || { message: "Sin datos ads." },
            finance_summary: metrics?.finance_summary || { message: "Sin datos financieros." },
            logistics_summary: metrics?.logistics_summary || { message: "Sin datos logísticos." },
            catalog_detail: (metrics?.top_items || []).slice(0, 50).map(i => ({ id: i.id, title: i.title, price: i.price, available_quantity: i.stock, visits_30d: i.visits_30d, status: i.status }))
        };

        if (isChat) {
          const h = (history || []).slice(-8);
          const r = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [
              { role: "system", content: "VANGUARD 360°. Analista Senior 3D2. Sé estratégico y directo." },
              ...h.map(m => ({ role: m.role === 'vanguard' ? 'assistant' : 'user', content: String(m.content) })),
              { role: "user", content: `SOLICITUD: ${message}\nDATOS: ${JSON.stringify(globalStats)}\nOBJETIVOS: ${goals}` }
            ],
            max_completion_tokens: 1500
          });
          const reply = r.choices[0].message.content;
          const newH = [...h, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
          await supabase.from('app_settings').upsert({ key: 'vanguard_history', value: newH });
          return res.status(200).json({ reply, history: newH });
        } else {
          const r = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [
              { role: "system", content: "Consultor Senior 360°. JSON profundo." },
              { role: "user", content: `Analiza y devuelve JSON: ${JSON.stringify(globalStats)}` }
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
        const dF = new Date(); dF.setDate(dF.getDate() - 30);
        const dS = dF.toISOString().split('T')[0];
        const tS = new Date().toISOString().split('T')[0];

        const [sRes, oRes, uRes, qRes, mRes] = await Promise.all([
          fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dF.toISOString()}&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/users/${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/questions/search?seller_id=${mlUserId}&status=unanswered`, { headers }),
          fetch(`https://api.mercadolibre.com/merchant_orders/search?seller_id=${mlUserId}&date_created.from=${dF.toISOString()}`, { headers })
        ]);

        const [sD, oD, uD, qD, mD] = await Promise.all([sRes.json(), oRes.json(), uRes.json(), qRes.json(), mRes.json()]);

        let ads = null;
        try {
            const aR = await fetch(`https://api.mercadolibre.com/advertising/advertisers?product_id=PADS`, { headers: { ...headers, 'api-version': '1' } });
            const aD = await aR.json();
            if (aR.ok && aD.id) {
                const cR = await fetch(`https://api.mercadolibre.com/advertising/MLA/advertisers/${aD.id}/product_ads/campaigns/search?date_from=${dS}&date_to=${tS}`, { headers: { ...headers, 'api-version': '2' } });
                const cD = await cR.json();
                if (cR.ok && cD.results?.length > 0) {
                    const c = cD.results.find(x => x.status === 'active') || cD.results[0];
                    ads = { impressions: c.metrics?.impressions || 0, clicks: c.metrics?.clicks || 0, cost: c.metrics?.cost || 0, advertising_revenue: c.metrics?.advertising_revenue || 0, acos: c.metrics?.acos || 0, roas: c.metrics?.roas || 0, ctr: c.metrics?.ctr || 0 };
                }
            }
        } catch (e) {}

        let fin = { total_gross_amount: 0, accredited_amount: 0, pending_amount: 0 };
        let log = { handling: 0, ready_to_ship: 0, shipped: 0, delivered: 0 };
        if (mD.results) {
            mD.results.forEach(order => {
                fin.total_gross_amount += order.total_amount || 0;
                if (order.status === 'paid' || order.status === 'closed') fin.accredited_amount += order.total_amount || 0;
                else fin.pending_amount += order.total_amount || 0;
                const shipStatus = order.shipments?.[0]?.status;
                if (shipStatus && log.hasOwnProperty(shipStatus)) log[shipStatus]++;
            });
        }

        const ids = sD.results || [];
        const itemsM = await Promise.all(ids.map(async (id) => {
          const [vR, dR] = await Promise.all([fetch(`https://api.mercadolibre.com/items/${id}/visits/time_window?last=30&unit=day`, { headers }), fetch(`https://api.mercadolibre.com/items/${id}`, { headers })]);
          const [vD, dD] = await Promise.all([vR.json(), dR.json()]);
          return { id, title: dD.title, visits_30d: vD.total_visits || 0, price: dD.price, stock: dD.available_quantity, status: dD.status };
        }));

        return res.status(200).json({ reputation: uD.seller_reputation, unanswered_questions: qD.total || 0, items_count: sD.paging?.total || 0, recent_orders: oD.results?.length || 0, top_items: itemsM, ads_summary: ads, finance_summary: fin, logistics_summary: log });
      }

      case 'get-goals': {
        const { data } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'vanguard_goals').maybeSingle();
        return res.status(200).json(data?.content || { text: "" });
      }
      
      case 'save-goals': {
        await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'vanguard_goals', content: { text: req.body.goals }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
        return res.status(200).json({ success: true });
      }

      case 'auto-link': {
          const rRes = await fetch(`https://api.mercadolibre.com/users/${dbToken.user_id}/items/search?status=active`, { headers });
          const rD = await rRes.json();
          if (!rD.results?.length) return res.status(200).json({ linked: 0 });
          const detRes = await fetch(`https://api.mercadolibre.com/items?ids=${rD.results.join(',')}`, { headers });
          const items = (await detRes.json()).map(x => x.body).filter(Boolean);
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
        const d = await r.json();
        if (!r.ok) return res.status(r.status).json(d);
        await supabase.from('ml_tokens').upsert({ user_id: sId || String(d.user_id), ml_user_id: String(d.user_id), access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        return res.status(200).json({ ok: true });
      }

      default: return res.status(400).json({ error: 'Action?', received: action });
    }
  } catch (err) {
    console.error("Global Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
