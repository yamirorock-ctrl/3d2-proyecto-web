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
  const ITEM_ID = "MLA1669628001"; // ID visible en una captura anterior (probablemente sea este o MLA2828...)
  // OJO: Me han pasado id MLA2828593406 en la ultima captura

  const TARGET_ITEM = "MLA2828593406";

  try {
    console.log(`🔎 Analizando preguntas del Item ${TARGET_ITEM}...`);

    // Usar endpoint público de preguntas (questions/search)
    const searchUrl = `https://api.mercadolibre.com/questions/search?item=${TARGET_ITEM}&api_version=4`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("❌ Error ML API:", res.status, txt);
      return;
    }

    const data = await res.json();
    const questions = data.questions || [];

    if (questions.length === 0) {
      console.log("📭 No encontré preguntas para este Item.");
      return;
    }

    console.log(
      `\n🔎 Analizando las últimas ${questions.length} preguntas...\n`,
    );

    for (const q of questions) {
      console.log(`--------------------------------------------------`);
      console.log(`🗣️ Pregunta (${q.id}): "${q.text}"`);
      console.log(`📅 Fecha Pregunta: ${q.date_created}`);
      console.log(`📍 Estado: ${q.status}`);

      if (q.status === "ANSWERED" && q.answer) {
        console.log(`💬 Respuesta: "${q.answer.text}"`);
        console.log(`🤖 Fecha Respuesta: ${q.answer.date_created}`);

        const timeDiff =
          new Date(q.answer.date_created).getTime() -
          new Date(q.date_created).getTime();
        console.log(
          `⏱️ Tiempo de Reacción: ${timeDiff}ms (${(timeDiff / 1000).toFixed(2)}s)`,
        );

        if (timeDiff < 2000) {
          console.log(`🚨 !!! ALERTA ROJA !!! Respondido en < 2 segundos.`);
          console.log(
            `🧐 CULPABLE: IA NATIVA DE MERCADOLIBRE (O Bot muy rápido externo).`,
          );
          console.log(`👉 DATA ANSWER:`, JSON.stringify(q.answer, null, 2));
        } else {
          console.log(`✅ Tiempo humano/normal.`);
        }
      } else {
        console.log(`⏳ Sin respuesta aún.`);
      }
    }
  } catch (error) {
    console.error("❌ Error fatal:", error);
  }
}

checkLastQuestions();
