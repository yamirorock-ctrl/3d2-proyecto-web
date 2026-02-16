import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Cargar .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    if (!process.env[k]) {
      process.env[k] = envConfig[k];
    }
  }
}

// Config Supabase
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://lnjbcbdkegaftfkibzxg.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_TOKEN || process.env.SUPABASE_ANON_KEY; // Usar key del .env.local si existe

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Faltan credenciales de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLastQuestions() {
  console.log("🕵️‍♂️ Buscando al pirata IA (usando Token de DB)...");

  // 1. Obtener Token Fresco de Supabase
  const { data: tokenData, error: tokenError } = await supabase
    .from("ml_tokens")
    .select("access_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !tokenData) {
    console.error("❌ Error obteniendo token de BD:", tokenError);
    return;
  }

  const ACCESS_TOKEN = tokenData.access_token;
  const QUESTION_ID = "13526055734"; // ID del error en el monitor

  try {
    console.log(`🔎 Analizando Pregunta Específica: ${QUESTION_ID}...`);

    // Consultar detalle de la pregunta
    const res = await fetch(
      `https://api.mercadolibre.com/questions/${QUESTION_ID}?api_version=4`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error("❌ Error ML API:", res.status, txt);
      return;
    }

    const q = await res.json();
    console.log(`--------------------------------------------------`);
    console.log(`🗣️ Texto Pregunta: "${q.text}"`);
    console.log(`📅 Fecha: ${q.date_created}`);
    console.log(`📍 Estado: ${q.status}`);

    if (q.answer) {
      console.log(`💬 RESPUESTA ENCONTRADA: "${q.answer.text}"`);
      console.log(`🤖 Fecha Respuesta: ${q.answer.date_created}`);

      // Diferencia de tiempo
      const t1 = new Date(q.date_created).getTime();
      const t2 = new Date(q.answer.date_created).getTime();
      const diff = t2 - t1;

      console.log(
        `⏱️ Tiempo de Reacción: ${diff}ms (${(diff / 1000).toFixed(2)} segundos)`,
      );

      if (diff < 2000) {
        console.log(`🚨 VELOCIDAD INHUMANA (<2s). ES UN BOT.`);
      } else {
        console.log(`ℹ️ Velocidad humana (>2s).`);
      }
    } else {
      console.log(
        `🤔 Mmm... figura como respondida pero no veo el objeto 'answer'. Raro.`,
      );
    }
  } catch (error) {
    console.error("❌ Error fatal:", error);
  }
}

checkLastQuestions();
