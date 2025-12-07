// Guarda un producto completo en la tabla 'products' de Supabase
export async function saveProductToSupabase(product: any): Promise<{ success: boolean; error?: string }> {
  const client = getClient();
  try {
    const { error } = await client.from('products').insert([product]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// Inserta o actualiza un producto según su id (evita duplicados)
export async function upsertProductToSupabase(product: any): Promise<{ success: boolean; error?: string }> {
  const client = getClient();
  try {
    const { error } = await client.from('products').upsert([product], { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
import { createClient } from '@supabase/supabase-js';
import type { Product } from '../types';

let supabase:
  | ReturnType<typeof createClient>
  | null = null;

function getClient() {
  if (supabase) return supabase;
  const url = (import.meta as any).env?.VITE_SUPABASE_URL;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_TOKEN;
  if (!url || !key) throw new Error('Supabase no configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_TOKEN)');
  supabase = createClient(url, key);
  return supabase;
}

// Exportar cliente para uso en otros servicios
export { getClient };

export async function uploadToSupabase(file: File, bucket: string, path?: string): Promise<string> {
  const client = getClient();
  const fileName = path || `${Date.now()}-${file.name}`.replace(/\s+/g, '-');
  const { error } = await client.storage.from(bucket).upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data } = client.storage.from(bucket).getPublicUrl(fileName);
  if (!data?.publicUrl) throw new Error('No se pudo obtener URL pública');
  return data.publicUrl;
}

export async function testSupabase(bucket: string): Promise<{ ok: boolean; message: string }> {
  try {
    const client = getClient();
    const testName = `__ping-${Date.now()}.png`;
    // Imagen PNG mínima (1x1 px)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgA0A1p8AAAAASUVORK5CYII=';
    const byteCharacters = atob(pngBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const { error: upErr } = await client.storage.from(bucket).upload(testName, blob, { upsert: true });
    if (upErr) return { ok: false, message: `Error al subir archivo de prueba: ${upErr.message}` };
    const { error: delErr } = await client.storage.from(bucket).remove([testName]);
    if (delErr) return { ok: false, message: `Subió pero no pudo eliminar: ${delErr.message}` };
    return { ok: true, message: 'Conexión y permisos OK (upload/delete)' };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// Obtiene todos los productos desde Supabase
export async function getAllProductsFromSupabase(): Promise<{ success: boolean; products?: Product[]; error?: string }> {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('products')
      .select('id,name,price,category,image,images,description,technology,featured,stock,sale_type,pack_enabled,mayorista_enabled,wholesale_units,wholesale_discount,wholesale_image,wholesaledescription,unitsperpack');
    if (error) return { success: false, error: error.message };
    // Asegurar tipos básicos y default arrays
    const products: Product[] = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name || '',
      price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
      category: p.category || '',
      image: p.image || '',
      images: Array.isArray(p.images) ? p.images : [],
      description: p.description || '',
      technology: p.technology === 'Láser' ? 'Láser' : '3D',
      featured: !!p.featured,
      stock: typeof p.stock === 'number' ? p.stock : (p.stock !== null && p.stock !== undefined ? Number(p.stock) : undefined),
      saleType: p.sale_type || 'unidad',
      packEnabled: !!p.pack_enabled,
      unitsperpack: p.unitsperpack ? Number(p.unitsperpack) : undefined,
      mayorista_enabled: !!p.mayorista_enabled,
      wholesaleUnits: p.wholesale_units ? Number(p.wholesale_units) : undefined,
      wholesaleDiscount: p.wholesale_discount ? Number(p.wholesale_discount) : undefined,
      wholesaleImage: p.wholesale_image || undefined,
      wholesaledescription: p.wholesaledescription || undefined
    }));
    return { success: true, products };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
