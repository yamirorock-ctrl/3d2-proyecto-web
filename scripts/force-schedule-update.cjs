const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Cargar variables
const envPath = path.resolve(process.cwd(), ".env.local");
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const SUPABASE_URL = envConfig.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.VITE_SUPABASE_ANON_TOKEN;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function forceUpdateDate() {
  console.log("⏳ Buscando tareas pendientes...");

  // Buscar cualquier tarea 'pending'
  const { data: rows, error: searchError } = await supabase
    .from("social_queue")
    .select("*")
    .eq("status", "pending");

  if (searchError) {
    console.error("❌ Error buscando filas:", searchError.message);
    return;
  }

  if (rows.length === 0) {
    console.log("⚠️ No hay filas pendientes para actualizar.");
    return;
  }

  console.log(`🔎 Encontradas ${rows.length} filas pendientes.`);

  // Fecha de AYER (para asegurar que 'scheduled_for < now' sea TRUE)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString();

  console.log(`📅 Forzando fecha a: ${yesterdayStr} (Ayer)`);

  for (const row of rows) {
    const { error: updateError } = await supabase
      .from("social_queue")
      .update({ scheduled_for: yesterdayStr })
      .eq("id", row.id);

    if (updateError) {
      console.error(
        `💥 Error actualizando fila ${row.id}:`,
        updateError.message,
      );
      console.log(
        "💡 PISTA: Si es un error de RLS/Permisos, tendrás que quitar el filtro de fecha en Make temporalmente.",
      );
    } else {
      console.log(`✅ Fila ${row.id} actualizada con éxito.`);
    }
  }
}

forceUpdateDate();
