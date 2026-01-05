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
    // We fetch the most recent token available (Single Tenant assumption).
    const { data: tokenData, error: tokenError } = await supabase
      .from("ml_tokens")
      .select("access_token, refresh_token, user_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Sync] Token fetch error:", tokenError);
      return res.status(401).json({
        error: "No linked MercadoLibre account found (check ml_tokens table).",
      });
    }

    let accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

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
    // Price Markup for MercadoLibre
    // Default 25% if not specified by frontend
    const markupInput =
      req.body.markupPercentage !== undefined ? req.body.markupPercentage : 25;
    const MARKUP_FACTOR = 1 + Number(markupInput) / 100;

    const originalPrice = Number(product.price);
    const price = Math.floor(originalPrice * MARKUP_FACTOR);
    console.log(
      `[ML Sync] Price Markup: Base $${originalPrice} + ${markupInput}% = $${price}`
    );
    const quantity = product.stock || 1;
    const description = product.description || product.name;
    // Image Handling: Support Multiple Images from 'images' column
    let pictures = [];

    // 1. Try 'images' array (Supabase JSONB or Array)
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img) => {
        let url = null;
        if (typeof img === "string") {
          // Check if it's a JSON string or direct URL
          if (img.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(img);
              url = parsed.url;
            } catch (e) {
              url = null;
            }
          } else {
            url = img;
          }
        } else if (typeof img === "object" && img?.url) {
          url = img.url;
        }

        if (url && url.startsWith("http")) {
          pictures.push({ source: url });
        }
      });
    }

    // 2. Fallback to 'image' column if pictures is still empty
    if (pictures.length === 0 && product.image) {
      pictures.push({ source: product.image });
    }

    // 3. Last Resort
    if (pictures.length === 0) {
      pictures.push({ source: "https://via.placeholder.com/500" });
    }

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
      pictures: pictures,
      attributes: [
        { id: "BRAND", value_name: "3D2Store" }, // Marca genérica o marca propia
        { id: "MODEL", value_name: "Personalizado" }, // Modelo genérico
        { id: "ITEM_CONDITION", value_name: "Nuevo" },
      ],
      // ML often requires attributes. We send basic ones (Brand/Model) to avoid rejection in strict categories.
    };

    // Helper function to perform the ML Request
    async function performMLRequest(token) {
      const isUpdate = !!product.ml_item_id;
      if (isUpdate) {
        // UPDATE (PUT)
        const updateBody = {
          price: price,
          available_quantity: quantity,
          pictures: itemBody.pictures,
        };
        console.log(`[ML Sync] Updating item ${product.ml_item_id}...`);
        return fetch(
          `https://api.mercadolibre.com/items/${product.ml_item_id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateBody),
          }
        );
      } else {
        // CREATE (POST)
        console.log(`[ML Sync] Creating new item...`);
        return fetch(`https://api.mercadolibre.com/items`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(itemBody),
        });
      }
    }

    // 6. Execute with Retry/Refresh Logic
    let mlResponse = await performMLRequest(accessToken);

    // If Unauthorized (401) or Forbidden (403 - sometimes ML sends this for policy issues), try to refresh token
    if (mlResponse.status === 401 || mlResponse.status === 403) {
      console.log(
        `[ML Sync] Token issue (${mlResponse.status}). Attempting refresh...`
      );

      const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
      const client_secret =
        process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET;

      // Call ML Token Refresh
      const refreshRes = await fetch(
        "https://api.mercadolibre.com/oauth/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: String(client_id),
            client_secret: String(client_secret),
            refresh_token: refreshToken,
          }),
        }
      );

      const refreshData = await refreshRes.json();

      if (!refreshRes.ok || !refreshData.access_token) {
        console.error("[ML Sync] Token refresh failed:", refreshData);
        return res.status(401).json({
          error:
            "MercadoLibre session expired. Please re-connect your account in settings.",
          details: refreshData,
        });
      }

      console.log("[ML Sync] Token refreshed successfully.");

      // Save new tokens to Supabase
      const { error: saveError } = await supabase
        .from("ml_tokens")
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token, // ML rotates refresh tokens too
          expires_in: refreshData.expires_in,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", tokenData.user_id); // using the ID from the selected row

      if (saveError)
        console.error("[ML Sync] Error saving new tokens:", saveError);

      // Retry Request with new token
      accessToken = refreshData.access_token;
      mlResponse = await performMLRequest(accessToken);
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
      action: !!product.ml_item_id ? "updated" : "created",
      ml_id: mlData.id,
      permalink: mlData.permalink,
      status: mlData.status,
    });
  } catch (err) {
    console.error("[ML Sync] Unhandled exception:", err);
    return res.status(500).json({ error: err.message });
  }
}
