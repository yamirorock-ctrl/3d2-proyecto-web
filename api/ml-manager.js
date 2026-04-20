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

      case 'strategic-analysis': {
        const { metrics, goals, isChat, history, message, attachments } = req.body;
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelsToTry = ["gemini-3.1", "gemini-2.5-flash"];
        
        if (isChat) {
          for (const modelName of modelsToTry) {
            try {
              const chatModel = genAI.getGenerativeModel({ 
                model: modelName, 
                systemInstruction: "Eres VANGUARD. Sé EXTREMADAMENTE CONCISO y DIRECTO (max 2-3 oraciones). Solo explayate si se te pide. Prioriza tokens." 
              });
              const activeHistory = (history || []).slice(-10); // Solo últimos 10 para ahorrar
              const chat = chatModel.startChat({ history: activeHistory.map(m => ({ role: m.role === 'vanguard' ? 'model' : 'user', parts: [{ text: String(m.content) }] })) });
              
              const chatParts = [{ text: `SOLICITUD: ${message}\nMETRICAS: ${JSON.stringify(metrics).substring(0, 5000)}` }];
              if (attachments) attachments.forEach(att => chatParts.push({ inlineData: { data: att.split(',')[1], mimeType: att.split(';')[0].split(':')[1] } }));

              const result = await chat.sendMessage(chatParts);
              const reply = result.response.text();
              const newHistory = [...activeHistory, { role: 'user', content: message, timestamp: new Date().toISOString() }, { role: 'vanguard', content: reply, timestamp: new Date().toISOString() }];
              await supabase.from('app_settings').upsert({ key: 'vanguard_history', value: newHistory });
              return res.status(200).json({ reply, history: newHistory });
            } catch (err) {
              if ((err.status === 429 || err.message?.includes('429')) && modelName !== modelsToTry[1]) continue;
              throw err;
            }
          }
        } else {
          let finalObj = null;
          for (const modelName of modelsToTry) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName });
              const result = await model.generateContent(`Analiza y devuelve JSON: ${JSON.stringify(metrics).substring(0, 10000)}`);
              const responseText = result.response.text();
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) finalObj = JSON.parse(jsonMatch[0].trim());
              if (finalObj) break;
            } catch (err) {
              if ((err.status === 429 || err.message?.includes('429')) && modelName !== modelsToTry[1]) continue;
            }
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

      case 'oauth': {
        const { code, userId: supabaseUserId } = req.body;
        const r = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.VITE_ML_APP_ID || process.env.ML_APP_ID,
            client_secret: process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET,
            code,
            redirect_uri: process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI
          })
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json(data);
        await supabase.from('ml_tokens').upsert({ user_id: supabaseUserId || String(data.user_id), ml_user_id: String(data.user_id), access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Unsupported action' });
    }
  } catch (error) {
    console.error(`[ML Manager] Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
