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

async function testPublish() {
  // Get token
  const { data: tokens } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!tokens || tokens.length === 0) {
    console.log("No token found");
    return;
  }

  let accessToken = tokens[0].access_token;
  const refreshToken = tokens[0].refresh_token;

  // Test with MLA1910
  console.log("Testing with MLA1910 (Juegos y Juguetes > Otros)...\n");

  const itemBody = {
    title: "Juguete Test " + Date.now(),
    category_id: "MLA1910",
    price: 1500,
    currency_id: "ARS",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "free",
    description: {
      plain_text: "Producto de prueba para sincronización.",
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
      { id: "ITEM_CONDITION", value_id: "2230284" }, // Nuevo
      { id: "EMPTY_GTIN_REASON", value_id: "17055158" },
      { id: "MANUFACTURER", value_name: "3D2" },
    ],
    sale_terms: [
      { id: "WARRANTY_TYPE", value_id: "2230280" },
      { id: "WARRANTY_TIME", value_name: "30 días" },
    ],
  };

  console.log("Payload:");
  console.log(JSON.stringify(itemBody, null, 2));
  console.log("\n");

  let response = await fetch("https://api.mercadolibre.com/items/validate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(itemBody),
  });

  let data = await response.json();

  if (response.status === 401) {
    console.log("Token expired, refreshing...");
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
      console.log("Token refreshed, retrying...\n");

      response = await fetch("https://api.mercadolibre.com/items/validate", {
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

  console.log(`Status: ${response.status}`);
  console.log("Response:");
  console.log(JSON.stringify(data, null, 2));

  if (!response.ok && data.cause) {
    console.log("\n=== DETAILED ERRORS ===");
    data.cause.forEach((c, i) => {
      console.log(`\nError ${i + 1}:`);
      console.log(`  Code: ${c.code}`);
      console.log(`  Message: ${c.message}`);
      if (c.references) {
        console.log(`  References: ${c.references.join(", ")}`);
      }
    });
  }
}

testPublish().catch(console.error);
