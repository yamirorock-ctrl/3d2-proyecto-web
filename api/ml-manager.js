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
  
  // Búsqueda flexible de parámetros para evitar errores 400
  const action = req.query.action || req.body?.action;
  const userId = req.query.userId || req.body?.userId;

  if (!action || !userId) {
    console.error("[ML Manager] Missing params:", { action, userId, method: req.method });
    return res.status(400).json({ error: 'Missing action or userId' });
  }
  
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
        
        if (!openai) {
            return res.status(200).json({ reply: "⚠️ Vanguard está en mantenimiento.", history: history || [] });
        }

        const fullCompactCatalog = (metrics?.top_items || []).map(i => ({
            id: i.id, t: i.title, p: i.price, s: i.stock, v: i.visits_30d, st: i.status
        }));

        const globalStats = {
            reputation: metrics?.reputation || 'N/A',
            stats: {
                active_items: metrics?.items_count || 0,
                orders_30d: metrics?.recent_orders || 0,
                pending_questions: metrics?.unanswered_questions || 0
            },
            advertising: metrics?.ads_summary || { message: "Sin datos de ads." },
            finance: metrics?.finance_summary || { message: "Sin datos financieros." },
            logistics: metrics?.logistics_summary || { message: "Sin datos logísticos." },
            catalog: fullCompactCatalog 
        };

        if (isChat) {
          try {
            const activeHistory = (history || []).slice(-8);
            const response = await openai.chat.completions.create({
              model: "gpt-5.4-mini",
              messages: [
                { role: "system", content: "Eres VANGUARD. Analista Senior 360°. Tienes datos de VENTAS, ADS, FINANZAS y LOGÍSTICA. Sé estratégico y directo. Max 150 palabras." },
                ...activeHistory.map(m => ({ 
                  role: m.role === 'vanguard' ? 'assistant' : 'user', 
                  content: String(m.content) 
                })),
                { role: "user", content: `SOLICITUD: ${message}\nESTADO 360: ${JSON.stringify(globalStats)}\nOBJETIVOS: ${goals}` }
              ],
              max_completion_tokens: 350, 
              temperature: 0.7
            });
            const reply = response.choices[0].message.content;
            const newHistory = [...activeHistory, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
            await supabase.from('app_settings').upsert({ key: 'vanguard_history', value: newHistory });
            return res.status(200).json({ reply, history: newHistory });
          } catch (err) {
            return res.status(500).json({ error: "Error chat: " + err.message });
          }
        } else {
          try {
            const response = await openai.chat.completions.create({
              model: "gpt-5.4-mini",
              messages: [
                { role: "system", content: "Consultor 360°. Genera reporte táctico JSON analizando ventas, publicidad, finanzas y logística." },
                { role: "user", content: `Analiza y devuelve JSON { "summary": "...", "performance_score": 0-100, "strategic_plan": "...", "ads_analysis": "...", "financial_health": "..." }: ${JSON.stringify(globalStats)}` }
              ],
              response_format: { type: "json_object" },
              max_completion_tokens: 2000
            });
            const content = response.choices[0].message.content;
            try {
              const finalObj = JSON.parse(content);
              await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'latest_analysis', content: { analysis: finalObj, goals } }, { onConflict: 'user_id,event_type' });
              return res.status(200).json(finalObj);
            } catch (pErr) {
              return res.status(200).json({ summary: "Reporte 360 (Manual)", performance_score: 80, strategic_plan: content.substring(0, 1000) });
            }
          } catch (err) {
            return res.status(500).json({ error: "Error estático: " + err.message });
          }
        }
      }

      case 'get-metrics': {
        const mlUserId = dbToken.ml_user_id || dbToken.user_id;
        const headers = { Authorization: `Bearer ${accessToken}` };
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);
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

        return res.status(200).json({
          reputation: userData.seller_reputation,
          unanswered_questions: questionsData.total || 0,
          items_count: searchData.paging?.total || 0,
          recent_orders: ordersData.results?.length || 0,
          top_items: itemsMetrics,
          ads_summary, finance_summary, logistics_summary
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

      default: return res.status(400).json({ error: 'Unsupported action' });
    }
  } catch (error) {
    console.error(`[ML Manager] GLOBAL ERROR:`, error);
    return res.status(500).json({ error: "Error crítico: " + error.message });
  }
}
