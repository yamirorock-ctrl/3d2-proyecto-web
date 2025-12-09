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
  destinationPostalCode?: string
): Promise<number> {
  if (shippingMethod === 'to_coordinate') {
    return 0; // Se coordinará después
  }

  if (shippingMethod === 'retiro') {
    return 0;
  }

  if (shippingMethod === 'moto') {
    // 1. Zonas de Envío (Prioridad 1)
    if (destinationPostalCode) {
      const zip = parseInt(destinationPostalCode.replace(/\D/g, ''), 10);
      
      if (!isNaN(zip)) {
        const { data: zones } = await supabase
          .from('shipping_zones')
          .select('*')
          .eq('active', true);

        if (zones) {
          const matchedZone = zones.find((zone: any) => {
            const ranges = zone.zip_ranges || [];
            return ranges.some((r: any) => zip >= r.min && zip <= r.max);
          });

          if (matchedZone) {
            // Verificar threshold específico de la zona (si no es nulo)
            // Si es null o 0, asumimos que no hay beneficio de envío gratis específico, A MENOS que sea 0 explícito?
            // Interpretación: Si free_threshold está definido y > 0, se aplica.
            if (matchedZone.free_threshold && Number(matchedZone.free_threshold) > 0) {
                 if (subtotal >= Number(matchedZone.free_threshold)) {
                    return 0; // Gratis por superar umbral de zona
                 }
            }
            
            // Si no supera umbral (o no tiene), devuelve precio de zona
            return Number(matchedZone.price);
          }
        }
      }
    }

    // 2. Umbral Global (Prioridad 2 - Solo si no cayó en una zona específica o no hay CP)
    // Solo aplica si está configurado mayor a 0
    if (config.moto_free_threshold && Number(config.moto_free_threshold) > 0) {
      if (subtotal >= Number(config.moto_free_threshold)) {
        return 0;
      }
    }

    // 3. Fallback: Precio base
    return (config as any).moto_base_fee ? Number((config as any).moto_base_fee) : 0;
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
