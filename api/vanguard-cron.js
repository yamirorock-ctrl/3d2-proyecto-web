/**
 * Vanguard Auto-Cron / Scanner Proactivo
 * Corre dos veces al día: 12 PM y 22 PM
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Sólo GET local.' });
  }

  // Prevenir abusos asegurando que vino del motor de CRON de Vercel (si CRON_SECRET está configurado)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("Ejecución de cron rechazada por no tener Auth");
    // No cortamos drásticamente por si se está probando manualmente, pero es buena práctica.
  }

  if (!supabase) return res.status(500).json({ error: 'Base de datos sin conexión' });

  try {
    console.log("[VANGUARD CRON] Iniciando escaneo algorítmico del mercado...");

    // 1. Obtener la cuenta vinculada de administrador primario
    const { data: dbToken } = await supabase
      .from('ml_tokens')
      .select('user_id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!dbToken) return res.status(404).json({ error: 'No Merchant account config' });
    const userId = dbToken.user_id;

    // Ligar API 
    // Usamos hostname dinámico si es Vercel o estático
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.creart3d2.com';

    console.log(`[VANGUARD CRON] Fetching metrics from ${baseUrl}/api/ml-manager`);
    
    const mRes = await fetch(`${baseUrl}/api/ml-manager?action=get-metrics&userId=${userId}`);
    if (!mRes.ok) throw new Error("Fallo extrayendo métricas base");
    const metricsData = await mRes.json();

    // 2. Extraer memoria de Vanguard actual para darle contexto
    const { data: val } = await supabase.from('vanguard_memory').select('content').eq('user_id', String(userId)).eq('event_type', 'chat_history').maybeSingle();
    
    // Si queremos que Vanguard inicie la charla sin esperar al usuario, le mandamos el array
    // Vanguard va a leer el prompt oculto como si fuera del usuario pero sabe que es el sistema.
    const sysPrompt = "SISTEMA CERRADO: Esto es un disparador automático del Cron Job (horario de reporte programado). Redacta un reporte táctico profundo sobre las métricas actuales que estoy adjuntando. Dirígete a tu Administrador como 'Reporte de Escaneo de Mercado'. Menciona qué te preocupa o qué ves bien. NO esperes respuesta, solo deja el reporte.";
    
    console.log(`[VANGUARD CRON] Forzando razonamiento y análisis profundo de IA...`);

    const sRes = await fetch(`${baseUrl}/api/ml-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         action: 'strategic-analysis',
         isChat: true,
         history: val?.content || [],
         message: sysPrompt,
         metrics: metricsData,
         current_inventory: [],
         userId: String(userId)
      })
    });

    if (!sRes.ok) throw new Error("Fallo en la inferencia multimodal del modelo Vanguard.");
    
    const responseData = await sRes.json();
    console.log("[VANGUARD CRON] Informe estratégico guardado con éxito.");

    return res.status(200).json({
       success: true,
       message: "Escaneo completado. Reporte de Vanguard inyectado en Base de Datos.",
       reply_preview: responseData.reply.substring(0, 100) + '...'
    });

  } catch (error) {
    console.error('[VANGUARD CRON ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}
