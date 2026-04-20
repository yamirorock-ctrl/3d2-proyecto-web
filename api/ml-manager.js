import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
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

      case 'get-promotions': {
        const promosRes = await fetch(`https://api.mercadolibre.com/seller-promotions/principals?seller_id=${dbToken.user_id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        return res.status(200).json(await promosRes.json());
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
            results.push({ id: prod.id, status: mlResp.ok ? 'success' : 'error' });
          } catch (err) { results.push({ id: prod.id, status: 'error' }); }
        }
        return res.status(200).json({ results });
      }

      case 'sync-product': {
        const { productId, productData, markupPercentage } = req.body;
        const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
        const price = Math.floor(Number(productData?.price || product.price) * (1 + (markupPercentage || 25) / 100));
        const itemBody = {
          title: (product.ml_title || product.name).slice(0, 60),
          category_id: product.ml_category_id || "MLA3530",
          price,
          currency_id: "ARS",
          available_quantity: product.stock || 0,
          buying_mode: "buy_it_now",
          condition: "new",
          listing_type_id: "gold_special",
          pictures: (product.images || []).map(img => ({ source: typeof img === 'string' ? img : img.url })),
          attributes: [{ id: "BRAND", value_name: "3D2Store" }, { id: "MODEL", value_name: "Personalizado" }]
        };
        if (product.ml_item_id) {
          await fetch(`https://api.mercadolibre.com/items/${product.ml_item_id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ price, available_quantity: product.stock })
          });
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

      case 'get-metrics': {
        const mlUserId = dbToken.ml_user_id || dbToken.user_id;
        const headers = { Authorization: `Bearer ${accessToken}` };
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);
        const [searchRes, ordersRes, userRes, questionsRes] = await Promise.all([
          fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active&limit=25`, { headers }),
          fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dateFrom.toISOString()}&limit=50`, { headers }),
          fetch(`https://api.mercadolibre.com/users/${mlUserId}`, { headers }),
          fetch(`https://api.mercadolibre.com/questions/search?seller_id=${mlUserId}&status=unanswered`, { headers })
        ]);
        const [searchData, ordersData, userData, questionsData] = await Promise.all([searchRes.json(), ordersRes.json(), userRes.json(), questionsRes.json()]);
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
          top_items: itemsMetrics
        });
      }

      case 'strategic-analysis': {
        const { metrics, goals, isChat, history, message, attachments } = req.body;
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelsToTry = ["gemini-3.1-pro-preview", "gemini-2.5-flash"];
        if (isChat) {
          for (const modelName of modelsToTry) {
            try {
              const chatModel = genAI.getGenerativeModel({ model: modelName, systemInstruction: "Eres VANGUARD. Sé EXTREMADAMENTE CONCISO y DIRECTO. Responde al punto (max 3 oraciones). Solo explayate si se pide. Prioriza tokens." });
              let activeHistory = (history || []).slice(-10);
              // ELIMINAR MENSAJES INICIALES DE VANGUARD (Debe empezar con User)
              while (activeHistory.length > 0 && activeHistory[0].role === 'vanguard') {
                activeHistory.shift();
              }
              const chat = chatModel.startChat({ 
                history: activeHistory.map(m => ({ 
                  role: m.role === 'vanguard' ? 'model' : 'user', 
                  parts: [{ text: String(m.content) }] 
                })) 
              });
              const result = await chat.sendMessage([{ text: `SOLICITUD: ${message}\nDATOS: ${JSON.stringify(metrics).substring(0, 5000)}` }]);
              const reply = result.response.text();
              const newHistory = [...activeHistory, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
              await supabase.from('app_settings').upsert({ key: 'vanguard_history', value: newHistory });
              return res.status(200).json({ reply, history: newHistory });
            } catch (err) {
              const isRetryable = err.status === 429 || err.status === 503 || err.status === 500 || err.message?.includes('429') || err.message?.includes('503') || err.message?.includes('quota') || err.message?.includes('high demand');
              if (isRetryable && modelName !== modelsToTry[1]) {
                console.warn(`[Vanguard Fallback] Error en ${modelName}, saltando...`);
                continue;
              }
              throw err;
            }
          }
        } else {
          let finalObj = null;
          for (const modelName of modelsToTry) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName });
              const result = await model.generateContent(`Analiza JSON y devuelve esquema { summary, performance_score }: ${JSON.stringify(metrics).substring(0, 8000)}`);
              const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
              if (jsonMatch) finalObj = JSON.parse(jsonMatch[0].trim());
              if (finalObj) break;
            } catch (err) { if ((err.status === 429 || err.message?.includes('429')) && modelName !== modelsToTry[1]) continue; }
          }
          finalObj = finalObj || { summary: "IA Ocupada", performance_score: 50 };
          await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'latest_analysis', content: { analysis: finalObj, goals } }, { onConflict: 'user_id,event_type' });
          return res.status(200).json(finalObj);
        }
        break;
      }

      case 'save-goals': {
        await supabase.from('vanguard_memory').upsert({ user_id: String(userId), event_type: 'vanguard_goals', content: { text: req.body.goals }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,event_type' });
        return res.status(200).json({ success: true });
      }

      case 'get-goals': {
        const { data } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'vanguard_goals').maybeSingle();
        return res.status(200).json(data?.content || { text: "" });
      }

      case 'execute-hitl': {
        const { intent, item_id, value } = req.body;
        const body = intent === 'update_price' ? { price: Number(value) } : { status: intent === 'pause_item' ? 'paused' : 'active' };
        const mlResponse = await fetch(`https://api.mercadolibre.com/items/${item_id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return res.status(200).json({ success: mlResponse.ok });
      }

      case 'oauth': {
        const { code, userId: supabaseUserId } = req.body;
        const r = await fetch('https://api.mercadolibre.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.VITE_ML_APP_ID || process.env.ML_APP_ID, client_secret: process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET, code, redirect_uri: process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI }) });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json(data);
        await supabase.from('ml_tokens').upsert({ user_id: supabaseUserId || String(data.user_id), ml_user_id: String(data.user_id), access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        return res.status(200).json({ ok: true });
      }

      default: return res.status(400).json({ error: 'Unsupported action' });
    }
  } catch (error) {
    console.error(`[ML Manager] Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
