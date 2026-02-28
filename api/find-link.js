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

    // ✨ AI Summarization Logic (Para saber si pedir descripción)
    const optimizeFor =
      req.query.optimize_for || body.optimize_for || body.platform;

    // 🔍 ESTRATEGIA DE BÚSQUEDA HÍBRIDA + GENERACIÓN ATÓMICA
    let aiDescription = null;
    let aiTitle = null;

    if (genAI) {
      try {
        console.log("Iniciando búsqueda IA (Single Shot)...");
        // AHORA DEVUELVE UN OBJETO con { product_name, pinterest_title, pinterest_description }
        // Timeout de 8 segundos para evitar que Vercel cancele la función (límite 10s)
        const aiResult = await Promise.race([
          findProductWithAI(queryText, products, genAI, imageUrl, optimizeFor),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Gemini AI Timeout (8s)")), 8000),
          ),
        ]);

        const matchName = aiResult.product_name;
        aiDescription = aiResult.pinterest_description; // Guardamos la descripción
        aiTitle = aiResult.pinterest_title; // Guardamos el título SEO

        console.log("IA Match Name:", matchName);

        if (matchName && matchName !== "null") {
          // Buscamos exacto o muy parecido
          bestMatch = products.find((p) => p.name === matchName);

          // Si la IA alucinó un poco el nombre, intentamos buscarlo "fuzzy" dentro de los noms reales
          if (!bestMatch) {
            bestMatch = products.find(
              (p) => p.name.includes(matchName) || matchName.includes(p.name),
            );
          }

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
        // Fallback continúa...
      }
    }

    // 3. Fallback: Si la IA no encontró nada (o falló), buscamos por texto
    if (!bestMatch) {
      console.log("🕵️ Ejecutando Búsqueda Manual Fuzzy...");
      bestMatch = performManualFuzzySearch(normalizedText, products);
      if (bestMatch) {
        maxScore = 50;
        console.log("✅ Match por Búsqueda Manual:", bestMatch.name);
        // OJO: Si falló la IA, no tenemos descripción generada. Podríamos intentar regenerarla aqui,
        // pero para evitar timeouts, dejamos que Make use la default o el usuario edite.
      }
    }

    if (bestMatch && maxScore > 0) {
      // Construir URL
      const productUrl = `https://www.creart3d2.com/product/${bestMatch.id}`;

      const responseJson = {
        found: true,
        product: bestMatch.name,
        url: productUrl,
        product_image_url: bestMatch.image_url || null, // 📸 Foto oficial para Pinterest
        match_type: maxScore >= 100 ? "exact_name_in_text" : "keyword_match",
        score: maxScore,
      };

      // Si la IA ya generó la descripción en el "Single Shot", la usamos
      if (aiDescription && aiDescription !== "null") {
        responseJson.pinterest_description = aiDescription;
      }

      // Si la IA generó un título SEO, lo usamos
      if (aiTitle && aiTitle !== "null") {
        responseJson.pinterest_title = aiTitle;
      }

      return res.status(200).json(responseJson);
    }

    // Fallback: Si no encuentro match exacto, devuelvo la home
    return res.status(200).json({
      found: false,
      url: "https://www.creart3d2.com/",
      product_image_url: "https://www.creart3d2.com/LOGO.jpg", // Logo por defecto
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
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    return {
      inlineData: {
        data: Buffer.from(buffer).toString("base64"),
        mimeType: response.headers.get("content-type") || "image/jpeg",
      },
    };
  } catch (error) {
    console.error("Error loading image:", error);
    return null;
  }
}

