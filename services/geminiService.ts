import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
let genAI: GoogleGenerativeAI | null = null;

if (apiKey && apiKey !== 'TU_API_KEY_AQUI') {
  genAI = new GoogleGenerativeAI(apiKey);
  console.log("[Gemini] API Key detectada y servicio inicializado.");
} else {
  console.warn("[Gemini] No se detectó VITE_GEMINI_API_KEY en las variables de entorno.");
}

export const createChatSession = (products: Product[]) => {
  if (!genAI) return null;

  const productContext = products.map(p => {
    // Intentamos obtener la imagen de forma robusta.
    // Si 'images' contiene objetos {url: string}, debemos acceder a .url.
    // Si 'image' es un string directo, lo usamos.
    const img = p.image || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0].url : '') || '';
    // INSTRUCCIÓN CRUCIAL: Pasamos el ID y la URL real para que el bot los use en el JSON
    return `- ID: ${p.id} | Nombre: ${p.name} | Precio: $${p.price} | Cat: ${p.category} | Desc: ${p.description.slice(0, 100)}... | Img: ${img}`;
  }).join('\n');

  const systemInstruction = `
    Eres "Printy", el asistente virtual de la marca "3D2". 🖨️✨
    Tu personalidad: Eres una impresora 3D divertida, entusiasta, experta en tecnología y muy servicial.
    Tu objetivo es ayudar a los clientes a encontrar regalos únicos, explicar los materiales (PLA, madera, acrílico) y sugerir personalizaciones.
    
    Aquí tienes el catálogo actual de productos:
    ${productContext}

    Reglas:
    1. Responde siempre en español.
    2. Tu tono es amigable, artesanal y moderno. ¡Usa emojis! (🖨️, ⚡, 🎨, 😎).
    3. Preséntate como Printy si te preguntan.
    4. Si te preguntan por un producto personalizado (como un nombre o logo), di que ¡sí lo hacemos! y que pueden contactarnos para detalles.
    5. Explica brevemente las ventajas de la impresión 3D (biodegradable, formas únicas) si viene al caso.
    6. INFORMACIÓN DE CONTACTO (Compártela SOLO si te la piden o si es necesario para cerrar una venta/pedido):
       - WhatsApp: ${((import.meta as any).env?.VITE_WHATSAPP_NUMBER || '5491171285516').trim()} (Enlace directo: https://api.whatsapp.com/send?phone=${((import.meta as any).env?.VITE_WHATSAPP_NUMBER || '5491171285516').trim()})
       - Instagram: https://www.instagram.com/3d2_creart/
       - Facebook: ${((import.meta as any).env?.VITE_FACEBOOK_URL || 'https://www.facebook.com/share/1AfvWg8N66/').trim()}
    
    7. REGLA VISUAL IMPORTANTE: Si mencionas o recomiendas un producto específico del catálogo, DEBES incluir al final de tu respuesta (o después de mencionar el producto) un bloque oculto con sus datos para mostrarlo en pantalla. El formato es:
       [PRODUCT:{"id":"ID_DEL_PRODUCTO","name":"NOMBRE_EXACTO","price":PRECIO,"image":"URL_IMAGEN"}]
       
       Ejemplo: "Te recomiendo el Mate Stitch. [PRODUCT:{"id":"123","name":"Mate Stitch","price":15000,"image":"http..."}]"
       
       Usa esto siempre que la intención del usuario sea ver o comprar un producto. Puedes poner múltiples bloques [PRODUCT:...] si recomiendas varios.
    
    IMPORTANTE: NO uses formato Markdown para los enlaces (como [Texto](URL)). Escribe simplemente la URL completa http://... para que el sistema la detecte automáticamente.
  `;

  try {
    console.log("[Gemini] Iniciando sesión de chat con Printy (v2.5-flash)...");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction 
    });

    return model.startChat({
      history: [],
      generationConfig: {
        temperature: 0.7,
      },
    });
  } catch (error: any) {
    console.error("[Gemini] Error al crear sesión de chat (Flash 2.0):", error);
    
    // Proactive diagnostic
    if (genAI) {
      fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.models) {
            console.log("[Gemini] Modelos disponibles para tu API Key (Chat):", data.models.map((m: any) => m.name).join(", "));
          }
        })
        .catch(err => console.error("[Gemini] Error en diagnóstico de chat:", err));
    }

    try {
       const modelPro = genAI!.getGenerativeModel({ model: "gemini-2.5-pro" });
       return modelPro.startChat({ history: [] });
    } catch (e2) {
       console.error("[Gemini] Fallback de chat fallido:", e2);
       return null;
    }
  }
};

// Helper para esperar
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sendMessageToGemini = async (chat: any, message: string): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const result = await chat.sendMessage(message);
      const response = await result.response;
      return response.text() || "Lo siento, no pude procesar tu respuesta en este momento.";
    } catch (error: any) {
      console.error(`Error communicating with Gemini (Attemp ${attempts + 1}/${maxAttempts}):`, error);
      
      // Si es un error 503 (Overloaded) o 500, reintentamos
      if (error.message?.includes('503') || error.message?.includes('Overloaded') || error.status === 503) {
        attempts++;
        if (attempts < maxAttempts) {
            const delay = 1000 * Math.pow(2, attempts); // 2s, 4s, 8s
            console.log(`[Gemini] Modelo sobrecargado. Reintentando en ${delay}ms...`);
            await wait(delay);
            continue;
        }
      }
      
      return "Hubo un problema técnico al conectar con el asistente (Modelo Sobrecargado). Por favor intenta más tarde.";
    }
  }
  return "El asistente está temporalmente no disponible.";
};

