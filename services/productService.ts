import { getClient } from './supabaseService';
import { Product } from '../types';

const supabase = getClient();

/**
 * Obtener todos los productos.
 * Convierte la respuesta de snake_case a camelCase.
 */
export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener productos:', error);
    return [];
  }

  return (data || []) as Product[];
}

/**
 * Crear o actualizar un producto (Upsert).
 * Convierte el objeto de camelCase a snake_case antes de enviarlo.
 */
export async function upsertProduct(product: Partial<Product>): Promise<{ product: Product | null; error: any }> {
  const { data, error } = await supabase
    .from('products')
    .upsert(product as any) // `as any` es necesario porque el tipo espera camelCase
    .select()
    .single();

  if (error) {
    console.error('Error en upsert de producto:', error);
    return { product: null, error };
  }

  return { product: data as Product, error: null };
}

/**
 * Eliminar un producto.
 */
export async function deleteProduct(productId: number): Promise<boolean> {
  const { error } = await supabase.from('products').delete().eq('id', productId);

  if (error) {
    console.error('Error al eliminar producto:', error);
    return false;
  }
  return true;
}