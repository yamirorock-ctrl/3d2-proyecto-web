import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing Gemini API Key configuration' });
  }

  const { action, payload } = req.body;
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // 1. Chat Session (Conversational flow)
    if (action === 'chat') {
      const { systemInstruction, history, message } = payload;
      
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction 
      });

      // To maintain stateless HTTP securely, we initialize a new chat session with the provided history
      // Note: @google/generative-ai history expects { role: "user" | "model", parts: [{text: ""}] }
      const chat = model.startChat({
        history: history || [],
        generationConfig: { temperature: 0.7 }
      });

      const result = await chat.sendMessage(message);
      const text = await result.response.text();
      return res.status(200).json({ reply: text });
    }

    // 2. Suggest Title
    if (action === 'suggest_title') {
      const { productName, description, imageUrlBase64 } = payload;
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

      const parts = [prompt];
      if (imageUrlBase64) {
        parts.push({
           inlineData: { mimeType: 'image/jpeg', data: imageUrlBase64 }
        });
      }
      
      const result = await model.generateContent(parts);
      const text = await result.response.text();
      return res.status(200).json({ title: text.trim() });
    }

    // 3. Analyze Product
    if (action === 'analyze_product') {
      const { imageBase64 } = payload;
      const analysisPrompt = `Eres un experto comercial de productos 3D y corte láser en Argentina.
Analiza este producto en base a esta imagen. 
Devuelve ESTRICTAMENTE un JSON con esta estructura (nada más):
{
  "product_name": "nombre corto",
  "is_3d_or_laser": true o false,
  "confidence_warning": "Warning o null",
  "usage_type": "ej: hogar, deco",
  "scenarios": ["escenario realista 1", "escenario 2"],
  "titles": ["titulo1", "titulo2", "titulo3"],
  "descriptions": ["desc1", "desc2"],
  "prices": {
     "recommended": { "amount": 1000, "reason": "reason" },
     "minimum": { "amount": 800, "reason": "reason" },
     "premium": { "amount": 1500, "reason": "reason" }
  }
}`;
        
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [ { text: analysisPrompt }, { inlineData: { mimeType: "image/jpeg", data: imageBase64 } } ] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return res.status(200).json({ analysis: JSON.parse(rawText) });
    }

    // 4. Generate Ambient
    if (action === 'generate_ambient') {
       const { imageBase64, scenarioDescription } = payload;
       const prompt = `KEEP THE ORIGINAL PRODUCT EXACTLY AS IT IS (SHAPE, COLOR, TEXTURE). Place it naturally and seamlessly in this environment: ${scenarioDescription}. High quality product photography, realistic lighting, shadows, 4k resolution.`;
       
       const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [ { text: prompt }, { inlineData: { mimeType: "image/jpeg", data: imageBase64 } } ] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
       });
       
       const data = await response.json();
       const base64Img = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
       return res.status(200).json({ imageBase64: base64Img ? `data:image/jpeg;base64,${base64Img}` : null });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('[Gemini Backend Error]', error);
    return res.status(500).json({ error: 'Server Error communicating with Gemini API: ' + (error.message || 'Unknown Error') });
  }
}
