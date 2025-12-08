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
 * Filtra cualquier propiedad del objeto que no deba ser enviada a la base de datos.
 * La conversión de camelCase a snake_case la realiza automáticamente la librería de Supabase.
 * @param product El objeto de producto a limpiar.
 * @returns Un nuevo objeto de producto solo con las propiedades válidas.
 */
function sanitizeProductForUpsert(product: Partial<Product>): Partial<Product> {
  // Lista de propiedades en el tipo `Product` que NO son columnas en la BBDD
  const clientOnlyProperties: (keyof Product)[] = [
    // Si tuvieras una propiedad en el tipo `Product` que no existe en la base de datos,
    // la añadirías aquí para que sea filtrada. Por ejemplo: 'isHovering'.
  ];

  const sanitizedProduct = { ...product };

  for (const key of clientOnlyProperties) {
    // Elimina las propiedades que son solo para el cliente
    if (key in sanitizedProduct) {
      delete sanitizedProduct[key];
    }
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
    .upsert(productToUpsert as any) // `as any` es útil aquí porque los tipos de Supabase esperan snake_case
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
export async function deleteProduct(productId: number): Promise<{ data: any | null, error: PostgrestError | null }> {
  const { error } = await supabase.from('products').delete().eq('id', productId);

  if (error) {
    console.error('Error al eliminar producto:', error);
    return { data: null, error };
  }
  return { data: { success: true }, error: null };
}

/**
 * Insertar o actualizar múltiples productos (Bulk Upsert).
 */
export async function upsertProductsBulk(products: Partial<Product>[]): Promise<{ data: Product[] | null; error: PostgrestError | null }> {
  const productsToUpsert = products.map(p => sanitizeProductForUpsert(p));

  const { data, error } = await supabase
    .from('products')
    .upsert(productsToUpsert as any)
    .select();

  if (error) {
    console.error('Error en bulk upsert:', error);
    return { data: null, error };
  }

  return { data: data as Product[], error: null };
}