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

      case 'get-metrics': {
        const mlUserId = dbToken.user_id;
        const searchRes = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const searchData = await searchRes.json();
        const mlIds = (searchData.results || []).slice(0, 20);

        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);
        const ordersRes = await fetch(`https://api.mercadolibre.com/orders/search?seller=${mlUserId}&order.date_created.from=${dateFrom.toISOString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const ordersData = await ordersRes.json();

        const adsRes = await fetch(`https://api.mercadolibre.com/advertising/advertising_campaigns/search?seller_id=${mlUserId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const adsData = await adsRes.json();

        return res.status(200).json({
           account_id: mlUserId,
           items_count: searchData.paging?.total || 0,
           recent_orders: ordersData.results?.length || 0,
           orders_summary: ordersData.results?.slice(0, 10) || [],
           ads: adsData.results || [],
           top_items: mlIds,
           sales: ordersData // Para compatibilidad con el front que lo usa para el gráfico
        });
      }

      case 'strategic-analysis': {
        const { metrics, goals, current_inventory, isChat, history, message, attachment } = req.body;
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-pro-latest", // Usamos 1.5 Pro o Flash para full soporte multimodal 
          systemInstruction: `
            Eres VANGUARD, el Socio Estratégico Senior de 3D2 Store. 
            Misión: Reputación, Ventas y Posicionamiento en ML Argentina.
            Estilo: Mentor paciente y pedagogo, experto en métricas.
          `
        });

        if (isChat) {
          const chat = model.startChat({
            history: (history || []).map(m => ({
                role: m.role === 'vanguard' ? 'model' : 'user',
                // Evitamos pasar las fotos dentro del historial viejo a la IA para no quemar tokens inútilmente.
                parts: [{ text: String(m.content) }]
            }))
          });
          
          let chatParts = [];
          chatParts.push({ text: `MENSAJE USUARIO: ${message || 'Revisa esta imagen adjunta'} | MÉTRICAS: ${JSON.stringify(metrics || {})} | STOCK: ${JSON.stringify(current_inventory || [])}` });
          
          if (attachment) {
            try {
              const base64Data = attachment.split(',')[1];
              const mimeType = attachment.split(';')[0].split(':')[1];
              chatParts.push({
                 inlineData: { data: base64Data, mimeType }
              });
            } catch (err) {
              console.error("Error parseando el attachment base64", err);
            }
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
        const responseText = result.response.text();
        
        // Extracción robusta de JSON (busca el primer { y el último })
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("La IA no devolvió un formato de datos válido.");
        }
        const finalObj = JSON.parse(jsonMatch[0]);

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
      action: action
    });
  }
}
