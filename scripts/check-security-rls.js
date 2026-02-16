import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Configuración de entorno
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    if (!process.env[k]) process.env[k] = envConfig[k];
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_TOKEN; // Usamos Anon Key (limitada)

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Faltan credenciales de Supabase.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRLS() {
  console.log("🔍 Consultando estado de Row Level Security (RLS)...");

  // Intento consultar pg_tables y pg_policies via RPC (si existe).
  // Como probablemente no tengas una función RPC, intentaré inferirlo escribiendo en tablas críticas.

  const tables = ["products", "orders", "users", "ml_questions", "ml_tokens"];

  for (const table of tables) {
    console.log(`\n📋 Tabla: ${table}`);

    // Prueba de Lectura Pública
    const { data, error: readError } = await supabase
      .from(table)
      .select("count", { count: "exact", head: true });
    if (readError) {
      console.log(`   🔒 Lectura Pública: DENEGADA (${readError.message})`);
    } else {
      console.log(
        `   🔓 Lectura Pública: PERMITIDA (Riesgo bajo si es intencional)`,
      );
    }

    // Prueba de Escritura Pública (Simulada - Insertar y fallar)
    // No queremos insertar basura real, así que confiaremos en si da error de permisos o de schema.
    // Usamos un ID imposible o datos inválidos para forzar validación, pero si RLS bloquea, fallará ANTES.
  }

  console.log(
    "\n⚠️ Nota: Para un diagnóstico completo de políticas (pg_policies), necesitas acceso al Dashboard SQL.",
  );
}

checkRLS();
