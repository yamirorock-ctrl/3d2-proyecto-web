
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_TOKEN);

async function syncAllItems() {
    console.log("🔍 Iniciando Reconciliación con Autenticación...");

    const { data: tokenData } = await supabase.from('ml_tokens').select('*').single();
    if (!tokenData) throw new Error("No hay tokens en DB");

    let accessToken = tokenData.access_token;
    const sellerId = tokenData.user_id;

    async function fetchWithAuth(url) {
        let res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (res.status === 401) {
            console.log("🔄 Token expirado, refrescando...");
            const refreshRes = await fetch('https://api.mercadolibre.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: process.env.VITE_ML_APP_ID,
                    client_secret: process.env.VITE_ML_APP_SECRET,
                    refresh_token: tokenData.refresh_token
                })
            });
            const newData = await refreshRes.json();
            if (newData.access_token) {
                accessToken = newData.access_token;
                await supabase.from('ml_tokens').update({
                    access_token: newData.access_token,
                    refresh_token: newData.refresh_token,
                    expires_in: newData.expires_in,
                    updated_at: new Date().toISOString()
                }).eq('user_id', sellerId);
                res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            }
        }
        return res;
    }

    const itemsRes = await fetchWithAuth(`https://api.mercadolibre.com/users/${sellerId}/items/search?status=active`);
    const itemsData = await itemsRes.json();

    const mlIds = itemsData.results || [];
    console.log(`✅ IDs en ML: ${mlIds.length}`);

    const mlItems = [];
    for (const id of mlIds) {
        process.stdout.write(`⏳ Cargando ${id}... `);
        const res = await fetchWithAuth(`https://api.mercadolibre.com/items/${id}`);
        const data = await res.json();
        if (data.title) {
            mlItems.push(data);
            console.log("OK: " + data.title);
        } else {
            console.log("Error:", data.message || "Unknown");
        }
    }

    const { data: sbProducts } = await supabase.from('products').select('id, name, ml_item_id, ml_status');

    console.log("\n⚖️ Comparando...");
    let updates = 0;

    for (const mlProduct of mlItems) {
        const cleanML = mlProduct.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        let match = sbProducts.find(p => {
             if (!p.name) return false;
             const cleanSB = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
             return cleanSB.includes(cleanML) || cleanML.includes(cleanSB) || p.ml_item_id === mlProduct.id;
        });

        if (match) {
            const needsUpdate = match.ml_item_id !== mlProduct.id || match.ml_status !== mlProduct.status;
            if (needsUpdate) {
                console.log(`[ACTION] Sincronizando: ${match.name} -> ID: ${mlProduct.id}, Status: ${mlProduct.status}`);
                await supabase.from('products').update({ 
                    ml_item_id: mlProduct.id,
                    ml_status: mlProduct.status,
                    ml_permalink: mlProduct.permalink
                }).eq('id', match.id);
                updates++;
            } else {
                console.log(`[MATCH] ${match.name} está correctamente vinculado y activo.`);
            }
        } else {
            console.log(`[NOT-FOUND] Publicación "${mlProduct.title}" no existe en el catálogo web.`);
        }
    }

    console.log(`\n✨ Reconciliación total completada. Actualizaciones realizadas: ${updates}`);
}

syncAllItems().catch(console.error);
