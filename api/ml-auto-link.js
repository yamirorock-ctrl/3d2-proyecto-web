import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  if (!supabase) {
      return res.status(500).json({ error: 'No Supabase credentials Configured in Vercel' });
  }

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Falta userId' });

  try {
    // 1. Get ML Token (Single Tenant Assumption like sync product)
    const { data: dbToken, error: tokenError } = await supabase
      .from('ml_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !dbToken || !dbToken.access_token) {
      return res.status(401).json({ error: 'No hay token de ML vinculado. Conecta tu cuenta primero.' });
    }

    const mlUserId = dbToken.user_id; // in ml_tokens, user_id is the MercadoLibre ID

    // 2. Fetch User's Active Items from ML
    const searchRes = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?status=active`, {
        headers: { Authorization: `Bearer ${dbToken.access_token}` }
    });
    
    if (!searchRes.ok) {
        throw new Error('Error al buscar items en ML');
    }
    const searchData = await searchRes.json();
    const mlIds = searchData.results || [];
    
    if (mlIds.length === 0) {
        return res.status(200).json({ message: 'No tienes publicaciones activas en MercadoLibre', linked: 0 });
    }

    // 3. Fetch Details for those ML items
    const detailsRes = await fetch(`https://api.mercadolibre.com/items?ids=${mlIds.join(',')}`, {
        headers: { Authorization: `Bearer ${dbToken.access_token}` }
    });
    const detailsData = await detailsRes.json();
    
    const mlItems = detailsData.map(d => d.body).filter(Boolean);

    // 4. Get Local Products where ml_item_id IS NULL or we want to overwrite
    const { data: localProducts, error: prodError } = await supabase
      .from('products')
      .select('id, name, ml_item_id');
      
    if (prodError) throw prodError;

    let linkedCount = 0;
    let logs = [];

    // 5. Try to match ML titles with Local Products
    for (const item of mlItems) {
        const mlTitle = item.title.toLowerCase();
        
        // Encontramos un producto local cuyo nombre esté contenido en el título de ML
        // o que el título de ML contenga la mayoría de las palabras del producto local
        const match = localProducts.find(p => {
             if (p.ml_item_id === item.id) return false; // Ya está vinculado a este
             
             // Si tienen exactamente el mismo nombre (raro pero ideal)
             if (mlTitle === p.name.toLowerCase()) return true;
             
             // Si el nombre local está incluido en el título de ML (muy común)
             if (mlTitle.includes(p.name.toLowerCase())) return true;
             
             // Alternativa inteligente: las primeras 3 palabras clave coinciden
             const localWords = p.name.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 3);
             if (localWords.length > 0 && localWords.every(w => mlTitle.includes(w))) return true;

             return false;
        });

        if (match) {
            // Vincular en DB
            const { error: updErr } = await supabase
                .from('products')
                .update({ ml_item_id: item.id, ml_permalink: item.permalink, ml_status: item.status })
                .eq('id', match.id);
            
            if (!updErr) {
                // Actualizarlo en la variable temporal para no volver a matchearlo
                match.ml_item_id = item.id;
                linkedCount++;
                logs.push(`Vinculado [${item.id}] -> "${match.name}"`);
            }
        }
    }

    return res.status(200).json({ 
        message: `Búsqueda completada. Analizamos ${mlItems.length} publicaciones en ML.`, 
        linked: linkedCount,
        logs
    });

  } catch (error) {
    console.error('[ML Auto-Link]', error);
    return res.status(500).json({ error: error.message });
  }
}