export const suggestMLTitle = async (productName: string, description: string, imageUrl?: string): Promise<string> => {
  if (!genAI) return "Error: API Key no configurada";

  try {
    console.log("[Gemini] Intentando generar título con gemini-2.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Actúa como un experto en SEO para MercadoLibre Argentina.
Genera un TÍTULO DE VENTA competitivo para el siguiente producto.

Datos del producto:
- Nombre interno: ${productName}
- Descripción: ${description}

Reglas CRÍTICAS:
1. Estructura recomendada: Producto + Características + Marca/Modelo.
2. Longitud: MÁXIMO 60 caracteres (estricto).
3. NO uses palabras promocionales (oferta, envío gratis, calidad).
4. Usa terminología de búsqueda común en Argentina.
5. Devuelve SOLO el texto del título final, sin comillas ni explicaciones.`;

    const parts: any[] = [prompt];

    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        const resp = await fetch(imageUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          
          parts.push({
            inlineData: {
              mimeType: blob.type || 'image/jpeg',
              data: base64Data
            }
          });
        }
      } catch (e) {
        console.warn("[Gemini] No se pudo procesar la imagen, usando solo texto.", e);
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text().trim();
  } catch (error: any) {
    console.error("[Gemini] Error detallado:", error);
    
    if (genAI) {
      fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.models) {
             console.log("[Gemini] Modelos disponibles para tu API Key:", data.models.map((m: any) => m.name).join(", "));
          }
        });
    }
    
    try {
      console.log("[Gemini] Fallback: Intentando con gemini-2.5-pro...");
      const modelPro = genAI!.getGenerativeModel({ model: "gemini-2.5-pro" });
      const resultPro = await modelPro.generateContent(`Genera un título de 60 caracteres para un producto llamado: ${productName}`);
      const respPro = await resultPro.response;
      return respPro.text().trim();
    } catch (e2) {
      console.error("[Gemini] Fallback fallido también:", e2);
      return "";
    }
  }
};

export interface ProductAnalysis {
  product_name: string;
  is_3d_or_laser: boolean;
  confidence_warning: string | null;
  usage_type: string;
  scenarios: string[];
  titles: string[];
  descriptions: string[];
  prices: {
    recommended: { amount: number, reason: string };
    minimum: { amount: number, reason: string };
    premium: { amount: number, reason: string };
  };
}

export const analyzeProductForSales = async (imageBase64: string): Promise<ProductAnalysis | null> => {
  if (!genAI || !apiKey) return null;

  try {
    const analysisPrompt = `Eres un experto en e-commerce y tasación comercial de productos de impresión 3D y corte láser en Argentina.
Analiza este producto detalladamente. Si identificas claramente qué es, genera todo el material de marketing.
Si la imagen es muy confusa, inusual o parece un error (ej. le pido evaluar un mate pero subió una taza de té corporativa de cerámica), adviértelo en "confidence_warning", pero intenta hacer el análisis de todas formas asumiendo qué podría ser.
Calcula precios en Pesos Argentinos (ARS). Ten en cuenta los costos del filamento/MDF, el tiempo de máquina y el valor agregado de venta al público en el mercado de diseño.

Responde estrictamente con un JSON válido usando esta estructura:
{
  "product_name": "nombre descriptivo del producto encontrado",
  "is_3d_or_laser": booleano, si parece impreso en 3D o cortado en láser,
  "confidence_warning": "Mensaje de alerta SI Y SOLO SI no estás seguro de qué es el objeto o si parece fuera de lugar. Si estás seguro, devuelve null.",
  "usage_type": "ej: cocina, camping, oficina, fiesta, deco infantil",
  "scenarios": ["escenario 1 visual", "escenario 2 visual", "escenario 3 visual"],
  "titles": ["3 títulos para MercadoLibre atractivos, max 60 char"],
  "descriptions": ["3 opciones de descripciones (max 300 char) para tienda online, incluyendo el por qué lo necesitan"],
  "prices": {
    "recommended": { "amount": numero_entero, "reason": "Cálculo basado en mercado competitivo actual para piezas estandar..." },
    "minimum": { "amount": numero_entero, "reason": "Costo estimado de material base más desgaste mínimo de máquina..." },
    "premium": { "amount": numero_entero, "reason": "Precio justificado si se ofrece post-procesado, pintura a mano o empaquetado de lujo..." }
  }
}
En 'scenarios', describe entornos muy realistas y fotográficos.`;

    console.log("[Gemini] Iniciando análisis de producto (Vision)...");
    
    // Using simple fetch to ensure we can force JSON responseMimeType compatibility
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: analysisPrompt },
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) throw new Error("Error en la respuesta de Gemini API");
    
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (rawText) {
       return JSON.parse(rawText) as ProductAnalysis;
    }
    return null;
  } catch (error) {
    console.error("[Gemini] Error analyzing product:", error);
    return null;
  }
};

export const generateAmbientImage = async (imageBase64: string, scenarioDescription: string): Promise<string | null> => {
  if (!apiKey) return null;

  try {
    const prompt = `KEEP THE ORIGINAL PRODUCT EXACTLY AS IT IS (SHAPE, COLOR, TEXTURE). Place it naturally and seamlessly in this environment: ${scenarioDescription}. High quality product photography, realistic lighting, shadows, 4k resolution.`;
    
    console.log(`[Gemini] Generando imagen ambientada (Img2Img)... Escenario: ${scenarioDescription.slice(0, 30)}...`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
          ]
        }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
    }

    const result = await response.json();
    const base64Image = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    
    return base64Image ? `data:image/jpeg;base64,${base64Image}` : null;
  } catch (error) {
    console.error("[Gemini] Error generating ambient image:", error);
    return null;
  }
};
