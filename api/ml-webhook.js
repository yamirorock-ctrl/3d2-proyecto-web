/* eslint-disable */
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GEMINI_API_KEY =
  process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// Force initialize supabase (Robust)
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase =
  SUPABASE_URL && supabaseKey ? createClient(SUPABASE_URL, supabaseKey) : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Config
const MAKE_WEBHOOK_URL =
  "https://hook.us2.make.com/3du519txd4fyw541s7gtcfnto432gmeg"; // Optional integration

// Bot Personality (Backup)
const FALLBACK_PROMPT = `
Eres 'Printy' 🖨️, el robot asistente de la marca "3D2" (Impresión 3D y Corte Láser).
Tu objetivo es responder preguntas de compradores en MercadoLibre con energía, amabilidad y TOTAL SEGURIDAD.

🚨 REGLAS DE ORO DE MERCADOLIBRE (INTOCABLES):
1. ⛔ JAMÁS des datos de contacto (teléfono, mail, dirección exacta, instagram, redes).
   - Si piden contacto: "Por políticas de MercadoLibre no puedo pasarte datos de contacto por acá. Al realizar la compra te llegarán mis datos automáticamente. 😉"
2. ⛔ NO incites a comprar por fuera ("búscanos", "somos tal").
3. ⛔ NO uses palabras prohibidas como: "transferencia", "efectivo", "descuento por fuera".
4. ✅ SIEMPRE invita a ofertar dentro de la plataforma.

TU PERSONALIDAD:
1. ¡Sé alegre y servicial! Usa emojis (🚀, ✨, 💜, 🤖) con moderación.
2. FIRMA: NO uses nombres propios ni firmas. Termina con frases de cierre de venta.
3. SI HAY STOCK (>0): "¡Hola! 👋 Sí, tenemos stock disponible. ¡Esperamos tu compra para enviártelo cuanto antes! 🚀"
4. SI NO HAY STOCK (=0): "¡Hola! En este momento se nos agotó para entrega inmediata. Volvé a consultarnos pronto. 💜"
5. PERSONALIZADOS: "¡Sí! Somos fabricantes. Podés ofertar en esta publicación y luego coordinamos los detalles exactos del diseño por el chat de la compra. 🎨"
6. ENVÍOS: "Hacemos envíos a todo el país con MercadoEnvíos. El costo figura arriba del botón de comprar. 🚚"
7. UBICACIÓN: Si preguntan, estamos en [TU ZONA/BARRIO AQUI].
8. IMPORTANTE: Sé CONCISO. JAMÁS sugieras contactar por fuera. SIEMPRE dirige al botón de comprar.

CONTEXTO ACTUAL:
Producto: {TITLE}
Precio: {CURRENCY} {PRICE}
Stock Real (Sistema): {STOCK}
Descripción: {DESCRIPTION}
Atributos (Ficha Técnica): {ATTRIBUTES}
`;

// --- Safety Check: Is Bot Enabled? ---
async function isBotEnabled() {
  if (!supabase) return false;
  try {
    // Try to fetch from app_settings
    const { data, error } = await supabase
      .from("app_settings")
      .select("bot_enabled")
      .eq("id", 1)
      .maybeSingle();

    // If table doesn't exist or row missing, default to TRUE (classic behavior)
    if (error || !data) {
      // console.warn("⚠️ app_settings not found, defaulting ENABLED.");
      return true;
    }
    return data.bot_enabled;
  } catch (e) {
    console.error("Error checking bot status:", e);
    return true; // Default ON safely
  }
}

