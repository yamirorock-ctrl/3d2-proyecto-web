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
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction 
    });

    return model.startChat({
      history: [],
      generationConfig: {
        temperature: 0.7,
      },
    });
  } catch (error) {
    console.error("Error al crear sesión de chat (Flash):", error);
    try {
       // Fallback a modelo pro si systemInstruction o modelo flash fallan
       const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
       return modelPro.startChat({ history: [] });
    } catch (e2) {
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
    // Usamos gemini-1.5-flash que es el modelo estándar actual
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        console.warn("No se pudo procesar la imagen para la IA, usando solo texto.", e);
      }
    }

    // Llamada más robusta especificando el objeto contents
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });
    
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generando título ML:", error);
    // Fallback a modelo pro si flash falla por alguna razón de cuota o disponibilidad
    try {
      const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
      const resultPro = await modelPro.generateContent(`Genera un título de 60 caracteres para: ${productName}`);
      const respPro = await resultPro.response;
      return respPro.text().trim();
    } catch (e2) {
      return "";
    }
  }
};
