import { getClient } from './supabaseService';
import { Order, OrderItem, OrderStatus, ShippingMethod, ShippingConfig } from '../types';

const supabase = getClient();

/**
 * Obtener configuración de envíos
 */
export async function getShippingConfig(): Promise<ShippingConfig | null> {
  const { data, error } = await supabase
    .from('shipping_config')
    .select('*')
    .single();

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
  shippingMethod: ShippingMethod,
  subtotal: number,
  destinationLat?: number,
  destinationLng?: number
): Promise<number> {
  if (shippingMethod === 'retiro') {
    return 0;
  }

  if (shippingMethod === 'to_coordinate') {
    return 0; // Se coordinará después
  }

  const config = await getShippingConfig();
  if (!config) return 0;

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
      
      // Hasta 20 km: $20,000
      if (distance <= 20) {
        return 20000;
      }
      
      // Más de 20 km: $20,000 + ($4,000 × km adicionales)
      const extraKm = Math.ceil(distance - 20);
      return 20000 + (extraKm * 4000);
    }
    
    // Si no hay coordenadas, cobrar tarifa base de hasta 20 km
    return 20000;
  }

  if (shippingMethod === 'correo') {
    return config.correo_cost;
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
}): Promise<{ order: Order | null; error: any }> {
  const { data, error } = await supabase
    .from('orders')
    .insert([
      {
        ...orderData,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error al crear pedido:', error);
    return { order: null, error };
  }

  return { order: data, error: null };
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

  if (error) {
    console.error('Error al obtener pedido:', error);
    return null;
  }

  return data;
}

/**
 * Obtener un pedido por ID
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) {
    console.error('Error al obtener pedido:', error);
    return null;
  }

  return data;
}

/**
 * Obtener todos los pedidos (para admin)
 */
export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener pedidos:', error);
    return [];
  }

  return data || [];
}

/**
 * Actualizar el estado de un pedido
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<boolean> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    console.error('Error al actualizar estado del pedido:', error);
    return false;
  }

  return true;
}

/**
 * Actualizar información de pago de un pedido
 */
export async function updateOrderPayment(
  orderId: string,
  paymentId: string,
  paymentStatus: string
): Promise<boolean> {
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
    return false;
  }

  return true;
}

/**
 * Agregar número de tracking a un pedido
 */
export async function updateOrderTracking(
  orderId: string,
  trackingNumber: string
): Promise<boolean> {
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
    return false;
  }

  return true;
}

/**
 * Actualizar configuración de envíos (solo admin)
 */
export async function updateShippingConfig(
  configId: string,
  updates: Partial<ShippingConfig>
): Promise<boolean> {
  const { error } = await supabase
    .from('shipping_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', configId);

  if (error) {
    console.error('Error al actualizar configuración de envíos:', error);
    return false;
  }

  return true;
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