export default async function handler(req, res) {
  try {
    // 1. Health Check (GET)
    if (req.method === "GET")
      return res.status(200).send("OK - Printy V2 Alive 🤖");

    console.log("🚀 Webhook Triggered!");

    if (!supabase) {
      console.error(
        "❌ CRITICAL: Supabase client not initialized. Missing Envs?",
      );
      // Return 200 to avoid ML retry storm, but log error
      return res.status(200).json({ error: "Server Configuration Error" });
    }

    // 2. Check Global Bot Status (but do NOT block orders from passing)
    const botEnabled = await isBotEnabled();
    if (!botEnabled) {
      console.log(
        "🛑 Bot is OFF by Admin. AI will skip answering, but will log question and process orders.",
      );
    }

    const topic = req.query?.topic || req.body?.topic;
    const resource = req.query?.resource || req.body?.resource;
    const applicationId = req.body?.application_id;

    console.log(
      `[ML Webhook] Received: ${topic} -> ${resource} (App: ${applicationId})`,
    );

    // 3. Filter Topics & Validate
    if (!["orders_v2", "orders", "questions"].includes(topic)) {
      return res.status(200).json({ ignored: true, topic });
    }

    // 4. Get Active Token
    const { data: tokenData, error: tokenError } = await supabase
      .from("ml_tokens")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Webhook] No ML Token found in DB.");
      return res.status(200).json({ error: "No token" });
    }

    let accessToken = tokenData.access_token;

    // 4.b AUTO-REFRESH ON THE FLY (No external Cron/UptimeRobot needed!)
    // If the token is older than 5 hours (18000 secs), we refresh it right here before handling the ML event.
    const lastUpdate = new Date(tokenData.updated_at).getTime();
    const secondsSinceUpdate = (Date.now() - lastUpdate) / 1000;
    
    if (secondsSinceUpdate > 18000) {
        console.log(`[ML Webhook] Token is ${secondsSinceUpdate}s old (> 5hrs). Auto-refreshing on the fly...`);
        try {
            const client_id = process.env.VITE_ML_APP_ID || process.env.ML_APP_ID;
            const client_secret = process.env.VITE_ML_APP_SECRET || process.env.ML_APP_SECRET;
            const tokenUrl = "https://api.mercadolibre.com/oauth/token";
            
            const params = new URLSearchParams();
            params.set("grant_type", "refresh_token");
            params.set("client_id", String(client_id));
            params.set("client_secret", String(client_secret));
            params.set("refresh_token", String(tokenData.refresh_token));
            
            const r = await fetch(tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
            });
            
            if (r.ok) {
                const refreshedData = await r.json();
                accessToken = refreshedData.access_token;
                
                // Save it for future requests
                await supabase.from("ml_tokens").upsert({
                    user_id: String(refreshedData.user_id),
                    access_token: refreshedData.access_token,
                    refresh_token: refreshedData.refresh_token,
                    expires_in: refreshedData.expires_in,
                    scope: refreshedData.scope,
                    token_type: refreshedData.token_type,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });
                console.log("[ML Webhook] 🔥 Auto-Refresh ON THE FLY successful!");
            } else {
                console.error("[ML Webhook] Auto-Refresh failed. Continuing with old token (might fail).", await r.text());
            }
        } catch (err) {
            console.error("[ML Webhook] Auto-Refresh execution error:", err);
        }
    }

    // 5. Route Logic
    if (topic === "questions") {
      return await handleQuestion(resource, accessToken, res, botEnabled);
    } else {
      return await handleOrder(resource, accessToken, res);
    }
  } catch (e) {
    console.error("[ML Webhook] GLOBAL ERROR:", e);
    // Always return 200 to ML to prevent notification loop/ban
    return res.status(200).json({ error: e.message });
  }
}

// ------------------------------------------------------------------
// HANDLERS
// ------------------------------------------------------------------

