import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

let openai = null;
try {
  if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
} catch (e) {
  console.error("Error al inicializar OpenAI:", e);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  
  const action = req.query.action || req.body?.action;
  const userId = req.query.userId || req.body?.userId;

  if (!action || !userId) return res.status(400).json({ error: 'Missing action or userId' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const needsToken = ['get-metrics', 'strategic-analysis', 'suggest-title', 'bulk-sync-stock', 'sync-product', 'get-promotions', 'auto-link', 'execute-hitl'].includes(action);
    let accessToken = null;
    let dbToken = null;

    if (needsToken) {
      const { data, error: tokenError } = await supabase
        .from('ml_tokens')
        .select('*')
        .eq('user_id', String(userId))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenError || !data || !data.access_token) {
        const { data: globalData } = await supabase.from('ml_tokens').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (!globalData) return res.status(401).json({ error: 'No hay token de ML vinculado.' });
        dbToken = globalData;
      } else {
        dbToken = data;
      }
      accessToken = dbToken.access_token;

      const now = new Date();
      const updatedAt = new Date(dbToken.updated_at || 0);
      const expiresIn = dbToken.expires_in || 21600;
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
        if (!openai) return res.status(200).json({ reply: "⚠️ Vanguard en mantenimiento.", history: history || [] });

        const globalStats = {
            reputation: metrics?.reputation || 'N/A',
            stats: { active_items: metrics?.items_count || 0, orders_30d: metrics?.recent_orders || 0, pending_questions: metrics?.unanswered_questions || 0 },
            advertising: metrics?.ads_summary || { message: "Sin datos ads." },
            finance: metrics?.finance_summary || { message: "Sin datos financieros." },
            logistics: metrics?.logistics_summary || { message: "Sin datos logísticos." },
            catalog: (metrics?.top_items || []).map(i => ({ id: i.id, t: i.title, p: i.price, s: i.stock, v: i.visits_30d, st: i.status }))
        };

        if (isChat) {
          const activeHistory = (history || []).slice(-8);
          const response = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [
              { role: "system", content: "VANGUARD 360°. Analista Senior. Sé estratégico y directo. Max 150 palabras." },
              ...activeHistory.map(m => ({ role: m.role === 'vanguard' ? 'assistant' : 'user', content: String(m.content) })),
              { role: "user", content: `SOLICITUD: ${message}\nESTADO: ${JSON.stringify(globalStats)}\nOBJETIVOS: ${goals}` }
            ],
            max_completion_tokens: 350
          });
          const reply = response.choices[0].message.content;
          const newHistory = [...activeHistory, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
          await supabase.from('app_settings').upsert({ key: 'vanguard_history', value: newHistory });
          return res.status(200).json({ reply, history: newHistory });
        } else {
          const response = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [
              { role: "system", content: "Consultor 360°. Genera reporte táctico JSON." },
              { role: "user", content: `Analiza y devuelve JSON { "summary": "...", "performance_score": 0-100, "strategic_plan": "...", "ads_analysis": "...", "financial_health": "..." }: ${JSON.stringify(globalStats)}` }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 2000
          });
          const content = response.choices[0].message.content;
          const finalObj = JSON.parse(content);
          await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'latest_analysis', content: { analysis: finalObj, goals } }, { onConflict: 'user_id,event_type' });
          return res.status(200).json(finalObj);
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
          searchRes.json(), ordersData.json(), userRes.json(), questionsRes.json(), mOrdersData.json()
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
                    ads_summary = { impressions: c.metrics?.impressions || 0, clicks: c.metrics?.clicks || 0, cost: c.metrics?.cost || 0, sales: c.metrics?.sales_count || 0, revenue: c.metrics?.advertising_revenue || 0, acos: c.metrics?.acos ? (c.metrics.acos * 100).toFixed(2) + '%' : '0%', roas: c.metrics?.roas || 0 };
                }
            }
        } catch (e) {}

        let finance_summary = { total_gross: 0, accredited: 0, pending: 0 };
        let logistics_summary = { handling: 0, ready_to_ship: 0, shipped: 0, delivered: 0 };
        if (mOrdersData.results) {
            mOrdersData.results.forEach(order => {
                finance_summary.total_gross += order.total_amount || 0;
                if (order.status === 'paid' || order.status === 'closed') finance_summary.accredited += order.total_amount || 0;
                else finance_summary.pending += order.total_amount || 0;
                const shipStatus = order.shipments?.[0]?.status;
                if (shipStatus && logistics_summary.hasOwnProperty(shipStatus)) logistics_summary[shipStatus]++;
            });
        }

        const mlIds = searchData.results || [];
        const itemsMetrics = await Promise.all(mlIds.map(async (id) => {
          const [vRes, detRes] = await Promise.all([fetch(`https://api.mercadolibre.com/items/${id}/visits/time_window?last=30&unit=day`, { headers }), fetch(`https://api.mercadolibre.com/items/${id}`, { headers })]);
          const [vData, detData] = await Promise.all([vRes.json(), detRes.json()]);
          return { id, title: detData.title, visits_30d: vData.total_visits || 0, price: detData.price, stock: detData.available_quantity, status: detData.status };
        }));

        return res.status(200).json({ reputation: userData.seller_reputation, unanswered_questions: questionsData.total || 0, items_count: searchData.paging?.total || 0, recent_orders: ordersData.results?.length || 0, top_items: itemsMetrics, ads_summary, finance_summary, logistics_summary });
      }

      case 'auto-link': {
        const mlUserId = dbToken.user_id;
        const searchRes = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const searchData = await searchRes.json();
        const mlIds = searchData.results || [];
        if (mlIds.length === 0) return res.status(200).json({ message: 'No hay publicaciones activas', linked: 0 });
        const detailsRes = await fetch(`https://api.mercadolibre.com/items?ids=${mlIds.join(',')}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const detailsData = await detailsRes.json();
        const mlItems = detailsData.map(d => d.body).filter(Boolean);
        const { data: localProducts } = await supabase.from('products').select('id, name, ml_item_id');
        let linkedCount = 0;
        for (const item of mlItems) {
          const mlTitle = item.title.toLowerCase();
          const match = localProducts.find(p => {
            if (p.ml_item_id === item.id) return false;
            return mlTitle === p.name.toLowerCase() || mlTitle.includes(p.name.toLowerCase());
          });
          if (match) {
            await supabase.from('products').update({ ml_item_id: item.id, ml_permalink: item.permalink, ml_status: item.status }).eq('id', match.id);
            linkedCount++;
          }
        }
        return res.status(200).json({ message: 'Búsqueda completada', linked: linkedCount });
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
            const mlResp = await fetch(`https://api.mercadolibre.com/items/${prod.ml_item_id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ available_quantity: Math.max(0, prod.stock || 0) }) });
            results.push({ id: prod.id, status: mlResp.ok ? 'success' : 'error' });
          } catch (err) { results.push({ id: prod.id, status: 'error' }); }
        }
        return res.status(200).json({ results });
      }

      case 'sync-product': {
        const { productId, productData, markupPercentage } = req.body;
        const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
        const price = Math.floor(Number(productData?.price || product.price) * (1 + (markupPercentage || 25) / 100));
        const itemBody = { title: (product.ml_title || product.name).slice(0, 60), category_id: product.ml_category_id || "MLA3530", price, currency_id: "ARS", available_quantity: product.stock || 0, buying_mode: "buy_it_now", condition: "new", listing_type_id: "gold_special", pictures: (product.images || []).map(img => ({ source: typeof img === 'string' ? img : img.url })), attributes: [{ id: "BRAND", value_name: "3D2Store" }, { id: "MODEL", value_name: "Personalizado" }] };
        if (product.ml_item_id) {
          await fetch(`https://api.mercadolibre.com/items/${product.ml_item_id}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ price, available_quantity: product.stock }) });
          return res.status(200).json({ success: true, ml_id: product.ml_item_id });
        } else {
          const createResp = await fetch(`https://api.mercadolibre.com/items`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(itemBody) });
          const createData = await createResp.json();
          if (createResp.ok) {
            await supabase.from('products').update({ ml_item_id: createData.id, ml_status: createData.status }).eq('id', productId);
            return res.status(200).json({ success: true, ml_id: createData.id });
          }
          return res.status(400).json({ error: createData.message });
        }
      }

      case 'get-goals': {
        const { data } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'vanguard_goals').maybeSingle();
        return res.status(200).json(data?.content || { text: "" });
      }

      case 'save-goals': {
        await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'vanguard_goals', content: { text: req.body.goals }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
        return res.status(200).json({ success: true });
      }

      case 'execute-hitl': {
        const { intent, item_id, value } = req.body;
        const body = intent === 'update_price' ? { price: Number(value) } : { status: intent === 'paused' ? 'paused' : 'active' };
        const mlResponse = await fetch(`https://api.mercadolibre.com/items/${item_id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return res.status(200).json({ success: mlResponse.ok });
      }

      case 'oauth': {
        const { code, userId: supabaseUserId } = req.body;
        const r = await fetch('https://api.mercadolibre.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.VITE_ML_APP_ID || process.env.ML_APP_ID, client_secret: process.env.VITE_ML_APP_SECRET || process.env.VITE_ML_APP_SECRET, code, redirect_uri: process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI }) });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json(data);
        await supabase.from('ml_tokens').upsert({ user_id: supabaseUserId || String(data.user_id), ml_user_id: String(data.user_id), access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        return res.status(200).json({ ok: true });
      }

      default: return res.status(400).json({ error: 'Unsupported action' });
    }
  } catch (error) {
    console.error(`[ML Manager] GLOBAL ERROR:`, error);
    return res.status(500).json({ error: "Error crítico: " + error.message });
  }
}
