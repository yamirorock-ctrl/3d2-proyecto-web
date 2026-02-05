import { createClient } from "@supabase/supabase-js";

// Inicializar cliente Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export default async function handler(req, res) {
  // CORS para permitir llamadas desde Make (o cualquier lado)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
      return res.status(200).json({
        found: true,
        product: bestMatch.name,
        url: productUrl,
        match_type: maxScore >= 100 ? "exact_name_in_text" : "keyword_match",
        score: maxScore,
      });
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