async function handleQuestion(resource, accessToken, res, botEnabled) {
  let questionText = "Unknown";
  let questionId = "Unknown";
  let itemId = "Unknown";

  try {
    // 1. Fetch Question from ML
    const qRes = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!qRes.ok) {
      const errBody = await qRes.text();
      throw new Error(`Failed to fetch question: ${qRes.status} - ${errBody}`);
    }
    const question = await qRes.json();

    questionText = question.text;
    questionId = question.id;
    itemId = question.item_id;

    console.log(
      `[ML Webhook] Processing Question: "${questionText}" (ID: ${questionId})`,
    );

    // 2. Audit Log (Pending)
    // We try to upsert to avoid duplicates, or just insert.
    // Since we don't have unique constraint on question_id in some schemas, we check first.
    const { data: existingQ } = await supabase
      .from("ml_questions")
      .select("id, status, created_at")
      .eq("question_id", questionId.toString())
      .maybeSingle();

    if (existingQ) {
      if (existingQ.status === "answered") {
        console.log("⚠️ Already answered. Skipping.");
        return res.status(200).json({ status: "already_answered" });
      }
      // If pending for < 2 min, skip (concurrent processing)
      const diff = Date.now() - new Date(existingQ.created_at).getTime();
      if (diff < 120000) {
        console.log("⏳ Processing in progress. Skipping.");
        return res.status(200).json({ status: "processing" });
      }
    } else {
      // Insert new
      await supabase.from("ml_questions").insert({
        item_id: itemId,
        question_text: questionText,
        question_id: questionId.toString(),
        status: "pending",
        ai_model: "gemini-2.5-flash",
      });
    }

    // 3. Check ML Status
    if (question.status !== "UNANSWERED") {
      console.warn(
        `[ML Webhook] Question status is ${question.status}. Auto-closing.`,
      );
      await supabase
        .from("ml_questions")
        .update({
          status: "answered",
          answer_text: `[Skipped] Status: ${question.status}`,
        })
        .eq("question_id", questionId.toString());
      return res.status(200).json({ status: "skipped_status" });
    }

    // --- BOT IS OFF: STOP HERE BUT LEAVE QUESTION LOGGED ---
    if (!botEnabled) {
      console.log(
        `[ML Webhook] Bot disabled. Question ${questionId} logged for human answer.`,
      );
      return res.status(200).json({ status: "logged_for_human" });
    }

    if (!genAI) throw new Error("Gemini API Key missing");

    // 4. Fetch Context (Parallel)
    const [item, descriptionData, dbProduct] = await Promise.all([
      fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()),
      fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : { plain_text: "" })),
      supabase
        .from("products")
        .select("stock, name")
        .eq("ml_item_id", itemId)
        .limit(1)
        .maybeSingle(),
    ]);

    // 5. Build Prompt
    const attributesText =
      item.attributes?.map((a) => `${a.name}: ${a.value_name}`).join(", ") ||
      "Sin datos";
    const descriptionText = descriptionData.plain_text || "Sin descripción";
    const realStock = dbProduct.data?.stock ?? item.available_quantity;

    // Dynamic Prompt Lookup
    let systemPrompt = FALLBACK_PROMPT;
    const { data: promptData } = await supabase
      .from("ai_prompts")
      .select("system_instructions")
      .eq("role", "printy_ml_assistant")
      .eq("active", true)
      .maybeSingle();
    if (promptData?.system_instructions)
      systemPrompt = promptData.system_instructions;

    const finalPrompt = systemPrompt
      .replace("{TITLE}", item.title)
      .replace("{PRICE}", item.price)
      .replace("{CURRENCY}", item.currency_id)
      .replace("{STOCK}", realStock)
      .replace("{DESCRIPTION}", descriptionText.slice(0, 1000))
      .replace("{ATTRIBUTES}", attributesText);

    // 6. Generate AI Answer
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: finalPrompt,
    }); // Use Printy 3.0 model
    const result = await model.generateContent(`Pregunta: "${questionText}"`);
    const answerText = result.response.text().trim();

    if (!answerText) throw new Error("Empty AI Response");

    console.log(`[ML Webhook] Generated: "${answerText}"`);

    // 7. Post to ML
    const ansRes = await fetch(`https://api.mercadolibre.com/answers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question_id: questionId, text: answerText }),
    });

    const ansData = await ansRes.json();

    // 8. Handle Result
    if (!ansRes.ok) {
      if (
        ansData.error === "not_unanswered_question" ||
        ansData.message === "Question closed"
      ) {
        console.log("⚠️ Race condition detected. Marking as answered.");
        await supabase
          .from("ml_questions")
          .update({
            status: "answered",
            answer_text: answerText + " (Race Condition)",
          })
          .eq("question_id", questionId.toString());
        return res.status(200).json({ status: "race_condition_handled" });
      }
      throw new Error(`ML Answers API Error: ${JSON.stringify(ansData)}`);
    }

    // Success
    await supabase
      .from("ml_questions")
      .update({
        status: "answered",
        answer_text: answerText,
        created_at: new Date().toISOString(),
      })
      .eq("question_id", questionId.toString());

    return res.status(200).json({ success: true, answer: answerText });
  } catch (error) {
    console.error("[ML Webhook] Error in handleQuestion:", error);
    await supabase
      .from("ml_questions")
      .update({ status: "error", answer_text: error.message })
      .eq("question_id", questionId.toString()); // Use ID if known

    return res.status(200).json({ error: error.message });
  }
}

async function handleOrder(resource, accessToken, res) {
  try {
    const oRes = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!oRes.ok) throw new Error("Orders API Failed");
    const order = await oRes.json();

    console.log(
      `[ML Webhook] Order ${order.id} received. Total: ${order.total_amount}`,
    );

    // If order is not paid, we might want to skip or just mark as pending
    if (order.status !== "paid" && order.status !== "confirmed") {
      console.log(
        `[ML Webhook] Order ${order.id} is ${order.status}, but processing anyway.`,
      );
    }

    const orderItems = [];
    let updatedStockLog = [];

    // 1. Process items & Update Stock
    for (const item of order.order_items) {
      const mlItemId = item.item.id; // e.g., MLA2828593406
      const qty = item.quantity;
      const price = item.unit_price;
      const title = item.item.title;

      // Find product in Supabase
      // Intento 1: Por ml_item_id
      const { data: byId } = await supabase
        .from("products")
        .select("id, name, stock, image")
        .eq("ml_item_id", mlItemId)
        .limit(1)
        .maybeSingle();

      let dbProduct = byId;

      // Intento 2: Por título aproximado (las primeras palabras)
      if (!dbProduct && title) {
         // Agarramos las 3 palabras iniciales
         const searchWords = title.split(' ').slice(0, 3).join('%');
         const { data: byName } = await supabase
            .from("products")
            .select("id, name, stock, image")
            .ilike("name", `%${searchWords}%`)
            .limit(1)
            .maybeSingle();
         if (byName) dbProduct = byName;
      }

      let productId = null;
      let productImage = "https://via.placeholder.com/150?text=ML";

      if (dbProduct) {
        productId = dbProduct.id;
        productImage = dbProduct.image;
      }

      orderItems.push({
        product_id: productId || 0, // 0 for unregistered ML products
        name: title,
        price: price,
        quantity: qty,
        image: productImage,
      });
    }

    // 2. Reflect sale in 'orders' table
    const orderNumber = `ML-${order.id}`;

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (!existingOrder) {
      // ---> DEDUCT STOCK ONLY ON INITIAL REGISTRATION <---
      for (const orderItem of orderItems) {
        if (orderItem.product_id && orderItem.product_id !== 0) {
           const { data: dbProduct } = await supabase.from("products").select("stock, name").eq("id", orderItem.product_id).single();
           if (dbProduct && dbProduct.stock !== null) {
              const newStock = Math.max(0, dbProduct.stock - orderItem.quantity);
              await supabase.from("products").update({ stock: newStock }).eq("id", orderItem.product_id);
              updatedStockLog.push(`Decreased ${dbProduct.name} stock to ${newStock}`);
           }
        }
      }
      
      // Deduct raw materials (consumables like wood, bags, filament)
      try {
        await deductRawMaterialsML(orderItems, supabase);
        console.log("[ML Webhook] Insumos descontados correctamente.");
      } catch (stockError) {
        console.error("[ML Webhook] Error descontando insumos:", stockError);
      }
      let initialNotes = `Venta automática desde MercadoLibre. ID: ${order.id}\n[PAGADO TOTAL: $${order.total_amount}]`;
      let initialStatus = "paid";
      
      // Fetch shipping info right away to get delivery estimates for the Calendar
      let mlFee = 0;
      let mlShipCost = 0;

      // Extract fees from payments
      if (order.payments && Array.isArray(order.payments)) {
        order.payments.forEach(p => {
           mlFee += (p.marketplace_fee || 0);
        });
      }

      if (order.shipping && order.shipping.id) {
         try {
           const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${order.shipping.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
           });
           if (shipRes.ok) {
             const shipData = await shipRes.json();
             
             // Extract seller shipping cost (if any)
             mlShipCost = shipData.sender_shipping_cost || 0;

             const mapStatus = {
                pending: "processing", handling: "preparing", ready_to_ship: "preparing",
                shipped: "shipped", delivered: "delivered", cancelled: "cancelled",
             };
             if (shipData.status && mapStatus[shipData.status]) {
                initialStatus = mapStatus[shipData.status];
             }
             
             if (shipData.shipping_option?.estimated_delivery_time?.date) {
               const estDate = new Date(shipData.shipping_option.estimated_delivery_time.date);
               const day = String(estDate.getDate()).padStart(2, "0");
               const month = String(estDate.getMonth() + 1).padStart(2, "0");
               const year = estDate.getFullYear();
               initialNotes += `\n[ENTREGA: ${day}/${month}/${year}]`;
             }
           }
         } catch(e) { console.error("[ML Webhook] Error fetching initial shipping:", e); }
      }

      const mlNet = (order.total_amount || 0) - mlFee - mlShipCost;
      initialNotes += `\n[NETO ML: $${Math.round(mlNet)}] [COSTOS ML: Comis -$${Math.round(mlFee)}, Envío -$${Math.round(mlShipCost)}]`;

      const newOrder = {
        order_number: orderNumber,
        customer_name:
          order.buyer.nickname || order.buyer.first_name || "Comprador ML",
        customer_email: "venta@mercadolibre.com",
        customer_phone: "ML",
        items: orderItems,
        subtotal: order.total_amount,
        shipping_cost: 0,
        total: order.total_amount,
        shipping_method: "correo",
        status: initialStatus,
        payment_id: order.payments?.[0]?.id?.toString() || "mercadopago",
        payment_status: "approved",
        ml_shipment_id: order.shipping?.id?.toString() || null,
        notes: initialNotes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: insertedOrder, error: insertError } = await supabase
        .from("orders")
        .insert(newOrder)
        .select()
        .single();
      if (insertError) {
        console.error("[ML Webhook] Failed to insert order:", insertError);
      } else {
        console.log(
          `[ML Webhook] Extracted Order ${orderNumber} successfully. Stock updates:`,
          updatedStockLog,
        );
        // Also add a payment record so it shows up in the timeline
        if (insertedOrder) {
          await supabase.from("payments").insert({
            order_id: insertedOrder.id,
            amount: Math.round(mlNet),
            method: "mercadopago",
            date: new Date().toISOString(),
            notes: `Pago automático ML (Neto Real)`,
          });
        }
      }
    } else {
      // El pedido ya existe -> Sincronizar estado de envío y fecha de entrega
      if (order.shipping && order.shipping.id) {
        try {
          const shipRes = await fetch(
            `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );

          if (shipRes.ok) {
            const shipData = await shipRes.json();
            const updatePayload = {};

            // Mapear estado interno de envío de ML al estado de la app
            const mapStatus = {
              pending: "processing",
              handling: "preparing",
              ready_to_ship: "preparing",
              shipped: "shipped",
              delivered: "delivered",
              cancelled: "cancelled",
            };

            if (shipData.status && mapStatus[shipData.status]) {
              updatePayload.status = mapStatus[shipData.status];
            }

            if (shipData.tracking_number) {
              updatePayload.tracking_number = shipData.tracking_number;
            }

            // Recuperar fecha prometida y formato de nota
            if (shipData.shipping_option?.estimated_delivery_time?.date) {
              const estDate = new Date(shipData.shipping_option.estimated_delivery_time.date);
              const day = String(estDate.getDate()).padStart(2, "0");
              const month = String(estDate.getMonth() + 1).padStart(2, "0");
              const year = estDate.getFullYear();
              const formatD = `[ENTREGA: ${day}/${month}/${year}]`;

              // Necesitamos la nota actual para no pisarla completa
              const { data: localOrder } = await supabase
                .from("orders")
                .select("notes")
                .eq("id", existingOrder.id)
                .single();
              let notes = localOrder?.notes || "";

              if (!notes.includes("ENTREGA:")) {
                updatePayload.notes = notes + `\n${formatD}`;
              } else {
                updatePayload.notes = notes.replace(/\[ENTREGA:.*?\]/, formatD);
              }
            }

            if (Object.keys(updatePayload).length > 0) {
              updatePayload.updated_at = new Date().toISOString();
              await supabase
                .from("orders")
                .update(updatePayload)
                .eq("id", existingOrder.id);
              console.log(
                `[ML Webhook] Updated Order ${orderNumber} shipping info:`,
                updatePayload,
              );
            }
          }
        } catch (e) {
          console.error("[ML Webhook] Error updating shipping details:", e);
        }
      }
    }

    // 3. Notify Make (Optional)
    if (MAKE_WEBHOOK_URL) {
      fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "ml_sale",
          order_id: order.id,
          total: order.total_amount,
        }),
      }).catch((e) => console.error("Make Error:", e));
    }

    return res.status(200).json({ success: true, logged: true });
  } catch (e) {
    console.error("Order Error:", e);
    return res.status(200).json({ error: e.message });
  }
}

