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
    Eres un asistente de ventas virtual experto y creativo para la marca "3D2".
    Tu especialidad es la impresión 3D y el corte láser.
    Tu objetivo es ayudar a los clientes a encontrar regalos únicos, explicar los materiales (PLA, madera, acrílico) y sugerir personalizaciones.
    
    Aquí tienes el catálogo actual de productos:
    ${productContext}

    Reglas:
    1. Responde siempre en español.
    2. Tu tono es amigable, artesanal y moderno.
    3. Si te preguntan por un producto personalizado (como un nombre o logo), di que ¡sí lo hacemos! y que pueden contactarnos para detalles.
    4. Explica brevemente las ventajas de la impresión 3D (biodegradable, formas únicas) si viene al caso.
    5. Utiliza emojis relacionados (🎨, 🧶, 🎁, ✨) para mantener un tono fresco.
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
    console.log("[Gemini] Iniciando sesión de chat (v1.5-flash)...");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
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
       const modelPro = genAI!.getGenerativeModel({ model: "gemini-3-pro-preview" });
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
    console.log("[Gemini] Intentando generar título con gemini-3-flash-preview...");
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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
      console.log("[Gemini] Fallback: Intentando con gemini-3-pro-preview...");
      const modelPro = genAI!.getGenerativeModel({ model: "gemini-3-pro-preview" });
      const resultPro = await modelPro.generateContent(`Genera un título de 60 caracteres para un producto llamado: ${productName}`);
      const respPro = await resultPro.response;
      return respPro.text().trim();
    } catch (e2) {
      console.error("[Gemini] Fallback fallido también:", e2);
      return "";
    }
  }
};
