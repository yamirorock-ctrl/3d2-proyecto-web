/* eslint-disable */
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;
const GEMINI_API_KEY =
  process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// Initialize clients
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Config
const MAKE_WEBHOOK_URL =
  "https://hook.us2.make.com/3du519txd4fyw541s7gtcfnto432gmeg";

// Bot Personality
const SYSTEM_PROMPT = `
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
2. NOMBRE: Si te presentas, eres Printy.
3. SI HAY STOCK (>0): "¡Hola! 👋 Sí, tenemos stock disponible. ¡Esperamos tu compra para enviártelo cuanto antes! 🚀"
4. SI NO HAY STOCK (=0): "¡Hola! En este momento se nos agotó para entrega inmediata. Consultanos pronto. 💜"
5. PERSONALIZADOS: "¡Sí! Somos fabricantes y hacemos trabajos a medida en 3D2. 🎨"
6. ENVÍOS: "Hacemos envíos a todo el país con MercadoEnvíos. Podés calcular el costo exacto arriba del botón de comprar. 🚚"
7. UBICACIÓN: Si preguntan, estamos en [TU ZONA/BARRIO AQUI], pero no des calle ni número.
8. IMPORTANTE: Sé CONCISO (máximo 2-3 líneas) pero CÁLIDO. Jamás respondas en minúsculas secas.

CONTEXTO ACTUAL:
Producto: {TITLE}
Precio: {CURRENCY} {PRICE}
Stock Real (Sistema): {STOCK}
Descripción: {DESCRIPTION}
Atributos (Ficha Técnica): {ATTRIBUTES}
`;

export default async function handler(req, res) {
  // Debug Connection
  if (!supabase) {
    console.warn(
      `[ML Webhook] Supabase NOT Configured! URL: ${!!SUPABASE_URL}, key: ${!!SUPABASE_ANON_KEY}`,
    );
    return res
      .status(200)
      .json({ error: "Supabase connection failed (Missing Envs)" });
  }

  try {
    const topic = req.query?.topic || req.body?.topic;
    const resource = req.query?.resource || req.body?.resource;

    if (req.method === "GET") return res.status(200).send("OK");

    console.log(`[ML Webhook] Received: ${topic} -> ${resource}`);

    if (!supabase) throw new Error("Supabase not configured");

    // Filter Topics
    if (!["orders_v2", "orders", "questions"].includes(topic)) {
      return res.status(200).json({ ignored: true, topic });
    }

    // Get Token
    const { data: tokenData, error: tokenError } = await supabase
      .from("ml_tokens")
      .select("access_token")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Webhook] No ML Token found.");
      return res.status(200).json({ error: "No token" });
    }

    const accessToken = tokenData.access_token;

    // Route Logic
    if (topic === "questions") {
      return await handleQuestion(resource, accessToken, res);
    } else {
      return await handleOrder(resource, accessToken, res);
    }
  } catch (e) {
    console.error("[ML Webhook] Error:", e);
    return res.status(500).json({ error: e.message });
  }
}

// ------------------------------------------------------------------
// HANDLERS
// ------------------------------------------------------------------

