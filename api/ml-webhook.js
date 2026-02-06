/* eslint-disable */
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;
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
Tu objetivo es responder preguntas de compradores en MercadoLibre con energía y amabilidad.

TUS REGLAS DE ORO:
1. PERSONALIDAD: ¡Sé alegre y servicial! Usa emojis (🚀, ✨, 💜, 🤖) pero sin abusar.
2. NOMBRE: Si te presentas, eres Printy.
3. SI HAY STOCK (>0): "¡Hola! 👋 Sí, tenemos stock disponible. ¡Esperamos tu compra para enviártelo cuanto antes! 🚀"
4. SI NO HAY STOCK (=0): "¡Hola! En este momento se nos agotó para entrega inmediata. Consultanos pronto. 💜"
5. PERSONALIZADOS: "¡Sí! Somos fabricantes y hacemos trabajos a medida en 3D2. 🎨"
6. ENVÍOS: "Hacemos envíos a todo el país. Podés calcular el costo exacto arriba del botón de comprar. 🚚"
7. IMPORTANTE: Sé CONCISO (máximo 2-3 líneas) pero CÁLIDO. Jamás respondas en minúsculas secas.

CONTEXTO ACTUAL:
Producto: {TITLE}
Precio: {CURRENCY} {PRICE}
Stock Real (Sistema): {STOCK}
`;

export default async function handler(req, res) {
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
  if (!genAI) {
    console.warn("[ML Webhook] Gemini Not Configured. Skipping Question.");
    return res.status(200).json({ error: "No AI" });
  }

  try {
    // 1. Fetch Question
    const qRes = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!qRes.ok) throw new Error("Failed to fetch question");
    const question = await qRes.json();

    if (question.status !== "UNANSWERED") {
      return res.status(200).json({ status: "Already answered" });
    }

    // 2. Parallel Fetch: Item Details & Local Stock (Optimization)
    const [item, dbResult] = await Promise.all([
      fetch(`https://api.mercadolibre.com/items/${question.item_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()),

      supabase
        .from("products")
        .select("stock, name")
        .eq("ml_item_id", question.item_id)
        .limit(1)
        .single(),
    ]);

    // 3. Determine Real Stock
    const realStock = dbResult.data?.stock ?? item.available_quantity;

    // 4. Generate Answer with Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: SYSTEM_PROMPT.replace("{TITLE}", item.title)
        .replace("{PRICE}", item.price)
        .replace("{CURRENCY}", item.currency_id)
        .replace("{STOCK}", realStock),
    });

    console.log(
      `[ML Webhook] Asking Gemini about: "${question.text}" (Stock: ${realStock})`,
    );

    const result = await model.generateContent(
      `Pregunta del usuario: "${question.text}"`,
    );
    const answerText = result.response.text().trim();

    if (!answerText) throw new Error("Empty AI response");

    console.log(`[ML Webhook] Answer generated: "${answerText}"`);

    // 5. Post Answer to ML
    const ansRes = await fetch(`https://api.mercadolibre.com/answers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: question.id,
        text: answerText,
      }),
    });

    if (!ansRes.ok) {
      const errBody = await ansRes.text();
      console.error(`[ML Webhook] Failed to post answer: ${errBody}`);
      throw new Error("ML API Error on Answer");
    }

    // 6. Notify Make (Log)
    await sendToMake({
      event: "ml_question_answered",
      question: question.text,
      answer: answerText,
      item: item.title,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, answer: answerText });
  } catch (aiError) {
    console.error("[ML Webhook] AI/Answer Error:", aiError);
    // Don't fail the webhook, just return error json to stop loop
    return res.status(200).json({ error: aiError.message });
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
