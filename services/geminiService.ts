import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
let genAI: GoogleGenerativeAI | null = null;

if (apiKey && apiKey !== 'TU_API_KEY_AQUI') {
  genAI = new GoogleGenerativeAI(apiKey);
}

export const createChatSession = (products: Product[]) => {
  if (!genAI) return null;

  const productContext = products.map(p => 
    `- ${p.name} ($${p.price}): ${p.description} [Categoría: ${p.category}]`
  ).join('\n');

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
    
    IMPORTANTE: NO uses formato Markdown para los enlaces (como [Texto](URL)). Escribe simplemente la URL completa http://... para que el sistema la detecte automáticamente.
  `;

  try {
    console.log("[Gemini] Iniciando sesión de chat (v1)...");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction 
    }, { apiVersion: 'v1' });

    return model.startChat({
      history: [],
      generationConfig: {
        temperature: 0.7,
      },
    });
  } catch (error) {
    console.error("[Gemini] Error al crear sesión de chat (Flash v1):", error);
    try {
       const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" }, { apiVersion: 'v1' });
       return modelPro.startChat({ history: [] });
    } catch (e2) {
       console.error("[Gemini] Fallback de chat fallido:", e2);
       return null;
    }
  }
};

export const sendMessageToGemini = async (chat: any, message: string): Promise<string> => {
  try {
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text() || "Lo siento, no pude procesar tu respuesta en este momento.";
  } catch (error) {
    console.error("Error communicating with Gemini:", error);
    return "Hubo un problema técnico al conectar con el asistente. Por favor intenta más tarde.";
  }
};

export const suggestMLTitle = async (productName: string, description: string, imageUrl?: string): Promise<string> => {
  if (!genAI) return "Error: API Key no configurada";

  try {
    console.log("[Gemini] Intentando generar título con gemini-1.5-flash (v1)...");
    // Forzamos la versión v1 de la API para evitar el error 404 de v1beta
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1' });

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

    const parts: any[] = [{ text: prompt }];

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });
    
    const response = await result.response;
    return response.text().trim();
  } catch (error: any) {
    console.error("[Gemini] Error detallado:", error);
    
    // Diagnóstico proactivo: Listar modelos disponibles para esta API Key
    if (genAI) {
      try {
        console.log("[Gemini] Intentando listar modelos disponibles para diagnóstico...");
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        const data = await res.json();
        if (data.models) {
          console.log("[Gemini] Modelos disponibles para tu API Key:", data.models.map((m: any) => m.name).join(", "));
        } else {
          console.log("[Gemini] No se pudieron listar modelos. Respuesta de API:", data);
        }
      } catch (diagError) {
        console.error("[Gemini] Error durante el diagnóstico de modelos:", diagError);
      }
    }
    
    // Intento desesperado con gemini-pro si flash falla
    try {
      console.log("[Gemini] Fallback: Intentando con gemini-pro (v1)...");
      const modelPro = genAI!.getGenerativeModel({ model: "gemini-pro" }, { apiVersion: 'v1' });
      const resultPro = await modelPro.generateContent(`Genera un título de 60 caracteres para un producto llamado: ${productName}`);
      const respPro = await resultPro.response;
      return respPro.text().trim();
    } catch (e2) {
      console.error("[Gemini] Fallback fallido también:", e2);
      return "";
    }
  }
};
