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
    const title = product.ml_title || product.name;
    // Price Markup for MercadoLibre
    // Default 25% if not specified by frontend
    const markupInput =
      req.body.markupPercentage !== undefined ? req.body.markupPercentage : 25;
    const MARKUP_FACTOR = 1 + Number(markupInput) / 100;

    const originalPrice = Number(product.price);
    const price = Math.floor(originalPrice * MARKUP_FACTOR);
    console.log(
      `[ML Sync] Price Markup: Base $${originalPrice} + ${markupInput}% = $${price}`,
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
    // We search for the best category based on the title AND the internal category to provide context
    // This helps avoid misclassifications (e.g. "Cartel Nombre" -> "Bebés" instead of "Juguetes")
    const predictionQuery = `${title} ${product.category || ""}`
      .trim()
      .slice(0, 100);
    console.log(`[ML Sync] Predicting category for: "${predictionQuery}"`);

    const predictionUrl = `https://api.mercadolibre.com/sites/MLA/domain_discovery/search?limit=1&q=${encodeURIComponent(
      predictionQuery,
    )}`;
    const predictorRes = await fetch(predictionUrl);
    const predictorData = await predictorRes.json();

    let categoryId = "MLA3530"; // Default fallback (Others)
    let categoryName = "Otros";
    if (predictorData && predictorData.length > 0) {
      // Filter out 'SERVICE' domains if possible, as they require extra contact fields (like family_name)
      const isService =
        predictorData[0].domain_id?.includes("SERVICE") ||
        predictorData[0].domain_id?.includes("SERVICIO");

      if (isService) {
        console.log(
          `[ML Sync] Predictor suggested a Service category (${predictorData[0].domain_id}). Falling back to generic product category to avoid 'family_name' errors.`,
        );
        categoryId = "MLA3530"; // Others
        categoryName = "Otros (Físico)";
      } else {
        categoryId = predictorData[0].category_id;
        categoryName = predictorData[0].domain_id || "Predicha";
        console.log(
          `[ML Sync] Predicted Category: ${categoryId} (${categoryName})`,
        );
      }
    } else {
      console.log(`[ML Sync] Using fallback category: ${categoryId}`);
    }

    // Aseguramos que el precio y stock sean válidos
    const finalPrice = Math.max(price || 1, 1);
    const finalQuantity = Math.max(quantity || 1, 1);

    // 5. Build Item JSON for User Product Model (2026)
    // NOTE: ML migrated to "User Product" model - uses family_name instead of title
    const itemBody = {
      family_name: title.slice(0, 60), // ML generates title automatically from this
      category_id: categoryId,
      price: finalPrice,
      currency_id: "ARS",
      available_quantity: finalQuantity,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: "gold_special", // Classic exposure.
      description: {
        plain_text: description.slice(0, 4000),
      },
      pictures: pictures,
      attributes: [
        { id: "BRAND", value_name: product.brand || "3D2Store" },
        { id: "MODEL", value_name: product.model || "Personalizado" },
        { id: "ITEM_CONDITION", value_id: "2230284" }, // "Nuevo"
        ...(product.gtin
          ? [{ id: "GTIN", value_name: product.gtin }]
          : [{ id: "EMPTY_GTIN_REASON", value_id: "17055158" }]),
        ...(product.mpn ? [{ id: "SKU", value_name: product.mpn }] : []),

        // Dynamic Attributes from UI (Flexible Schema)
        ...(product.ml_attributes
          ? Object.entries(product.ml_attributes).map(([key, value]) => ({
              id: key,
              value_name: String(value), // Ensure simple string values
            }))
          : []),
      ],
      sale_terms: [
        { id: "WARRANTY_TYPE", value_id: "2230280" }, // "Garantía del vendedor"
        { id: "WARRANTY_TIME", value_name: "30 días" },
      ],
      shipping: {
        mode: "me2", // Mercado Envíos - envío a cargo del vendedor
        local_pick_up: true,
        free_shipping: false,
      },
    };

    console.log(`[ML Sync] Full Payload:`, JSON.stringify(itemBody));

    // Helper function to perform the ML Request
    async function performMLRequest(token) {
      const isUpdate = !!product.ml_item_id;
      if (isUpdate) {
        const updateBody = {
          price: finalPrice,
          available_quantity: finalQuantity,
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
          },
        );
      } else {
        console.log(
          `[ML Sync] Creating new item... Payload:`,
          JSON.stringify({ ...itemBody, pictures: "...hidden..." }),
        );
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
    let serverLogs = [];
    let mlResponse = await performMLRequest(accessToken);

    // RETRY LOGIC FOR "SERVICE" MISCLASSIFICATION (family_name/given_name error) OR GENERIC REQUIREMENT FAIL
    if (mlResponse.status === 400) {
      const clone = await mlResponse.clone().json();
      const errString = JSON.stringify(clone);

      serverLogs.push(
        `First attempt failed with 400. Error: ${errString.slice(0, 200)}...`,
      );

      const isSpecificPrediction = categoryId !== "MLA3530";

      // Broadened check: family_name OR given_name OR just "required_fields" in general if we want to force fallback
      if (
        errString.includes("family_name") ||
        errString.includes("given_name") ||
        errString.includes("required_fields") ||
        errString.includes("item.category_id.invalid") ||
        errString.includes("validation_error") ||
        errString.includes("missing_catalog_required") ||
        errString.includes("PA_UNAUTHORIZED")
      ) {
        // ONLY Retry with "Juguete" fallback if we didn't have a strong prediction OR if the error specifically complains about the category we chose being invalid for the title/attributes.
        // If we predicted "Mates" and it failed, switching to "Juguete" is bad.
        // We only switch to Juguete if the original attempt was essentially a "General" attempt that failed.

        // FAIL-SAFE: If we had a specific prediction (like Baby Door Hangers), DO NOT fall back to Toys.
        // That only leads to "Incorrect Category" rejections.
        // We only retry if we were estimating "MLA3530" (Others) or if the error strictly says "Category Invalid".

        if (
          isSpecificPrediction &&
          !errString.includes("item.category_id.invalid")
        ) {
          serverLogs.push(
            "Prediction was specific (" +
              categoryId +
              ") and ML rejected it. STOPPING here to avoid miscategorization punishment.",
          );
          // Allow the original error (missing attributes) to be returned to the user
        } else {
          // Only use this strategy if we were blind (MLA3530) or ML explicitly told us the category ID was bad
          serverLogs.push(
            "Generic/Service error detected on generic category. Retrying with Anti-Ambiguity Strategy (family_name prefix + MLA1910 + Full Physical Args)...",
          );

          itemBody.category_id = "MLA1910"; // "Juegos y Juguetes > Otros"
          itemBody.family_name = ("Juguete " + itemBody.family_name).slice(
            0,
            60,
          ); // Force physical context

          // Send FULL physical signal
          itemBody.attributes = [
            { id: "BRAND", value_name: "3D2Store" },
            { id: "MODEL", value_name: "Personalizado" },
            { id: "ITEM_CONDITION", value_id: "2230284" }, // "Nuevo"
            { id: "EMPTY_GTIN_REASON", value_id: "17055158" },
            { id: "MANUFACTURER", value_name: "3D2" },
          ];
          // Restore generic warranty
          itemBody.sale_terms = [
            { id: "WARRANTY_TYPE", value_id: "2230280" },
            { id: "WARRANTY_TIME", value_name: "30 días" },
          ];

          mlResponse = await performMLRequest(accessToken);
          serverLogs.push(
            `Retry executed with family_name '${itemBody.family_name}'. New Status: ${mlResponse.status}`,
          );
        }
      }
    }

    if (mlResponse.status === 401 || mlResponse.status === 403) {
      console.log(`[ML Sync] Status ${mlResponse.status} encountered.`);

      const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
      const client_secret =
        process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET;

      if (mlResponse.status === 401) {
        console.log(`[ML Sync] Attempting token refresh...`);
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
          },
        );

        const refreshData = await refreshRes.json();

        if (!refreshRes.ok || !refreshData.access_token) {
          console.error("[ML Sync] Token refresh failed:", refreshData);
          return res.status(401).json({
            error:
              "La sesión de MercadoLibre expiró. Por favor, vuelve a conectar tu cuenta en configuración.",
            details: refreshData,
          });
        }

        console.log("[ML Sync] Token refreshed successfully.");
        const { error: saveError } = await supabase
          .from("ml_tokens")
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            expires_in: refreshData.expires_in,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", tokenData.user_id);

        if (saveError)
          console.error("[ML Sync] Error saving new tokens:", saveError);

        accessToken = refreshData.access_token;
        mlResponse = await performMLRequest(accessToken);
      } else if (mlResponse.status === 403) {
        // Diagnostic for 403 Forbidden
        const mlData = await mlResponse.clone().json();
        console.error("[ML Sync] 403 Forbidden. ML Response:", mlData);

        // Check User Restrictions
        let restrictions = null;
        try {
          const restRes = await fetch(
            `https://api.mercadolibre.com/users/${tokenData.user_id}/restrictions`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );
          restrictions = await restRes.json();
          console.log("[ML Sync] User Restrictions:", restrictions);
        } catch (e) {
          console.error("[ML Sync] Failed to fetch restrictions:", e);
        }

        return res.status(403).json({
          error: "Acceso denegado (403). MercadoLibre rechazó la operación.",
          mlError: mlData.message || mlData.error || "Operación no permitida",
          code: mlData.code,
          causes: mlData.cause || [],
          restrictions: restrictions,
          details: mlData,
          suggestion:
            "Verifica que tu cuenta de MercadoLibre no tenga deudas o suspensiones.",
        });
      }
    }

    const mlData = await mlResponse.json();

    if (!mlResponse.ok) {
      console.error("[ML Sync] ML Error Status:", mlResponse.status);
      console.error(
        "[ML Sync] ML Error Body:",
        JSON.stringify(mlData, null, 2),
      );

      const causes = mlData.cause || mlData.error_messages || [];
      const errorMsg =
        (mlData.message || mlData.error || "Error desconocido en ML") +
        (serverLogs.length > 0 ? " | LOGS: " + serverLogs.join(" -> ") : "");

      // Special check for common errors
      let suggestion = "Revisa los campos obligatorios del producto.";
      const causesStr = JSON.stringify(causes);

      if (
        errorMsg.includes("body.required_fields") ||
        errorMsg.includes("missing_attributes")
      ) {
        const missingFields = causes
          .map((c) => c.message || c.id || JSON.stringify(c))
          .join(", ");
        suggestion = `Faltan campos obligatorios en MercadoLibre: ${missingFields}.`;
        console.log(`[ML Sync] Missing fields identified: ${missingFields}`);
      } else if (causesStr.includes("family_name")) {
        suggestion =
          "MercadoLibre cree que esto es un 'Servicio'. Intenta cambiar el nombre del producto para que parezca un objeto físico.";
      } else if (causesStr.includes("title.max_length")) {
        suggestion =
          "El título es demasiado largo. MercadoLibre permite un máximo de 60 caracteres.";
      }

      return res.status(mlResponse.status).json({
        error: "Error en la interfaz con MercadoLibre",
        mlError: errorMsg,
        causes: causes,
        details: mlData,
        suggestion: suggestion,
        serverLogs: serverLogs, // <-- Debug info exposed
        debug: {
          categoryId,
          categoryName,
          missingFieldsSent: itemBody.attributes.map((a) => a.id),
        },
      });
    }

    // 7. Save Result to Supabase
    // We update ml_item_id and status
    const { error: dbUpdateError } = await supabase
      .from("products")
      .update({
        ml_item_id: mlData.id,
        ml_status: mlData.status,
        ml_permalink: mlData.permalink,
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
      serverLogs: serverLogs,
    });
  } catch (err) {
    console.error("[ML Sync] Unhandled exception:", err);
    return res.status(500).json({ error: err.message });
  }
}
