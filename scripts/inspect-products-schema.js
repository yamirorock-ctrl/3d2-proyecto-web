import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configuración de Entorno
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) {
      env[key.trim()] = rest
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  });
}

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_TOKEN,
);

async function inspectTable() {
  console.log("🔍 Inspeccionando tabla 'products'...");

  // Intentamos leer una fila para ver las claves devueltas
  const { data, error } = await supabase.from("products").select("*").limit(1);

  if (error) {
    console.error("Error:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Columnas actuales detectadas:");
    console.log(Object.keys(data[0]).join(", "));
  } else {
    console.log(
      "La tabla está vacía, no puedo inferir columnas dinámicamente sin permisos de admin schema.",
    );
  }
}

inspectTable();
