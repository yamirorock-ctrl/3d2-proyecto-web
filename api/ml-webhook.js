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

    // 2. Check Global Switch
    const enabled = await isBotEnabled();
    if (!enabled) {
      console.log("🛑 Bot is OFF by Admin. Skipping execution.");
      return res.status(200).json({ status: "skipped_by_admin" });
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
      .select("access_token")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Webhook] No ML Token found in DB.");
      return res.status(200).json({ error: "No token" });
    }

    const accessToken = tokenData.access_token;

    // 5. Route Logic
    if (topic === "questions") {
      return await handleQuestion(resource, accessToken, res);
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

async function handleQuestion(resource, accessToken, res) {
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
        ai_model: "gemini-3-flash-preview",
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

    if (!genAI) throw new Error("Gemini API Key missing");

    // 4. Fetch Contex (Parallel)
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
      model: "gemini-1.5-flash",
      systemInstruction: finalPrompt,
    }); // Use stable model
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
  // Simplified Order Logic
  try {
    const oRes = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!oRes.ok) throw new Error("Orders API Failed");
    const order = await oRes.json();

    // Stock Update Logic Here (Similar to before)
    console.log(
      `[ML Webhook] Order ${order.id} received. Total: ${order.total_amount}`,
    );

    // Notify Make (Optional)
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

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("Order Error:", e);
    return res.status(200).json({ error: e.message });
  }
}
