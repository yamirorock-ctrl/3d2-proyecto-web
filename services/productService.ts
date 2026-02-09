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
    customizationOptions: p.customization_options,
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
  
  // Helper to map and delete
  const mapAndDelete = (camel: string, snake: string) => {
    if (sanitizedProduct[camel] !== undefined) {
      sanitizedProduct[snake] = sanitizedProduct[camel];
    }
    delete sanitizedProduct[camel];
  };

  mapAndDelete('unitEnabled', 'unit_enabled');
  mapAndDelete('packEnabled', 'pack_enabled');
  mapAndDelete('unitsPerPack', 'units_per_pack');
  mapAndDelete('packDiscount', 'pack_discount');
  mapAndDelete('mayoristaEnabled', 'mayorista_enabled');
  
  // wholesaleUnits maps to wholesale_min_units (and legacy wholesale_units)
  if (sanitizedProduct.wholesaleUnits !== undefined) {
    sanitizedProduct.wholesale_min_units = sanitizedProduct.wholesaleUnits;
    sanitizedProduct.wholesale_units = sanitizedProduct.wholesaleUnits;
  }
  delete sanitizedProduct.wholesaleUnits;

  mapAndDelete('wholesaleDiscount', 'wholesale_discount');
  mapAndDelete('wholesaleImage', 'wholesale_image');
  mapAndDelete('wholesaleDescription', 'wholesale_description');
  mapAndDelete('customizationOptions', 'customization_options');
  
  // Handle saleType if present (deprecated but might be passed)
  mapAndDelete('saleType', 'sale_type');

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

/**
 * Actualizar Stock de un Producto (Resta la cantidad vendida)
 */
export async function updateProductStock(productId: number, quantitySold: number): Promise<{ success: boolean; error: any }> {
  // Primero obtenemos el stock actual
  const { data: current, error: fetchError } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single();

  if (fetchError) {
    console.error('Error obteniendo stock actual:', fetchError);
    return { success: false, error: fetchError };
  }

  // Cast seguro porque sabemos que la columna existe en produccion
  const currentStock = Number((current as any)?.stock || 0);
  const newStock = Math.max(0, currentStock - quantitySold); // Evitar negativos

  // Actualizamos
  const { error: updateError } = await (supabase
    .from('products') as any)
    .update({ stock: newStock })
    .eq('id', productId);

  if (updateError) {
    console.error('Error actualizando stock:', updateError);
    return { success: false, error: updateError };
  }

  return { success: true, error: null };
}