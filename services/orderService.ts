import { getClient } from './supabaseService';
import { Order, OrderItem, OrderStatus, ShippingMethod, ShippingConfig } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

const supabase = getClient();

/**
 * ===== UTILITIES =====
 */

/**
 * Función de utilidad para manejar errores de Supabase de forma centralizada.
 * Registra el error en la consola y devuelve un objeto de error estandarizado.
 */
function handleSupabaseError(error: PostgrestError, context: string) {
  console.error(`Error en ${context}:`, error);
  return { data: null, error };
}

/**
 * Obtener configuración de envíos
 */
export async function getShippingConfig(): Promise<ShippingConfig | null> {
  const { data, error } = await supabase
    .from('shipping_config')
    .select('*')
    .single();
  
  // Aunque esta función no se refactoriza, podría usar handleSupabaseError si devolviera { data, error }
  if (error) {
    console.error('Error al obtener configuración de envíos:', error);
    return null;
  }
  return data;
}

/**
 * Calcular distancia entre dos puntos (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcular costo de envío según método y configuración
 */
export async function calculateShippingCost(
  config: ShippingConfig,
  shippingMethod: ShippingMethod,
  subtotal: number,
  destinationLat?: number,
  destinationLng?: number
): Promise<number> {
  if (shippingMethod === 'to_coordinate') {
    return 0; // Se coordinará después
  }

  if (shippingMethod === 'retiro') {
    return 0;
  }

  if (shippingMethod === 'moto') {
    // Si la compra es >= $40,000, envío gratis
    if (subtotal >= config.moto_free_threshold) {
      return 0;
    }
    
    // Si < $40,000, calcular costo según distancia
    if (destinationLat && destinationLng) {
      const distance = calculateDistance(
        config.store_lat,
        config.store_lng,
        destinationLat,
        destinationLng
      );
      
      // Hasta `moto_base_distance_km`: `moto_base_fee`
      if (distance <= config.moto_base_distance_km) {
        return config.moto_base_fee;
      }
      
      // Más de la distancia base: `moto_base_fee` + (`moto_fee_per_km` × km adicionales)
      const extraKm = Math.ceil(distance - config.moto_base_distance_km);
      return config.moto_base_fee + (extraKm * config.moto_fee_per_km);
    }
    
    // Si no hay coordenadas, cobrar tarifa base
    return config.moto_base_fee;
  }

  if (shippingMethod === 'correo') {
    // Costo calculado dinámicamente por MercadoLibre
    return 0;
  }

  return 0;
}

/**
 * Crear un nuevo pedido
 */
export async function createOrder(orderData: {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address?: string;
  customer_city?: string;
  customer_province?: string;
  customer_postal_code?: string;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  total: number;
  shipping_method: ShippingMethod;
  notes?: string;
}): Promise<{ data: Order | null; error: PostgrestError | null }> {
  // 1. Se elimina el uso de `as any` para mayor seguridad de tipos.
  // 2. Se delega la gestión de `created_at` y `updated_at` a la base de datos.
  //    (Requiere configurar `now()` como valor por defecto en las columnas de Supabase).
  const newOrderData = {
    ...orderData,
    status: 'pending' as OrderStatus,
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(newOrderData)
    .select()
    .single();
  
  if (error) {
    return handleSupabaseError(error, 'createOrder');
  }

  // Se devuelve un objeto consistente con el patrón { data, error }
  return { data, error: null };
}

/**
 * Obtener un pedido por número de orden
 */
export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .single();

  // Se podría refactorizar para usar el patrón { data, error }
  if (error) {
    console.error('Error al obtener pedido por número:', error);
    return null;
  }

  return data;
}

/**
 * Obtener un pedido por ID
 */
export async function getOrderById(orderId: string): Promise<{ data: Order | null, error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  return error ? handleSupabaseError(error, 'getOrderById') : { data, error: null };
}

/**
 * Obtener todos los pedidos (para admin)
 */
export async function getAllOrders(): Promise<{ data: Order[] | null, error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return handleSupabaseError(error, 'getAllOrders');
  }

  return { data: data || [], error: null };
}

/**
 * Actualizar el estado de un pedido
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<{ data: any | null, error: PostgrestError | null }> {
  const { error } = await supabase
    .from<Order>('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    console.error('Error al actualizar estado del pedido:', error);
    return handleSupabaseError(error, 'updateOrderStatus');
  }

  return { data: { success: true }, error: null };
}

/**
 * Actualizar información de pago de un pedido
 */
export async function updateOrderPayment(
  orderId: string,
  paymentId: string,
  paymentStatus: string
): Promise<{ data: any | null, error: PostgrestError | null }> {
  const { error } = await supabase
    .from<Order>('orders')
    .update({
      payment_id: paymentId,
      payment_status: paymentStatus,
      status: paymentStatus === 'approved' ? 'paid' : 'payment_pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error('Error al actualizar pago del pedido:', error);
    return handleSupabaseError(error, 'updateOrderPayment');
  }

  return { data: { success: true }, error: null };
}

/**
 * Agregar número de tracking a un pedido
 */
export async function updateOrderTracking(
  orderId: string,
  trackingNumber: string
): Promise<{ data: any | null, error: PostgrestError | null }> {
  const { error } = await supabase
    .from<Order>('orders')
    .update({
      tracking_number: trackingNumber,
      status: 'shipped',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error('Error al actualizar tracking del pedido:', error);
    return handleSupabaseError(error, 'updateOrderTracking');
  }

  return { data: { success: true }, error: null };
}

/**
 * Actualizar configuración de envíos (solo admin)
 */
export async function updateShippingConfig(
  configId: string,
  updates: Partial<ShippingConfig>
): Promise<{ data: any | null, error: PostgrestError | null }> {
  // Se elimina `as any` y se deja que la BBDD maneje `updated_at`
  const { error } = await supabase
    .from<ShippingConfig>('shipping_config')
    .update(updates)
    .eq('id', configId);

  if (error) {
    console.error('Error al actualizar configuración de envíos:', error);
    return handleSupabaseError(error, 'updateShippingConfig');
  }

  return { data: { success: true }, error: null };
}
/**
 * Eliminar una orden (solo admin)
 */
export async function deleteOrder(orderId: string): Promise<boolean> {
  const { error } = await supabase
    .from<Order>('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Error al eliminar orden:', error);
    return false;
  }

  return true;
}
