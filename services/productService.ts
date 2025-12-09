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

  const mappedProducts = (data || []).map((p: any) => ({
    ...p,
    // Map snake_case keys from DB to camelCase properties in Product interface
    unitEnabled: p.unit_enabled,
    packEnabled: p.pack_enabled,
    unitsPerPack: p.units_per_pack,
    packDiscount: p.pack_discount,
    mayoristaEnabled: p.mayorista_enabled,
    wholesaleUnits: p.wholesale_min_units ?? p.wholesale_units,
    wholesaleDiscount: p.wholesale_discount,
    wholesaleImage: p.wholesale_image,
    wholesaleDescription: p.wholesale_description,
    // Cleanup snake_case keys if desired, though usually harmless to keep
  }));

  return mappedProducts as Product[];
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

  const sanitizedProduct: any = { ...product };

  // Eliminar propiedades solo de cliente
  for (const key of clientOnlyProperties) {
    if (key in sanitizedProduct) {
      delete sanitizedProduct[key];
    }
  }

  // Mapping manual CamelCase -> SnakeCase para nuevos campos
  // Supabase js client a veces maneja esto, pero si falla, lo forzamos.
  if (sanitizedProduct.unitEnabled !== undefined) {
    sanitizedProduct.unit_enabled = sanitizedProduct.unitEnabled;
    delete sanitizedProduct.unitEnabled;
  }
  if (sanitizedProduct.packEnabled !== undefined) {
    sanitizedProduct.pack_enabled = sanitizedProduct.packEnabled;
    delete sanitizedProduct.packEnabled;
  }
  if (sanitizedProduct.unitsPerPack !== undefined) {
    sanitizedProduct.units_per_pack = sanitizedProduct.unitsPerPack;
    delete sanitizedProduct.unitsPerPack;
  }
  if (sanitizedProduct.packDiscount !== undefined) {
    sanitizedProduct.pack_discount = sanitizedProduct.packDiscount;
    delete sanitizedProduct.packDiscount;
  }
  if (sanitizedProduct.mayoristaEnabled !== undefined) {
    sanitizedProduct.mayorista_enabled = sanitizedProduct.mayoristaEnabled;
    delete sanitizedProduct.mayoristaEnabled;
  }
  if (sanitizedProduct.wholesaleUnits !== undefined) {
    sanitizedProduct.wholesale_min_units = sanitizedProduct.wholesaleUnits; // Mapear a columna correcta
    sanitizedProduct.wholesale_units = sanitizedProduct.wholesaleUnits; // Legacy alias if needed
    delete sanitizedProduct.wholesaleUnits;
  }
  if (sanitizedProduct.wholesaleDiscount !== undefined) {
    sanitizedProduct.wholesale_discount = sanitizedProduct.wholesaleDiscount;
    delete sanitizedProduct.wholesaleDiscount;
  }
  if (sanitizedProduct.wholesaleImage !== undefined) {
    sanitizedProduct.wholesale_image = sanitizedProduct.wholesaleImage;
    delete sanitizedProduct.wholesaleImage;
  }
  if (sanitizedProduct.wholesaleDescription !== undefined) {
    sanitizedProduct.wholesale_description = sanitizedProduct.wholesaleDescription;
    delete sanitizedProduct.wholesaleDescription;
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