// ------------------------------------------------------------------
// UTILS
// ------------------------------------------------------------------

async function deductRawMaterialsML(items, supabaseClient) {
  // 1. Get raw materials
  const { data: materials, error } = await supabaseClient
    .from('raw_materials')
    .select('id, name, quantity, unit, category');

  if (error || !materials) return;

  // 2. Get product definitions with consumables
  const productIds = items.filter(i => i.product_id && i.product_id !== 0).map(i => i.product_id);
  if (productIds.length === 0) return;

  const { data: productDefinitions } = await supabaseClient
    .from('products')
    .select('id, name, weight, net_weight, consumables, color_percentage') 
    .in('id', productIds);
  
  const productMap = new Map(productDefinitions?.map((p) => [p.id, p]) || []);
  const updates = new Map();

  const findMaterialIdByName = (searchName, categoryFilter) => {
    if (!searchName) return null;
    const lowerSearch = searchName.toLowerCase().trim();
    
    // 1. Exact match
    let mat = materials.find((m) => m.name.toLowerCase() === lowerSearch);
    if (mat) return mat;

    // 2. Fuzzy words
    const searchWords = lowerSearch.split(/\s+/).filter(w => w.length > 2);
    let candidates = materials.filter((m) => {
        if (categoryFilter && m.category !== categoryFilter) return false;
        const matName = m.name.toLowerCase();
        return searchWords.every(word => matName.includes(word));
    });

    if (candidates.length > 0) return candidates[0];

    // 3. Inverse support
    candidates = materials.filter((m) => {
        if (categoryFilter && m.category !== categoryFilter) return false;
        const matName = m.name.toLowerCase();
        return matName.includes(lowerSearch) || lowerSearch.includes(matName);
    });
    
    return candidates.length > 0 ? candidates[0] : null;
  };

  const addDeduction = (materialId, amount) => {
      const current = updates.get(materialId) || 0;
      updates.set(materialId, current + amount);
  };

  // 3. Analyze items
  for (const item of items) {
    if (!item.product_id) continue;
    const qty = item.quantity;
    const productDef = productMap.get(item.product_id);
    if (!productDef) continue;

    // Fixed Consumables
    if (productDef.consumables && Array.isArray(productDef.consumables)) {
        productDef.consumables.forEach((c) => {
            if (c.material && c.quantity) {
                const mat = findMaterialIdByName(c.material);
                if (mat) addDeduction(mat.id, c.quantity * qty);
            }
        });
    }

    // Filament (color Percentage)
    if (productDef.color_percentage && Array.isArray(productDef.color_percentage)) {
        productDef.color_percentage.forEach((cp) => {
            const originalColorName = cp.color;
            let targetMaterialName = originalColorName;
            
            // Si el item tuviese opciones seleccionadas (MercadoLibre raramente las manda exactas aquí, pero cubrimos)
            const isPredominant = (cp.percentage || 0) > 40 || (productDef.color_percentage.length === 1);
            if (isPredominant && item.selected_options?.color) {
                targetMaterialName = item.selected_options.color;
            }

            const mat = findMaterialIdByName(targetMaterialName, 'Filamento');
            if (mat) {
                let amountToDeduct = 0;
                if (cp.grams) {
                    amountToDeduct = cp.grams * qty;
                } else if (cp.percentage) {
                    const referenceWeight = productDef.net_weight || productDef.weight || 0;
                    if (referenceWeight > 0) {
                        amountToDeduct = (referenceWeight * qty) * (cp.percentage / 100);
                    }
                }

                if (amountToDeduct > 0) {
                    if (mat.unit && (mat.unit.toLowerCase().includes('kg') || mat.unit.toLowerCase().includes('kilo') || mat.unit.toLowerCase().includes('rollo'))) {
                        amountToDeduct = amountToDeduct / 1000;
                    }
                    addDeduction(mat.id, amountToDeduct);
                }
            }
        });
    }
  }

  // 4. Batch Updates
  if (updates.size > 0) {
    const promises = Array.from(updates.entries()).map(async ([id, totalDeduct]) => {
      const mat = materials.find((m) => m.id === id);
      if (mat) {
        const currentQty = Number(mat.quantity);
        const newQty = Math.max(0, currentQty - totalDeduct);
        const roundedNewQty = Math.round(newQty * 1000) / 1000;

        const { error: updateError } = await supabaseClient
          .from('raw_materials')
          .update({ quantity: roundedNewQty })
          .eq('id', id);
          
        if (updateError) console.error(`[Stock ML] Error updating ${mat.name}:`, updateError);
      }
    });
    await Promise.all(promises);
  }
}
