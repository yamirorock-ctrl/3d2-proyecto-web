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

async function testFinalImplementation() {
  console.log("=== PRUEBA FINAL DE SINCRONIZACIÓN ML 2026 ===\n");

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

  // Simulate the exact payload that api/ml-sync-product.js will send
  const testProduct = {
    name: "Llavero Personalizado 3D",
    price: 2500,
    stock: 5,
    description: "Llavero impreso en 3D con diseño personalizado",
  };

  const title = testProduct.name;
  const MARKUP_FACTOR = 1.25; // 25% markup
  const price = Math.floor(testProduct.price * MARKUP_FACTOR);
  const quantity = testProduct.stock;
  const description = testProduct.description;

  // Category prediction
  const predictionUrl = `https://api.mercadolibre.com/sites/MLA/domain_discovery/search?limit=1&q=${encodeURIComponent(title)}`;
  const predictorRes = await fetch(predictionUrl);
  const predictorData = await predictorRes.json();

  let categoryId = "MLA1910"; // Default fallback
  if (predictorData && predictorData.length > 0) {
    const isService =
      predictorData[0].domain_id?.includes("SERVICE") ||
      predictorData[0].domain_id?.includes("SERVICIO");
    if (!isService) {
      categoryId = predictorData[0].category_id;
    }
  }

  console.log(`Categoría predicha: ${categoryId}\n`);

  const itemBody = {
    family_name: title.slice(0, 60),
    category_id: categoryId,
    price: price,
    currency_id: "ARS",
    available_quantity: quantity,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "free", // Using free for testing
    description: {
      plain_text: description.slice(0, 4000),
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

  console.log("Payload completo:");
  console.log(JSON.stringify(itemBody, null, 2));
  console.log("\n");

  // Test with /items/validate
  console.log("Validando con ML...");
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

  console.log(`\nStatus: ${response.status}`);
  console.log("Response:");
  console.log(JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log("\n✅ ¡VALIDACIÓN EXITOSA!");
    console.log(
      "El código actualizado funciona correctamente con el modelo UP 2026.",
    );
  } else {
    console.log("\n⚠️ Errores encontrados:");
    if (data.cause) {
      data.cause.forEach((c, i) => {
        console.log(`\n${i + 1}. ${c.code || "unknown"}`);
        console.log(`   Tipo: ${c.type || "error"}`);
        console.log(`   Mensaje: ${c.message}`);
      });
    }
  }
}

testFinalImplementation().catch(console.error);
