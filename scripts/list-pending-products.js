import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

async function listPending() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, created_at, category, price")
    .is("ml_item_id", null) // Solo los no sincronizados
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("=== PRODUCTOS PENDIENTES DE SUBIR A ML ===");
    if (data.length === 0) console.log("¡Todo al día! No hay pendientes.");
    data.forEach((p) => {
      console.log(
        `[ID: ${p.id}] ${p.name} (${p.category || "Sin cat"}) - $${p.price}`,
      );
    });
  }
}

listPending();
