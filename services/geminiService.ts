import { Product } from "../types";

// Removed GoogleGenerativeAI and direct apiKey dependency to protect the API key.
// All requests are now securely proxied through /api/gemini.

export interface ChatSessionProxy {
  systemInstruction: string;
  history: { role: string; parts: { text: string }[] }[];
}

export const createChatSession = (products: Product[]): ChatSessionProxy => {
  const productContext = products.map(p => {
    const img = p.image || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0].url : '') || '';
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
       - WhatsApp: ${((import.meta as any).env?.VITE_WHATSAPP_NUMBER || '5491171285516').trim()}
       - Instagram: https://www.instagram.com/3d2_creart/
       - Facebook: ${((import.meta as any).env?.VITE_FACEBOOK_URL || 'https://www.facebook.com/share/1AfvWg8N66/').trim()}
    
    7. REGLA VISUAL IMPORTANTE: Si mencionas o recomiendas un producto específico del catálogo, DEBES incluir al final de tu respuesta (o después de mencionar el producto) un bloque oculto con sus datos para mostrarlo en pantalla. El formato es:
       [PRODUCT:{"id":"ID_DEL_PRODUCTO","name":"NOMBRE_EXACTO","price":PRECIO,"image":"URL_IMAGEN"}]
       
       Ejemplo: "Te recomiendo el Mate Stitch. [PRODUCT:{"id":"123","name":"Mate Stitch","price":15000,"image":"http..."}]"
       
       Usa esto siempre que la intención del usuario sea ver o comprar un producto. Puedes poner múltiples bloques [PRODUCT:...] si recomiendas varios.
    
    IMPORTANTE: NO uses formato Markdown para los enlaces (como [Texto](URL)). Escribe simplemente la URL completa http://... para que el sistema la detecte automáticamente.
  `;

  return {
    systemInstruction,
    history: []
  };
};

export const sendMessageToGemini = async (chat: ChatSessionProxy | null, message: string): Promise<string> => {
  if (!chat) return "Error de conexión local con Printy.";

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          payload: {
            systemInstruction: chat.systemInstruction,
            history: chat.history, // Send current history
            message: message
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Servidor respondio con ${response.status}`);
      }

      const data = await response.json();
      
      // Update local pseudo-history so next requests hold context!
      chat.history.push({ role: 'user', parts: [{ text: message }] });
      chat.history.push({ role: 'model', parts: [{ text: data.reply }] });

      return data.reply || "Lo siento, no pude procesar tu respuesta en este momento.";
    } catch (error: any) {
      console.error(`Error communicating securely with Gemini Backend (Attemp ${attempts + 1}/${maxAttempts}):`, error);
      attempts++;
      if (attempts < maxAttempts) {
         const delay = 1000 * Math.pow(2, attempts);
         await new Promise(resolve => setTimeout(resolve, delay));
         continue;
      }
      return "Hubo un problema técnico al conectar con nuestro servidor seguro. Por favor intenta más tarde.";
    }
  }
  return "El asistente está temporalmente no disponible.";
};

export const suggestMLTitle = async (productName: string, description: string, imageUrl?: string): Promise<string> => {
  try {
    let imageUrlBase64 = null;
    
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        const resp = await fetch(imageUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          imageUrlBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("[Gemini Frontend] No se pudo procesar imagen para título", e);
      }
    }

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'suggest_title',
        payload: { productName, description, imageUrlBase64 }
      })
    });
    
    if (!response.ok) throw new Error("Fallo en backend suggest_title");
    const data = await response.json();
    return data.title || "";
  } catch (error) {
    console.error("[Gemini Frontend] Error suggestMLTitle", error);
    return "";
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
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze_product',
        payload: { imageBase64 }
      })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    return data.analysis as ProductAnalysis;
  } catch (error) {
    console.error("[Gemini Frontend] Error analyzeProductForSales", error);
    return null;
  }
};

export const generateAmbientImage = async (imageBase64: string, scenarioDescription: string): Promise<string | null> => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_ambient',
        payload: { imageBase64, scenarioDescription }
      })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    return data.imageBase64 || null;
  } catch (error) {
    console.error("[Gemini Frontend] Error generateAmbientImage", error);
    return null;
  }
};
