import { getClient } from './supabaseService';
import { Order, OrderItem, OrderStatus, ShippingMethod, ShippingConfig } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

const supabase = getClient() as any;

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
    // 1. REGLA GLOBAL: Si supera el umbral (ej. $40,000), es GRATIS.
    // Prioridad absoluta según requerimiento del cliente.
    if (config.moto_free_threshold && Number(config.moto_free_threshold) > 0) {
      if (subtotal >= Number(config.moto_free_threshold)) {
        return 0;
      }
    }

    // 2. Cálculo por Zonas (Simulación de Distancia / Radio)
    // Si no es gratis, buscamos si cae en una zona de precio específico (ej. < 20km = $20,000)
    if (destinationPostalCode) {
      const zip = parseInt(destinationPostalCode.replace(/\D/g, ''), 10);
      
      if (!isNaN(zip)) {
        const { data } = await supabase
          .from('shipping_zones')
          .select('*')
          .eq('active', true);
        
        const zones = data as any[];

        if (zones) {
          const matchedZone = zones.find((zone: any) => {
            const ranges = zone.zip_ranges || [];
            return ranges.some((r: any) => zip >= r.min && zip <= r.max);
          });

          if (matchedZone) {
            // Devolver precio de la zona (ej. $20.000 o $30.000 según "distancia" simulada)
            // Nota: El free_threshold de zona se ignora si ya falló el global, 
            // a menos que la zona tenga un beneficio MEJOR (menor umbral).
            // Por consistencia, podríamos chequearlo también.
            if (matchedZone.free_threshold && Number(matchedZone.free_threshold) > 0) {
                 if (subtotal >= Number(matchedZone.free_threshold)) {
                    return 0; 
                 }
            }
            return Number(matchedZone.price);
          }
        }
      }
    }

    // 3. Fallback: Sin CP o zona no encontrada
    // Precio base configurado (ej. para > 20km genérico si no se cargó zona)
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
  
  // === NOTIFICACIÓN A MAKE (WhatsApp) ===
  // Disparamos el webhook sin esperar respuesta (fire-and-forget) para no bloquear al usuario
  try {
    const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/3du519txd4fyw541s7gtcfnto432gmeg";
    
    fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'new_order',
        order_id: data.id,
        order_number: data.order_number,
        customer_name: newOrderData.customer_name,
        total: newOrderData.total,
        timestamp: new Date().toISOString()
      })
    }).catch(err => console.error('Error enviando notificación a Make:', err));
    
  } catch (e) {
    console.error('Error preparando notificación:', e);
  }

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
    .from('orders')
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
    .from('orders')
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
    .from('orders')
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
    .from('shipping_config')
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
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Error al eliminar orden:', error);
    return false;
  }

  return true;
}
/**
 * Actualizar una orden completa (edición)
 */
export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<{ data: Order | null, error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar orden:', error);
    return handleSupabaseError(error, 'updateOrder');
  }

  return { data, error: null };
}
