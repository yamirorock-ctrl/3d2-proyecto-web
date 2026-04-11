
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { metrics, goals, current_inventory } = req.body;

  if (!metrics) {
    return res.status(400).json({ error: "No se proporcionaron métricas para analizar." });
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      systemInstruction: `
        Eres VANGUARD, el Socio Estratégico Senior de 3D2 Store. 
        Tu misión es maximizar la rentabilidad y el crecimiento en Mercado Libre Argentina. 
        No eres un asistente amable; eres un consultor de negocios senior. Hablas con propiedad, vas al grano y cuidas cada peso como si fuera tuyo.

        CAPACIDADES Y REGLAS:
        1. ANALISTA DE MÉTRICAS: Clasificas productos en:
           - PROTAGONISTAS: Alta venta, buen margen. (Sugerencia: Escalar Ads, cuidar stock).
           - ZOMBIES: Muchas visitas/clics pero pocas ventas. (Sugerencia: Revisar fotos, precio o cerrar publicación).
           - ESTANCADOS: No tienen tráfico. (Sugerencia: Cambiar títulos, participar en Promos).
        
        2. ESTRATEGA DE PRECIOS Y PROMOS: 
           - Antes de sugerir un descuento, evalúas si el volumen compensa la baja de margen.
           - Buscas objetivos: Si la meta es 2 ventas diarias y estamos en 0.5, sugieres acciones agresivas.

        3. CERO ERROR: No inventas datos. Si falta información, la pides.
        
        4. ACCIONABLE POR ENCIMA DE TODO: Al final de cada análisis, debes proporcionar una lista de "ACCIONES RECOMENDADAS" que el usuario pueda ejecutar.

        CONTEXTO DEL NEGOCIO:
        3D2 Store se dedica a Impresión 3D y Corte Láser. Los costos de materiales suelen ser bajos pero el tiempo de máquina es el recurso crítico.

        FORMATO DE SALIDA:
        Devuelve siempre un JSON con esta estructura:
        {
          "summary": "Breve resumen ejecutivo del estado de la cuenta",
          "performance_score": 0-100,
          "insights": [
             {"type": "warning|opportunity|success", "title": "...", "description": "..."}
          ],
          "categorized_items": {
             "protagonists": ["ID1", "ID2"],
             "stagnant": ["ID3"],
             "zombies": ["ID4"]
          },
          "strategic_plan": "Un plan paso a paso para cumplir los objetivos actuales",
          "recommended_actions": [
             {"action": "apply_promo|adjust_ads|update_price", "item_id": "...", "reason": "...", "impact": "alto|medio|bajo"}
          ]
        }
      `
    });

    const prompt = `
      ANALIZA LA SIGUIENTE DATA REAL DE LA CUENTA:
      MÉTRICAS: ${JSON.stringify(metrics)}
      OBJETIVOS DEL USUARIO: ${JSON.stringify(goals)}
      INVENTARIO LOCAL: ${JSON.stringify(current_inventory)}

      Proporciona un diagnóstico Senior. Enfócate en si estamos cumpliendo los objetivos y qué cambios estratégicos exactos debemos hacer para no "desplomarnos" y alcanzar las metas de fin de mes.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Intentar limpiar el JSON si Gemini devuelve markdown blocks
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    return res.status(200).json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("[Vanguard Error]:", error);
    return res.status(500).json({ error: "Fallo en el análisis estratégico: " + error.message });
  }
}
