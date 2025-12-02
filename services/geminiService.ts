import { GoogleGenAI, Chat } from "@google/genai";
import { Product } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;

// Initialize only if key exists and is not placeholder
if (apiKey && apiKey !== 'TU_API_KEY_AQUI') {
  ai = new GoogleGenAI({ apiKey });
}

export const createChatSession = (products: Product[]): Chat | null => {
  if (!ai) return null;

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
  `;

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
    },
  });
};

export const sendMessageToGemini = async (chat: Chat, message: string): Promise<string> => {
  try {
    const response = await chat.sendMessage({ message });
    return response.text || "Lo siento, no pude procesar tu respuesta en este momento.";
  } catch (error) {
    console.error("Error communicating with Gemini:", error);
    return "Hubo un problema técnico al conectar con el asistente. Por favor intenta más tarde.";
  }
};