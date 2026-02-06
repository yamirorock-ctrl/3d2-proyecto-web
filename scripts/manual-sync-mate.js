import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 1. Configuración de Entorno
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

const PRODUCT_ID = 47; // ID DEL MATE BOCA
const CLIENT_ID = env.VITE_ML_APP_ID || env.ML_APP_ID;
const CLIENT_SECRET = env.VITE_ML_APP_SECRET || env.ML_APP_SECRET;

async function manualSync() {
  console.log(`🚀 Iniciando Sync Manual para Producto ID: ${PRODUCT_ID}`);

  console.log("-> Obteniendo credenciales...");
  const { data: tokenData, error: tokenError } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !tokenData) {
    console.error("❌ Error: No hay token de MercadoLibre en Supabase.");
    return;
  }

  let accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  // 2. Obtener Producto
  console.log("-> Obteniendo datos del producto...");
  const { data: product, error: prodError } = await supabase
    .from("products")
    .select("*")
    .eq("id", PRODUCT_ID)
    .single();

  if (prodError || !product) {
    console.error("❌ Error: Producto no encontrado.");
    return;
  }

  // 3. Preparar Payload (LÓGICA CORREGIDA)
  const title = product.ml_title || product.name;
  const price = Math.floor(product.price * 1.25); // Markup 25% default
  const quantity = product.stock || 1;

  // Imágenes
  let pictures = [];
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach((img) => {
      let url =
        typeof img === "string"
          ? img.startsWith("{")
            ? JSON.parse(img).url
            : img
          : img.url;
      if (url) pictures.push({ source: url });
    });
  }
  if (pictures.length === 0 && product.image)
    pictures.push({ source: product.image });
  if (pictures.length === 0)
    pictures.push({ source: "https://via.placeholder.com/500" });

  const itemBody = {
    family_name: title.slice(0, 60),
    category_id: "MLA392282", // MATES (Detectada previamente)
    price: price,
    currency_id: "ARS",
    available_quantity: quantity,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "gold_special",
    description: {
      plain_text: (product.description || title).slice(0, 4000),
    },
    pictures: pictures,
    attributes: [
      { id: "BRAND", value_name: product.brand || "3D2Store" },
      { id: "MODEL", value_name: product.model || "Boca Juniors" },
      { id: "ITEM_CONDITION", value_id: "2230284" }, // Nuevo
      { id: "COLOR", value_name: "Azul" },
      { id: "MATE_GOURD_TYPE", value_name: "Bocón" },
      { id: "MATE_GOURD_MATERIALS", value_name: "Plástico PLA" },
      // NOTA: ELIMINADOS DESIGN_NAME Y PATTERN_NAME A PROPÓSITO
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

  console.log("-> Payload preparado (Sin atributos inválidos).");

  // Función de Posteo
  async function tryPost(token) {
    if (product.ml_item_id) {
      console.log(`-> Actualizando item existente: ${product.ml_item_id}`);
      // Lógica de update simplificada para este test
      return fetch(`https://api.mercadolibre.com/items/${product.ml_item_id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ price, available_quantity: quantity }),
      });
    } else {
      console.log(`-> Creando NUEVO item...`);
      return fetch("https://api.mercadolibre.com/items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemBody),
      });
    }
  }

  // 4. Ejecutar
  let res = await tryPost(accessToken);

  // 5. Manejo de Errores / Refresh
  if (res.status === 401 || res.status === 403) {
    console.log("⚠️ Token vencido o inválido. Refrescando...");
    const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });
    const refreshData = await refreshRes.json();
    if (!refreshRes.ok) {
      console.error("❌ Falló el refresh:", refreshData);
      return;
    }

    console.log("✅ Token refrescado. Guardando en DB...");
    await supabase
      .from("ml_tokens")
      .update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", tokenData.user_id);

    console.log("-> Reintentando posteo...");
    res = await tryPost(refreshData.access_token);
  }

  const data = await res.json();
  console.log("---------------------------------------------------");
  console.log(`📡 STATUS FINAL: ${res.status}`);

  if (res.ok) {
    console.log(`✅ ¡ÉXITO! ID ML: ${data.id}`);
    console.log(`🔗 Link: ${data.permalink}`);

    // Guardar en Supabase
    await supabase
      .from("products")
      .update({
        ml_item_id: data.id,
        ml_permalink: data.permalink,
        ml_status: data.status,
        last_ml_sync: new Date().toISOString(),
      })
      .eq("id", PRODUCT_ID);
    console.log("💾 Base de datos actualizada.");
  } else {
    console.error("❌ ERROR ML:");
    console.error(JSON.stringify(data, null, 2));
    fs.writeFileSync("debug_sync_error.json", JSON.stringify(data, null, 2));

    if (data.cause) {
      console.log("\nCAUSAS DETALLADAS:");
      data.cause.forEach((c) =>
        console.log(`- ${c.message} [Code: ${c.code}]`),
      );
    }
  }
}

manualSync();