async function findProductWithAI(
  queryText,
  products,
  genAI,
  imageUrl,
  optimizeFor,
) {
  // ⚡🚀 USAMOS GEMINI 3 FLASH PREVIEW - SINGLE SHOT MODE
  // ESTRATEGIA "PAPELITO": Pedimos el NOMBRE EXACTO, no el ID.
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: { responseMimeType: "application/json" },
  });

  // Solo enviamos nombres para que la IA no se confunda con IDs raros.
  const productsList = products.map((p) => p.name).join("\n");

  let parts = [];

  const generateDescription = optimizeFor === "pinterest";

  const prompt = `
    Actúa como un experto en inventario y SEO para Pinterest.
    
    CATÁLOGO DE PRODUCTOS (Nombres Exactos):
    ${productsList}
    
    ENTRADA:
    Texto: "${queryText.slice(0, 5000)}"
    Imagen: ${imageUrl ? "SÍ" : "NO"}
    
    TU MISIÓN:
    1. Mira la entrada.
    2. Busca en el CATÁLOGO el nombre que MEJOR describa esa entrada.
    3. IMPORTANTE: El nombre debe ser IDÉNTICO, letra por letra, al de la lista.
    4. Si no estás seguro o no hay coincidencia, devuelve null.
    
    ${
      generateDescription
        ? `
    TU SEGUNDA MISIÓN (SEO & Copywriting):
    - Si encontraste el producto, genera dos textos optimizados para Pinterest:
      A. TÍTULO SEO (pinterest_title): Máximo 100 caracteres. Atractivo, incluye keywords como "Regalo", "Decoración", "3D", "Original". Ej: "Escudo River Plate 3D - El Regalo Perfecto para Fanáticos".
      B. DESCRIPCIÓN (pinterest_description): Máximo 750 caracteres. Tono inspirador. Incluye 5-7 HASHTAGS de nicho al final.
    `
        : ""
    }

    RESPUESTA JSON OBLIGATORIA:
    { 
      "product_name": "NOMBRE_EXACTO_DE_LA_LISTA_O_NULL",
      "pinterest_title": "${generateDescription ? "TEXTO_TITULO_SEO_O_NULL" : "null"}",
      "pinterest_description": "${generateDescription ? "TEXTO_DESCRIPCION_O_NULL" : "null"}"
    }
  `;

  parts.push(prompt);

  if (imageUrl) {
    const imagePart = await urlToGenerativePart(imageUrl);
    if (imagePart) parts.push(imagePart);
  }

  const result = await model.generateContent(parts);
  const response = await result.response;
  const text = response.text().trim();
  console.log("AI Raw JSON Response:", text);

  try {
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Error parsing AI JSON:", e);
    return {
      product_name: null,
      pinterest_title: null,
      pinterest_description: null,
    };
  }
}

function performManualFuzzySearch(normalizedText, products) {
  let bestMatch = null;
  let maxScore = 0;

  // Palabras comunes que NO suman puntos (Stopwords en español)
  const stopWords = [
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "de",
    "del",
    "y",
    "o",
    "que",
    "en",
    "tu",
    "mi",
    "para",
    "por",
    "con",
    "sin",
    "es",
  ];

  // Tokenizar y filtrar stopwords
  const searchTokens = normalizedText
    .split(/[\s\W]+/) // Split por cualquier cosa que no sea letra/número
    .filter((t) => t.length > 2 && !stopWords.includes(t));

  for (const product of products) {
    if (!product.name) continue; // Proteger contra nombres null en BD
    const normalizedName = product.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    let score = 0;

    searchTokens.forEach((token) => {
      // Coincidencia exacta de token suma 2 puntos
      if (normalizedName.includes(token)) {
        score += 2;
        // Bonificación por palabras clave fuertes en tu nicho
        if (["mate", "set", "3d", "lampara", "llavero"].includes(token))
          score += 3;
      }
    });

    // Bonificación extra si el nombre del producto está entero en el texto (frase exacta)
    if (normalizedText.includes(normalizedName)) score += 20;

    if (score > maxScore) {
      maxScore = score;
      bestMatch = product;
    }
  }

  // Umbral mínimo para evitar falsos positivos ridículos
  return maxScore >= 4 ? bestMatch : null;
}