async function handleQuestion(resource, accessToken, res) {
  // 0. Parse Question info safely
  let questionText = "Unknown";
  let questionId = "Unknown";
  let itemId = "Unknown";

  try {
    // 1. Fetch Question
    const qRes = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!qRes.ok) throw new Error("Failed to fetch question from ML");
    const question = await qRes.json();

    questionText = question.text;
    questionId = question.id;
    itemId = question.item_id;

    // 2. Audit Log: Start (Insert Pending)
    await supabase.from("ml_questions").insert({
      item_id: itemId,
      question_text: questionText,
      status: "pending",
      ai_model: "gemini-3-flash-preview",
    });

    if (question.status !== "UNANSWERED") {
      // Log that it was skipped
      await supabase
        .from("ml_questions")
        .update({
          status: "ignored",
          answer_text: `Omitida por estado: ${question.status} (ML dice que no está pendiente)`,
        })
        .eq("question_text", questionText)
        .eq("status", "pending");

      return res.status(200).json({ status: "Already answered" });
    }

    if (!genAI) {
      console.warn("[ML Webhook] Gemini Not Configured.");
      await supabase
        .from("ml_questions")
        .update({ status: "error", answer_text: "Gemini API Key missing" })
        .eq("question_text", questionText); // Fallback match
      return res.status(200).json({ error: "No AI" });
    }

    // 3. Parallel Fetch: Item Details, Description & Local Stock (Optimization)
    const [item, descriptionData, dbResult] = await Promise.all([
      fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()),

      fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : { plain_text: "" })), // Manejo de error si no tiene descripcion

      supabase
        .from("products")
        .select("stock, name")
        .eq("ml_item_id", itemId)
        .limit(1)
        .single(),
    ]);

    // 4. Extract Attributes & Description
    const attributesText = item.attributes
      ? item.attributes.map((a) => `${a.name}: ${a.value_name}`).join(", ")
      : "Sin especificaciones";

    const descriptionText = descriptionData.plain_text || "Sin descripción";
    const realStock = dbResult.data?.stock ?? item.available_quantity;

    // 5. Generate Answer with Gemini
    const finalPrompt = SYSTEM_PROMPT.replace("{TITLE}", item.title)
      .replace("{PRICE}", item.price)
      .replace("{CURRENCY}", item.currency_id)
      .replace("{STOCK}", realStock)
      .replace("{DESCRIPTION}", descriptionText.slice(0, 1000)) // Limitamos largo para no exceder tokens
      .replace("{ATTRIBUTES}", attributesText);

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: finalPrompt,
    });

    console.log(`[ML Webhook] Asking Gemini about: "${questionText}"`);

    const result = await model.generateContent(
      `Pregunta del usuario: "${questionText}"`,
    );
    const answerText = result.response.text().trim();

    if (!answerText) throw new Error("Empty AI response");

    console.log(`[ML Webhook] Answer generated: "${answerText}"`);

    // 6. Post Answer to ML
    const ansRes = await fetch(`https://api.mercadolibre.com/answers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questionId,
        text: answerText,
      }),
    });

    if (!ansRes.ok) {
      const errBody = await ansRes.text();
      throw new Error(`ML API Error: ${errBody}`);
    }

    // 7. Audit Log: Success (Update Answer)
    // Usamos item_id + question_text como llave aproximada para actualizar el último registro pendiente
    // O mejor, insertamos uno nuevo si no queremos complicarnos con IDs, pero update es más limpio.
    // Como no tenemos el ID de supabase retornado en insert (por limitación de cliente simple a veces), hacemos update where status=pending and question_text=...
    await supabase
      .from("ml_questions")
      .update({
        status: "answered",
        answer_text: answerText,
        created_at: new Date().toISOString(), // Update timestamp
      })
      .eq("question_text", questionText)
      .eq("status", "pending");

    return res.status(200).json({ success: true, answer: answerText });
  } catch (error) {
    console.error("[ML Webhook] Error processing question:", error);

    // Audit Log: Error
    if (questionText !== "Unknown") {
      await supabase
        .from("ml_questions")
        .update({ status: "error", answer_text: error.message })
        .eq("question_text", questionText)
        .eq("status", "pending");
    }

    return res.status(200).json({ error: error.message });
  }
}

async function handleOrder(resource, accessToken, res) {
  // 1. Fetch Order
  const oRes = await fetch(`https://api.mercadolibre.com${resource}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!oRes.ok) throw new Error("Failed to fetch order"); // Retry allowed
  const order = await oRes.json();

  const orderId = order.id;
  const totalAmount = order.total_amount;
  const buyerName =
    (order.buyer?.first_name || "") + " " + (order.buyer?.last_name || "");

  // 2. Process Items
  const orderItems = order.order_items || [];
  let itemsProcessed = [];

  for (const item of orderItems) {
    const mlItemId = item.item.id;
    const quantity = item.quantity;
    const title = item.item.title;

    // Decrement Local Stock
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("ml_item_id", mlItemId);

    const product = products?.[0];

    if (product) {
      const newStock = Math.max(0, (product.stock || 0) - quantity);
      await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", product.id);

      itemsProcessed.push(`${quantity}x ${product.name}`);
      console.log(
        `[ML Webhook] Stock updated for ${product.name}: ${newStock}`,
      );
    } else {
      itemsProcessed.push(`${quantity}x ${title} (No vinculado)`);
      console.log(`[ML Webhook] Product not linked: ${mlItemId}`);
    }
  }

  // 3. Notify Make / WhatsApp
  const message = `💰 *¡Nueva Venta ML!*
🆔 Orden: ${orderId}
👤 Comprador: ${buyerName}
💵 Total: $${totalAmount}
📦 *Productos:*
${itemsProcessed.join("\n")}
_Stock actualizado automáticamente_ ✅`;

  await sendToMake({
    event: "ml_sale",
    order_id: orderId,
    customer_name: buyerName,
    total: totalAmount,
    items: itemsProcessed.join(", "),
    detailed_message: message,
    timestamp: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, order: orderId });
}

async function sendToMake(payload) {
  if (!MAKE_WEBHOOK_URL) return;
  try {
    await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(`[ML Webhook] Sent ${payload.event} to Make.`);
  } catch (e) {
    console.error("[ML Webhook] Failed to send to Make:", e);
  }
}
