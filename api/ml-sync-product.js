import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Server misconfigured (Supabase)" });
  }

  try {
    const { productId, userId } = req.body;

    if (!productId || !userId) {
      return res.status(400).json({ error: "Missing productId or userId" });
    }

    // 1. Get User's ML Token
    // CRITICAL FIX: The ml_tokens table stores the MercadoLibre ID (numeric), not the Supabase UUID on 'user_id' column in the current OAuth flow.
    // Since this is a single-tenant store (one admin, one ML account), we fetch the most recent token available.
    const { data: tokenData, error: tokenError } = await supabase
      .from("ml_tokens")
      .select("access_token")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Sync] Token fetch error:", tokenError);
      return res.status(401).json({
        error: "No linked MercadoLibre account found (check ml_tokens table).",
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Get Product Data from Supabase
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // 3. Prepare Product Data for ML
    const title = product.name;
    // Price Markup for MercadoLibre (e.g. 15% to cover commissions)
    const MARKUP_PERCENTAGE = 0.15;
    const originalPrice = Number(product.price);
    const price = Math.floor(originalPrice * (1 + MARKUP_PERCENTAGE));
    console.log(
      `[ML Sync] Price Markup: Base $${originalPrice} + 15% = $${price}`
    );
    const quantity = product.stock || 1;
    const description = product.description || product.name;
    // Basic image handling - take first correct URL
    // FIX: Column name in DB is 'image', not 'image_url'
    const pictureUrl = product.image || "https://via.placeholder.com/500";

    // 4. Predict Category (Crucial for ML)
    // We search for the best category based on the title
    const predictionUrl = `https://api.mercadolibre.com/sites/MLA/domain_discovery/search?limit=1&q=${encodeURIComponent(
      title
    )}`;
    const predictorRes = await fetch(predictionUrl);
    const predictorData = await predictorRes.json();

    let categoryId = "MLA3530"; // Default fallback (Others)
    if (predictorData && predictorData.length > 0) {
      categoryId = predictorData[0].category_id;
    }

    // 5. Build Item JSON
    const itemBody = {
      title: title.slice(0, 60), // ML limit 60 chars
      category_id: categoryId,
      price: price,
      currency_id: "ARS",
      available_quantity: quantity,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: "gold_special", // Classic exposure. 'gold_pro' is Premium. 'gold_special' is Clásica.
      description: {
        plain_text: description.slice(0, 4000),
      },
      pictures: [{ source: pictureUrl }],
      attributes: [
        { id: "BRAND", value_name: "3D2Store" }, // Marca genérica o marca propia
        { id: "MODEL", value_name: "Personalizado" }, // Modelo genérico
        { id: "ITEM_CONDITION", value_name: "Nuevo" },
      ],
      // ML often requires attributes. We send basic ones (Brand/Model) to avoid rejection in strict categories.
    };

    // 6. Check if Update or Create
    let mlResponse;
    const isUpdate = !!product.ml_item_id;

    if (isUpdate) {
      // UPDATE (PUT)
      // Note: Some fields like title/category might be locked after sales.
      // We focus on Price and Stock for updates usually.
      const updateBody = {
        price: price,
        available_quantity: quantity,
        pictures: itemBody.pictures,
        // Title/Description updates depend on item status
      };

      console.log(`[ML Sync] Updating item ${product.ml_item_id}...`);
      mlResponse = await fetch(
        `https://api.mercadolibre.com/items/${product.ml_item_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateBody),
        }
      );
    } else {
      // CREATE (POST)
      console.log(`[ML Sync] Creating new item...`);
      mlResponse = await fetch(`https://api.mercadolibre.com/items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemBody),
      });
    }

    const mlData = await mlResponse.json();

    if (!mlResponse.ok) {
      console.error("[ML Sync] ML Error:", mlData);
      return res.status(mlResponse.status).json({
        error: "Error interfacing with MercadoLibre",
        mlError: mlData.message || mlData.error || "Unknown ML Error",
        causes: mlData.cause || [],
        details: mlData,
        sentBody: itemBody,
      });
    }

    // 7. Save Result to Supabase
    // We update ml_item_id and status
    const { error: dbUpdateError } = await supabase
      .from("products")
      .update({
        ml_item_id: mlData.id,
        ml_status: mlData.status,
        last_ml_sync: new Date().toISOString(),
      })
      .eq("id", productId);

    if (dbUpdateError) {
      console.error("[ML Sync] Database update failed", dbUpdateError);
    }

    return res.status(200).json({
      success: true,
      action: isUpdate ? "updated" : "created",
      ml_id: mlData.id,
      permalink: mlData.permalink,
      status: mlData.status,
    });
  } catch (err) {
    console.error("[ML Sync] Unhandled exception:", err);
    return res.status(500).json({ error: err.message });
  }
}
