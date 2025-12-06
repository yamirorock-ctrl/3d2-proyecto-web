import { getClient } from './supabaseService';
import { Product } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

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
 * Prepara un objeto de producto para ser enviado a Supabase.
 * Elimina las propiedades que no existen como columnas en la tabla 'products'.
 * Esto evita errores como "column does not exist".
 * @param product El objeto de producto a limpiar.
 * @returns Un nuevo objeto de producto solo con las propiedades válidas.
 */
function sanitizeProductForUpsert(product: Partial<Product>): Partial<Product> {
  // Crea una copia para no modificar el objeto original
  const sanitizedProduct = { ...product };

  // Lista de propiedades en el tipo `Product` que NO son columnas en la BBDD
  const clientOnlyProperties: (keyof Product)[] = [
    'packEnabled',
    'mayoristaEnabled',
    'wholesaleImage',
    'wholesaleDescription'
    // Agrega aquí cualquier otra propiedad que solo exista en el cliente
  ];

  // Elimina las propiedades que no deben ser enviadas a Supabase
  for (const key of clientOnlyProperties) {
    delete sanitizedProduct[key];
  }

  return sanitizedProduct;
}

/**
 * Crear o actualizar un producto (Upsert).
 */
export async function upsertProduct(product: Partial<Product>): Promise<{ data: Product | null; error: PostgrestError | null }> {
  const productToUpsert = sanitizeProductForUpsert(product);

  const { data, error } = await supabase
    .from('products')
    .upsert(productToUpsert)
    .select()
    .single();

  if (error) {
    console.error('Error en upsert de producto:', error);
    return { data: null, error };
  }

  return { data, error: null };
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