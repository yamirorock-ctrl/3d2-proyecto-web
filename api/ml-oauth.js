// Vercel serverless function: Exchange MercadoLibre OAuth code for tokens
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    // Preflight response
    return res.status(200).end();
  }
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'ml-oauth endpoint alive' });
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { code } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!code) {
      res.status(400).json({ error: 'Missing code' });
      return;
    }
    const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
    const client_secret = process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET;
    const redirect_uri = process.env.VITE_ML_REDIRECT_URI || process.env.ML_REDIRECT_URI;
    if (!client_id || !client_secret || !redirect_uri) {
      res.status(500).json({ error: 'Missing ML credentials env vars' });
      return;
    }
    const tokenUrl = 'https://api.mercadolibre.com/oauth/token';
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('client_id', String(client_id));
    params.set('client_secret', String(client_secret));
    params.set('code', String(code));
    params.set('redirect_uri', String(redirect_uri));

    const r = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    const data = await r.json();
    console.log('[ml-oauth] Respuesta completa de MercadoLibre:', data);
    if (!r.ok) {
      res.status(r.status).json({ error: 'Token exchange failed', details: data });
      return;
    }
    // Validar datos críticos
    if (!data.user_id || !data.access_token) {
      console.error('[ml-oauth] Faltan datos críticos en la respuesta de ML:', data);
      res.status(500).json({ error: 'Faltan datos críticos de MercadoLibre', details: data });
      return;
    }
    // Persist tokens y devolver depuración (commit for redeploy)
    let debug = {};
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseAnon = process.env.VITE_SUPABASE_ANON || process.env.SUPABASE_ANON_KEY;
      debug.supabaseEnv = { supabaseUrl, supabaseAnon };
      if (supabaseUrl && supabaseAnon) {
        const supabase = createClient(supabaseUrl, supabaseAnon);
        const payload = {
          user_id: String(data.user_id),
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          scope: data.scope,
          token_type: data.token_type,
          updated_at: new Date().toISOString()
        };
        debug.payload = payload;
        const { data: upserted, error: upsertError } = await supabase.from('ml_tokens').upsert(payload, { onConflict: 'user_id' }).select('user_id, updated_at').single();
        debug.upsertResult = { upserted, upsertError };
      }
    } catch (e) {
      debug.persistenceError = e.message;
    }
    res.status(200).json({ ok: true, user_id: data.user_id, saved: true, debug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
