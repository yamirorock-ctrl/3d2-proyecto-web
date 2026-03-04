import { GoogleGenerativeAI } from "@google/generative-ai";

// CONFIGURACIÓN MANUAL (Edita esto con tu API KEY)
// ===============================================
const API_KEY = process.env.VITE_GEMINI_API_KEY; // LEER DE VARIABLE DE ENTORNO

// SI NO EXISTE LA VARIABLE, REVISA .env O EJECUTA CON:
// Node 20+: node --env-file=.env scripts/test-ai-manual.js
// O SETEANDOLA ANTES: set VITE_GEMINI_API_KEY=tu_key && node scripts/test-ai-manual.js
// NUNCA SUBAS TU API KEY DIRECTAMENTE AL CÓDIGO
// ===============================================

const TEST_CAPTION = "¡Gracias Totales! Un Homenaje Eterno";
const TEST_IMAGE_URL =
  "https://placehold.co/600x400/222222/FFF.png?text=Cerati+Cuadro"; // Placeholder público y seguro
// ===============================================

const genAI = new GoogleGenerativeAI(API_KEY);

async function runTest() {
  console.log(
    "🤖 Iniciando SIMULACIÓN DE IA (Gemini 2.5 Flash - Printy Config)...",
  );

  if (!API_KEY || API_KEY.includes("PEGAR_TU_API_KEY")) {
    console.error("❌ ERROR: Falta la API Key.");
    console.error(
      "👉 Abre 'scripts/test-ai-manual.js' y pega tu API Key donde dice PEGAR_TU_API_KEY_AQUI",
    );
    return;
  }

  // CONFIGURACIÓN EXACTA DE PRINTY (Services/geminiService.ts) !!!
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    // generationConfig: { responseMimeType: "application/json" }, // Printy NO usa esto en su config, lo quitamos.
  });

  // Lista SIMULADA (como si viniera de Supabase)
  const productsList = [
    "- Soporte Auriculares Joystick Sub-Zero Mortal Kombat (ID: 111)",
    '- Cuadro 3D Decorativo Gustavo Cerati "Gracias Totales" (ID: 222)',
    "- Mate de Boca Juniors (ID: 333)",
  ].join("\n");

  console.log("📋 Lista de Productos Simulada:\n", productsList);

  const prompt = `
    Actúa como un sistema de inventario y marketing inteligente.
    
    OBJETIVO:
    1. Identificar qué producto de la lista corresponde a la imagen y texto provistos.
    2. Generar una descripción optimizada para Pinterest si se encuentra el producto.
    
    LISTA DE PRODUCTOS:
    ${productsList}
    
    ENTRADA:
    Texto: "${TEST_CAPTION}"
    Imagen: ${TEST_IMAGE_URL ? "SÍ" : "NO"}
    
    INSTRUCCIONES DE MATCHING:
    - Analiza coincidencias visuales y semánticas.
    - Ejemplo: "Cerati" -> "Cuadro Cerati".
    - Si no estás seguro, product_id es null.
    
    INSTRUCCIONES DE DESCRIPCIÓN (Solo si hay match):
    - MÁXIMO 750 caracteres.
    - Tono inspirador.
    - Incluye 5-7 HASHTAGS de alto valor al final (ej: #SodaStereo #Cerati).

    FORMATO DE RESPUESTA JSON (ESTRICTO):
    Debes responder ÚNICAMENTE con un objeto JSON válido, sin markdown ni explicaciones adicionales.
    { 
      "product_id": "UUID_O_NULL",
      "pinterest_description": "TEXTO_GENERADO_O_NULL"
    }
  `;

  console.log("\n🖼️ Fetching imagen:", TEST_IMAGE_URL);

  try {
    const imgResp = await fetch(TEST_IMAGE_URL);
    console.log("📸 Image Status:", imgResp.status, imgResp.statusText);
    if (!imgResp.ok) throw new Error("Failed to fetch image");
    const imgBuff = await imgResp.arrayBuffer();
    const imagePart = {
      inlineData: {
        data: Buffer.from(imgBuff).toString("base64"),
        mimeType: "image/jpeg", // Forzamos JPEG porque la API de Pinterest a veces devuelve headers raros
      },
    };

    console.log("✅ Imagen descargada correctamente.");

    console.log("🧠 Enviando a Gemini (Single Shot)...");
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text().trim();

    console.log("\n✨ RESPUESTA DE LA IA (RAW):");
    console.log("-----------------------");
    console.log(text);
    console.log("-----------------------");

    try {
      // Limpieza agresiva de Markdown para asegurar JSON válido
      const cleanText = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const json = JSON.parse(cleanText);

      if (json.product_id === "222") {
        console.log("🎉 ÉXITO TOTAL: Identificó el Cuadro de Cerati (ID 222).");
        console.log("📝 Descripción Generada:\n", json.pinterest_description);
      } else if (json.product_id === "111") {
        console.log("💀 FALLO: Confundió con Sub-Zero (ID 111).");
      } else {
        console.log("⚠️ INDEFINIDO: ID retornado:", json.product_id);
      }
    } catch (e) {
      console.error("❌ ERROR PARSEANDO JSON:", e);
    }
  } catch (e) {
    console.error("\n❌ ERROR EXCEPCIÓN DETALLADO:");
    console.error("Message:", e.message);
    if (e.status) console.error("Status:", e.status);
    if (e.statusText) console.error("StatusText:", e.statusText);
    if (e.errorDetails)
      console.error("Details:", JSON.stringify(e.errorDetails, null, 2));
  }
}

runTest();
