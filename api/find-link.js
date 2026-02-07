import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializar cliente Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;
const GEMINI_API_KEY =
  process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export default async function handler(req, res) {
  // CORS para permitir llamadas desde Make (o cualquier lado)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Safe body access in case it's GET or oddly parsed
  const body = req.body || {};

  try {
    const queryText = req.query.q || req.body.text || "";

    // Si no hay texto, devolvemos la home
    if (!queryText || !supabase) {
      return res.status(200).json({
        found: false,
        url: "https://www.creart3d2.com/",
        reason: "no_text_or_config",
      });
    }

    // Normalizar texto de entrada (minúsculas, sin acentos)
    const normalizedText = queryText
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Obtener catálogo (solo ID y Name para ser rápidos)
    // Traemos todo el catálogo porque suele ser pequeño (<1000 items).
    // Si crece mucho, habría que usar Search en DB.
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name");

    if (error || !products) {
      console.error("Error fetching products:", error);
      return res.status(200).json({
        found: false,
        url: "https://www.creart3d2.com/",
        reason: "db_error",
      });
    }

    // Búsqueda "Fuzzy" Inversa:
    // Buscamos cuál NOMBRE de producto está contenido en el CAPTION.
    // Priorizamos el nombre más largo para evitar falsos positivos (ej: "Mate" vs "Mate Harry Potter")

    let bestMatch = null;
    let maxScore = 0;

    const searchTokens = normalizedText
      .split(/\s+/)
      .filter((t) => t.length > 2); // Ignorar palabras de < 3 letras

    for (const product of products) {
      const normalizedName = product.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      let score = 0;
      // Por cada palabra clave buscada, sumamos puntos si aparece en el nombre del producto
      searchTokens.forEach((token) => {
        if (normalizedName.includes(token)) score++;
      });

      // Si el nombre del producto está LITERALMENTE en el texto (caption largo), le damos score infinito
      if (normalizedText.includes(normalizedName)) score += 100;

      if (score > maxScore) {
        maxScore = score;
        bestMatch = product;
      }
    }

    if (bestMatch && maxScore > 0) {
      // Construir URL
      const productUrl = `https://www.creart3d2.com/product/${bestMatch.id}`;

      const responseJson = {
        found: true,
        product: bestMatch.name,
        url: productUrl,
        match_type: maxScore >= 100 ? "exact_name_in_text" : "keyword_match",
        score: maxScore,
      };

      // ✨ AI Summarization Logic
      const optimizeFor =
        req.query.optimize_for || body.optimize_for || body.platform;

      if (optimizeFor === "pinterest" && genAI) {
        responseJson.pinterest_description = await generatePinterestDescription(
          bestMatch.name,
          queryText,
          genAI,
        );
      }

      return res.status(200).json(responseJson);
    }

    // Fallback: Si no encuentro match exacto, devuelvo la home
    return res.status(200).json({
      found: false,
      url: "https://www.creart3d2.com/",
      reason: "no_match_found",
    });
  } catch (e) {
    console.error("API Error:", e);
    return res.status(500).json({ error: e.message });
  }
}

async function generatePinterestDescription(productName, originalText, genAI) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Actúa como un experto en Marketing Digital y SEO para Pinterest.
      
      TAREA:
      Resumir y optimizar el siguiente texto (que viene de Instagram) para que sirva como descripción de un PIN de Pinterest.
      
      REGLAS:
      1. El producto principal es: "${productName}". Asegúrate de mencionarlo.
      2. MÁXIMO 450 CARACTERES (Pinterest corta a los 500).
      3. Mantén un tono inspirador y atractivo.
      4. Incluye 3-5 hashtags relevantes al final.
      5. Elimina menciones a "Link en bio" o llamadas a la acción que no sirvan en Pinterest.
      
      TEXTO ORIGINAL:
      "${originalText.slice(0, 2000)}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return originalText.slice(0, 450) + "..."; // Fallback simple
  }
}
