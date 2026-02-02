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

const ML_APP_ID = env.VITE_ML_APP_ID || env.ML_APP_ID;
const ML_APP_SECRET = env.VITE_ML_APP_SECRET || env.ML_APP_SECRET;

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_TOKEN,
);

async function createRealItem() {
  console.log("=== CREACIÓN REAL DE ITEM EN ML ===\n");
  console.log(
    "⚠️  ADVERTENCIA: Esto creará un item REAL en tu cuenta de MercadoLibre",
  );
  console.log("Puedes pausarlo o eliminarlo después desde el panel de ML\n");

  // Get token
  const { data: tokens } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!tokens || tokens.length === 0) {
    console.log("❌ No token found");
    return;
  }

  let accessToken = tokens[0].access_token;
  const refreshToken = tokens[0].refresh_token;

  const itemBody = {
    family_name: "Llavero 3D Prueba Sync " + Date.now(),
    category_id: "MLA1910", // Juegos y Juguetes > Otros
    price: 3000,
    currency_id: "ARS",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "free",
    description: {
      plain_text:
        "Producto de prueba para verificar sincronización con modelo UP 2026.",
    },
    pictures: [
      {
        source:
          "https://http2.mlstatic.com/storage/developers-site-cms-admin/dtmv/73479100-7561-11eb-a5a4-99881d77a28e.png",
      },
    ],
    attributes: [
      { id: "BRAND", value_name: "3D2Store" },
      { id: "MODEL", value_name: "Personalizado" },
      { id: "EMPTY_GTIN_REASON", value_id: "17055158" },
      { id: "ITEM_CONDITION", value_id: "2230284" },
      { id: "MANUFACTURER", value_name: "3D2" },
    ],
    sale_terms: [
      { id: "WARRANTY_TYPE", value_id: "2230280" },
      { id: "WARRANTY_TIME", value_name: "30 días" },
    ],
    shipping: {
      mode: "me2",
      local_pick_up: true,
      free_shipping: false,
    },
  };

  console.log("Creando item...");
  let response = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(itemBody),
  });

  let data = await response.json();

  if (response.status === 401) {
    console.log("Token expirado, refrescando...");
    const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: ML_APP_ID,
        client_secret: ML_APP_SECRET,
        refresh_token: refreshToken,
      }),
    });

    const refreshData = await refreshRes.json();
    if (refreshRes.ok) {
      accessToken = refreshData.access_token;
      console.log("Token refrescado, reintentando...\n");

      // Save new token
      await supabase
        .from("ml_tokens")
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_in: refreshData.expires_in,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", tokens[0].user_id);

      response = await fetch("https://api.mercadolibre.com/items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemBody),
      });

      data = await response.json();
    }
  }

  console.log(`\nStatus: ${response.status}`);

  if (response.ok) {
    console.log("\n✅ ¡ITEM CREADO EXITOSAMENTE!");
    console.log(`\nID: ${data.id}`);
    console.log(`Título generado por ML: ${data.title}`);
    console.log(`Permalink: ${data.permalink}`);
    console.log(`Status: ${data.status}`);
    console.log(`\n🔗 Ver en MercadoLibre: ${data.permalink}`);
    console.log(
      `\n⚠️  Recuerda pausar o eliminar este item de prueba desde tu panel de ML`,
    );
  } else {
    console.log("\n❌ Error al crear item:");
    console.log(JSON.stringify(data, null, 2));
  }
}

createRealItem().catch(console.error);
