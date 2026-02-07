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

    // 🧠 AI Semantic Search Logic (Opción B: Inteligente)
    // En lugar de contar palabras, le damos el contexto a Gemini para que elija.

    let bestMatch = null;
    let maxScore = 0; // Mantenemos variable para compatibilidad

    // Extract Image URL if available (Multimodal "Eyes")
    const imageUrl = req.query.image_url || body.image_url || null;

    // 🔍 ESTRATEGIA DE BÚSQUEDA HÍBRIDA
    // 1. Intentamos con IA (Visual + Semántica)
    // 2. Si la IA falla o no está segura, usamos Búsqueda Clásica (Palabras clave)

    if (genAI) {
      try {
        console.log("Iniciando búsqueda IA...");
        const matchId = await findProductWithAI(
          queryText,
          products,
          genAI,
          imageUrl,
        );

        console.log("IA Match ID:", matchId);

        if (matchId && matchId !== "null") {
          bestMatch = products.find((p) => p.id === matchId);
          if (bestMatch) {
            maxScore = 100;
            console.log("✅ Match confirmado por IA:", bestMatch.name);
          }
        } else {
          console.log(
            "⚠️ La IA no encontró coincidencia (retornó null). Pasando a búsqueda manual...",
          );
        }
      } catch (aiError) {
        console.error("❌ Error CRÍTICO en IA:", aiError);
        // No devolvemos error al cliente todavía, dejamos que el fallback intente salvar el día.
      }
    }

    // 3. Fallback: Si la IA no encontró nada (o falló), buscamos por texto
    if (!bestMatch) {
      console.log("🕵️ Ejecutando Búsqueda Manual Fuzzy...");
      bestMatch = performManualFuzzySearch(normalizedText, products);
      if (bestMatch) {
        maxScore = 50;
        console.log("✅ Match por Búsqueda Manual:", bestMatch.name);
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
          imageUrl,
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

// Helper para convertir URL de imagen a Part de Gemini
async function urlToGenerativePart(url) {
  try {
    console.log("Fetching image from URL:", url);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
      );
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    console.log("Image fetched successfully. Size:", buffer.byteLength);
    return {
      inlineData: {
        data: Buffer.from(buffer).toString("base64"),
        mimeType: response.headers.get("content-type") || "image/jpeg",
      },
    };
  } catch (error) {
    console.error("Error loading image for AI:", error);
    return null;
  }
}

async function findProductWithAI(queryText, products, genAI, imageUrl) {
  // ⚡🚀 UPGRADE: Usamos el modelo más avanzado disponible (Gemini 3)
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const productsList = products
    .map((p) => `- ${p.name} (ID: ${p.id})`)
    .join("\n");

  let parts = [];

  const prompt = `
    Actúa como un experto gestor de inventario de e-commerce.
    
    OBJETIVO:
    Identificar qué producto de la lista está siendo descrito y mostrado.
    
    TEXTO DE ENTRADA (Caption):
    "${queryText.slice(0, 5000)}"
    
    LISTA DE PRODUCTOS DISPONIBLES (${products.length} productos):
    ${productsList}
    
    INSTRUCCIONES:
    1. Analiza el texto ${imageUrl ? "Y LA IMAGEN provista" : ""} para entender qué producto es.
    2. Si la imagen muestra a "Cerati" y el texto dice "Gracias Totales", el producto ES "Cuadro 3D Decorativo Gustavo Cerati".
    3. Si la imagen muestra un soporte de joystick, busca "Soporte".
    4. SE FLEXIBLE PERO PRECISO: Si hay una coincidencia clara (ej: "Cerati" en texto y producto), ELÍGELA.
    5. Si no coincide nada, devuelve "null".
    
    RESPUESTA:
    Devuelve SOLAMENTE el ID del producto (UUID). Nada más.
  `;

  parts.push(prompt);

  if (imageUrl) {
    const imagePart = await urlToGenerativePart(imageUrl);
    if (imagePart) parts.push(imagePart);
    else console.warn("Skipping image part due to fetch error.");
  }

  const result = await model.generateContent(parts);
  const response = await result.response;
  const text = response.text().trim();
  console.log("AI Raw Response:", text);
  return text;
}

function performManualFuzzySearch(normalizedText, products) {
  let bestMatch = null;
  let maxScore = 0;

  const searchTokens = normalizedText.split(/\s+/).filter((t) => t.length > 2);

  for (const product of products) {
    const normalizedName = product.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    let score = 0;
    searchTokens.forEach((token) => {
      if (normalizedName.includes(token)) score++;
    });

    if (normalizedText.includes(normalizedName)) score += 100;

    if (score > maxScore) {
      maxScore = score;
      bestMatch = product;
    }
  }
  return maxScore > 0 ? bestMatch : null;
}

async function generatePinterestDescription(
  productName,
  originalText,
  imageUrl,
  genAI,
) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    let parts = [];

    const prompt = `
      Actúa como un experto en Marketing Digital y SEO para Pinterest.
      
      TAREA:
      Crear descripción para un PIN de Pinterest del producto: "${productName}".
      
      REGLAS CRÍTICAS:
      1. MÁXIMO 350 caracteres TOTALES (incluyendo hashtags). SE MUY CONCISO.
      2. Si te pasas de largo, Pinterest rechazará el pin. Resume al máximo.
      3. Tono inspirador pero directo.
      4. Genera 5-7 HASHTAGS DE ALTO VALOR AL FINAL.
         - IDENTIFICA EL FANDOM/MARCA/CLUB con precisión (ej: #Cerati #SodaStereo).
         - Busca hashtags de nicho populares.
         - Si ves Harry Potter, usa #HarryPotter #Hogwarts #Potterhead.
         - Si ves Boca, usa #BocaJuniors #LaDoce #CABJ.
         - Busca los hashtags más populares de ese nicho específico.
      
      TEXTO ORIGINAL:
      "${originalText.slice(0, 1000)}"
    `;

    parts.push(prompt);

    if (imageUrl) {
      const imagePart = await urlToGenerativePart(imageUrl);
      if (imagePart) parts.push(imagePart);
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return originalText.slice(0, 450) + "..."; // Fallback simple
  }
}
