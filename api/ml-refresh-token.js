import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST");

  try {
    // 1. Configuración y Credenciales
    const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
    const client_secret =
      process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET;
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY =
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;

    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !supabaseKey) {
      return res.status(500).json({ error: "Missing Supabase Credentials" });
    }

    const supabase = createClient(SUPABASE_URL, supabaseKey);

    // 2. Obtener el último Refresh Token de la base de datos
    const { data: lastToken, error: fetchError } = await supabase
      .from("ml_tokens")
      .select("refresh_token, user_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !lastToken) {
      console.error("No refresh token found in database.");
      return res.status(404).json({ error: "No refresh token available." });
    }

    const refreshToken = lastToken.refresh_token;

    // 3. Solicitar Renovación a MercadoLibre
    const tokenUrl = "https://api.mercadolibre.com/oauth/token";
    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("client_id", String(client_id));
    params.set("client_secret", String(client_secret));
    params.set("refresh_token", String(refreshToken));

    console.log("[ML Refresh] Renewing token...");
    const r = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("[ML Refresh] Failed:", data);
      return res.status(r.status).json({
        error: "Failed to refresh token",
        details: data,
      });
    }

    // 4. Guardar Nuevo Token en Base de Datos
    const payload = {
      user_id: String(data.user_id),
      access_token: data.access_token,
      refresh_token: data.refresh_token, // ¡Nuevo refresh token! (rota)
      expires_in: data.expires_in,
      scope: data.scope,
      token_type: data.token_type,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("ml_tokens")
      .upsert(payload, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[ML Refresh] Failed to save to DB:", upsertError);
      return res
        .status(500)
        .json({ error: "DB Save Error", details: upsertError });
    }

    console.log("[ML Refresh] Success! New token saved.");
    return res.status(200).json({
      success: true,
      message: "Token refreshed and saved successfully.",
      user_id: data.user_id,
      expires_in: data.expires_in,
      updated_at: payload.updated_at,
    });
  } catch (error) {
    console.error("[ML Refresh] Critical Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
