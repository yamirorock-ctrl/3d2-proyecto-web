import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Configuro cabeceras para que sea un Cron de Vercel (o llamada manual)
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[CRON] Fallo: Sin credenciales Supabase");
    return res.status(500).json({ error: "Missing Supabase Credentials" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const APP_ID = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
  const SECRET = process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET;

  if (!APP_ID || !SECRET) {
    console.error("[CRON] Fallo: Sin credenciales ML");
    return res.status(500).json({ error: "Missing ML Credentials" });
  }

  try {
    // 1. Obtener el token actual (para sacar el refresh_token)
    // Buscamos el token más reciente de cualquier usuario (asumiendo single-tenant por ahora)
    const { data: tokenData, error: dbError } = await supabase
      .from("ml_tokens")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (dbError || !tokenData) {
      console.log("[CRON] No hay tokens para refrescar.");
      return res.status(200).json({ status: "No tokens found" });
    }

    const refreshToken = tokenData.refresh_token;

    // 2. Pedir nuevo token a ML
    const tokenUrl = "https://api.mercadolibre.com/oauth/token";
    const bodyParams = new URLSearchParams();
    bodyParams.append("grant_type", "refresh_token");
    bodyParams.append("client_id", APP_ID);
    bodyParams.append("client_secret", SECRET);
    bodyParams.append("refresh_token", refreshToken);

    const mlResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams,
    });

    const newData = await mlResponse.json();

    if (!mlResponse.ok) {
      console.error("[CRON] Error refrescando token:", newData);
      return res.status(500).json({ error: "ML API Error", details: newData });
    }

    // 3. Guardar el nuevo token en Supabase
    const payload = {
      user_id: String(newData.user_id),
      access_token: newData.access_token,
      refresh_token: newData.refresh_token, // Importante: ML rota el refresh token también
      expires_in: newData.expires_in,
      scope: newData.scope,
      token_type: newData.token_type,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("ml_tokens")
      .upsert(payload, { onConflict: "user_id" });

    if (updateError) {
      throw new Error("Failed to save new token to DB: " + updateError.message);
    }

    console.log(
      `[CRON] Token renovado para usuario ${newData.user_id}. Expira en ${newData.expires_in}s.`,
    );
    return res
      .status(200)
      .json({
        success: true,
        user_id: newData.user_id,
        refreshed_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error("[CRON] Excepción fatal:", error);
    return res.status(500).json({ error: error.message });
  }
}
