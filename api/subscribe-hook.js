/* eslint-disable */
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const APP_ID = "5838942654994123"; // ID de tu App
  const WEBHOOK_URL = "https://www.creart3d2.com/api/ml-webhook";

  // Init Supabase
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res
      .status(500)
      .json({ error: "Faltan credenciales de Supabase en Vercel" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // 1. Get Access Token
    const { data: tokenData, error } = await supabase
      .from("ml_tokens")
      .select("access_token, user_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !tokenData) {
      return res
        .status(400)
        .json({ error: "No hay token de ML en base de datos" });
    }

    const { access_token, user_id } = tokenData;

    // 2. Subscribe to Questions
    // API: POST /applications/{app_id}/notifications
    const response = await fetch(
      `https://api.mercadolibre.com/applications/${APP_ID}/notifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          topic: "questions",
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      // Si falla, intentamos ver si ya existe o qué pasó
      // A veces se suscribe por usuario: /users/{id}/applications/{app_id}/notifications
      // Probamos el endpoint alternativo si falla el primero

      const response2 = await fetch(
        `https://api.mercadolibre.com/users/${user_id}/applications/${APP_ID}/notifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: WEBHOOK_URL,
            topic: "questions",
          }),
        },
      );

      const result2 = await response2.json();

      return res.status(200).json({
        method1_error: result,
        method2_result: result2,
        status: response2.ok
          ? "SUSCRIPCIÓN EXITOSA (Método Usuario)"
          : "FALLÓ TODO",
      });
    }

    return res.status(200).json({
      status: "SUSCRIPCIÓN EXITOSA (Método App)",
      details: result,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
