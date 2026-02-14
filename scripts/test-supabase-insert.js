import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Cargar .env.local manualmente para asegurar que tenemos las keys
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_TOKEN || process.env.SUPABASE_ANON_KEY;

console.log("🛠️ Probando conexión a Supabase...");
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Key: ${SUPABASE_ANON_KEY ? "Presente (****)" : "FALTANTE ❌"}`);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Faltan las variables de entorno en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  console.log("📝 Intentando escribir en 'ml_questions'...");

  const { data, error } = await supabase
    .from("ml_questions")
    .insert({
      question_text: "PRUEBA_DIAGNOSTICO_LOCAL_" + Date.now(),
      status: "pending",
      item_id: "TEST-LOCAL",
      ai_model: "test-script",
    })
    .select();

  if (error) {
    console.error("❌ ERROR AL INSERTAR:", error.message);
    console.error("👉 DETALLE:", error);
    console.log(
      "\n💡 CAUSA PROBABLE: Row Level Security (RLS) está bloqueando la escritura pública.",
    );
  } else {
    console.log("✅ ¡ÉXITO! Se insertó correctamente.");
    console.log("📦 Dato:", data);
    console.log("\n👉 CONCLUSIÓN: La base de datos y permisos están BIEN.");
    console.log(
      "👉 EL PROBLEMA ES VERCEL: No tiene las variables de entorno en el Backend.",
    );
  }
}

testInsert();
