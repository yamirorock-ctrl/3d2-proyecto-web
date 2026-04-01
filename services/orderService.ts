import { getClient } from './supabaseService';
import { Order, OrderItem, OrderStatus, ShippingMethod, ShippingConfig, Payment } from '../types';
import { PostgrestError } from '@supabase/supabase-js';
import { sendSaleNotificationEmail } from './emailService';

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
  status?: string;
}): Promise<{ data: Order | null; error: PostgrestError | null }> {
  // 1. Se elimina el uso de `as any` para mayor seguridad de tipos.
  // 2. Se delega la gestión de `created_at` y `updated_at` a la base de datos.
  //    (Requiere configurar `now()` como valor por defecto en las columnas de Supabase).
  const newOrderData = {
    ...orderData,
    status: (orderData as any).status || 'pending',
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
  
  // === DESCUENTO DE STOCK DE INSUMOS (MATERIA PRIMA) ===
  // Intentamos descontar insumos automáticamente. Si falla, no bloqueamos la venta, solo logueamos error.
  if (newOrderData.status !== 'payment_pending') {
    try {
       await deductRawMaterials(newOrderData.items);
    } catch (stockError) {
       console.error('Error descontando insumos:', stockError);
    }
  }
  
  // === NOTIFICACIÓN A MAKE (WhatsApp) ===
  // Disparamos el webhook sin esperar respuesta (fire-and-forget) para no bloquear al usuario
  try {
    /* 
    // Webhook desactivado temporalmente (410 Gone)
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
    */
    
    // === NOTIFICACIÓN POR EMAIL (Nueva Implementación) ===
    sendSaleNotificationEmail(data, newOrderData.items)
      .then(sent => sent ? console.log('Email de venta enviado') : console.warn('Fallo envío email venta'))
      .catch(e => console.error('Error procesando email:', e));

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

/**
 * Lógica auxiliar para descontar Materia Prima basada en productos vendidos (Receta Estática)
 */
async function deductRawMaterials(items: OrderItem[]) {
  // 1. Obtener estado actual de materiales para saber IDs y Nombres
  const { data: materials, error } = await supabase
    .from('raw_materials')
    .select('id, name, quantity, unit, category');

  if (error || !materials) return;

  // 2. Obtener definiciones de productos con sus RECETAS completas
  const productIds = items.map(i => i.product_id);
  // Nota: Consultamos tanto camelCase como snake_case por si acaso, aunque en JSONB suele preservarse
  const { data: productDefinitions } = await supabase
    .from('products')
    .select('id, name, weight, net_weight, consumables, colorPercentage:color_percentage') 
    .in('id', productIds);
  
  // Mapa de productos para acceso rápido
  const productMap = new Map(productDefinitions?.map((p: any) => [p.id, p]) || []);

  const updates = new Map<string, number>(); // ID Material -> Cantidad a RESTAR

  // Helper para buscar material por nombre (Exacto > Parcial > Fallback)
  const findMaterialIdByName = (searchName: string, categoryFilter?: string) => {
    if (!searchName) return null;
    const lowerSearch = searchName.toLowerCase().trim();
    
    // 1. Búsqueda Exacta
    let mat = materials.find((m: any) => m.name.toLowerCase() === lowerSearch);
    if (mat) return mat;

    // 2. Búsqueda por palabras (ej: "Llavero Argolla" matchea con "Argollas Llavero")
    const searchWords = lowerSearch.split(/\s+/).filter(w => w.length > 2);
    let candidates = materials.filter((m: any) => {
        if (categoryFilter && m.category !== categoryFilter) return false;
        const matName = m.name.toLowerCase();
        return searchWords.every(word => matName.includes(word));
    });

    if (candidates.length > 0) return candidates[0];

    // 3. Búsqueda Inversa (ej: "Argolla" matchea con "Argolla Llavero")
    candidates = materials.filter((m: any) => {
        if (categoryFilter && m.category !== categoryFilter) return false;
        const matName = m.name.toLowerCase();
        return matName.includes(lowerSearch) || lowerSearch.includes(matName);
    });

    if (candidates.length > 0) return candidates[0];

    return null;
  };

  const addDeduction = (materialId: string, amount: number) => {
      const current = updates.get(materialId) || 0;
      updates.set(materialId, current + amount);
  };

  // 3. Analizar Items
  for (const item of items) {
    const qty = item.quantity;
    
    // --- NUEVO: CONSUMIBLES DEL ITEM DIRECTO (Ventas manuales/personalizadas) ---
    if (item.consumables && Array.isArray(item.consumables) && item.consumables.length > 0) {
        console.log(`[Stock] Usando receta personalizada del item: ${item.name}`);
        item.consumables.forEach((c: any) => {
            if (c.material && c.quantity) {
                const mat = findMaterialIdByName(c.material);
                if (mat) {
                    addDeduction(mat.id, c.quantity * qty);
                } else {
                    console.warn(`[Stock] Consumible no encontrado (custom): ${c.material}`);
                }
            }
        });
        // Si el item ya define su propia receta en vivo, ignoramos la receta de base de datos para no duplicar.
        continue;
    }

    const productDef = productMap.get(item.product_id) as any; // Cast a any explícito para acceder a propiedades dinámicas
    
    if (!productDef) continue;

    console.log(`[Stock] Procesando receta para: ${productDef.name}`);

    // --- A. CONSUMIBLES FIJOS (Cajas, Vasos, Accesorios) ---
    if (productDef.consumables && Array.isArray(productDef.consumables)) {
        productDef.consumables.forEach((c: any) => {
            if (c.material && c.quantity) {
                const mat = findMaterialIdByName(c.material);
                if (mat) {
                    addDeduction(mat.id, c.quantity * qty);
                } else {
                    console.warn(`[Stock] Consumible no encontrado: ${c.material}`);
                }
            }
        });
    }

    // --- B. FILAMENTO (Color Dinámico) ---
    // Requiere configuración de colores/materiales
    if (productDef.colorPercentage && Array.isArray(productDef.colorPercentage)) {
        productDef.colorPercentage.forEach((cp: any) => {
            const originalColorName = cp.color;
            let targetMaterialName = originalColorName;
            
            // Lógica de Sustitución por Variante Elegida
            // Si el usuario eligió un color, y este componente de la receta es predominante (>40%)
            // o es la base de filamento, intentamos usar el color elegido.
            const isPredominant = (cp.percentage || 0) > 40 || (productDef.colorPercentage.length === 1);
            if (isPredominant && item.selected_options?.color) {
                targetMaterialName = item.selected_options.color;
                console.log(`[Stock] Usando color seleccionado por cliente: ${targetMaterialName}`);
            }

            const mat = findMaterialIdByName(targetMaterialName, 'Filamento');
            if (mat) {
                // Cálculo de cantidad a descontar
                let amountToDeduct = 0;
                
                if (cp.grams) {
                    // Si tenemos los gramos exactos, los usamos (convertidos a la unidad del inventario)
                    amountToDeduct = cp.grams * qty;
                } else if (cp.percentage) {
                    // Priorizar net_weight sobre weight para el cálculo de filamento
                    const referenceWeight = productDef.net_weight || productDef.weight || 0;
                    if (referenceWeight > 0) {
                        amountToDeduct = (referenceWeight * qty) * (cp.percentage / 100);
                    }
                }

                if (amountToDeduct > 0) {
                    // Conversión de Unidades
                    if (mat.unit && (mat.unit.toLowerCase().includes('kg') || mat.unit.toLowerCase().includes('kilo'))) {
                        amountToDeduct = amountToDeduct / 1000;
                    } else if (mat.unit && mat.unit.toLowerCase().includes('rollo')) {
                        amountToDeduct = amountToDeduct / 1000;
                    }
                    addDeduction(mat.id, amountToDeduct);
                }
            } else {
                 console.warn(`[Stock] Insumo de filamento no encontrado: ${targetMaterialName}`);
            }
        });
    }
  }

  // 4. Ejecutar Updates en Batch (Paralelo)
  if (updates.size > 0) {
    const promises = Array.from(updates.entries()).map(async ([id, totalDeduct]) => {
      const mat = materials.find((m: any) => m.id === id);
      if (mat) {
        const currentQty = Number(mat.quantity);
        const newQty = Math.max(0, currentQty - totalDeduct);
        
        // Redondear a 3 decimales para evitar problemas de punto flotante en kilos
        const roundedNewQty = Math.round(newQty * 1000) / 1000;

        const { error: updateError } = await supabase
          .from('raw_materials')
          .update({ quantity: roundedNewQty })
          .eq('id', id);
          
        if (!updateError) {
          console.log(`[Stock] Descontado ${totalDeduct.toFixed(3)} ${mat.unit} de ${mat.name}. Nuevo stock: ${roundedNewQty}`);
        } else {
          console.error(`[Stock] Error actualizando ${mat.name}:`, updateError);
        }
      }
    });

    await Promise.all(promises);
  }
}

/**
 * ===== PAYMENTS =====
 */

export async function getPayments(): Promise<{ data: Payment[] | null, error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('date', { ascending: false });

  if (error) return handleSupabaseError(error, 'getPayments');
  return { data: data || [], error: null };
}

export async function getOrderPayments(orderId: string): Promise<{ data: Payment[] | null, error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('date', { ascending: false });

  if (error) return handleSupabaseError(error, 'getOrderPayments');
  return { data: data || [], error: null };
}

export async function addPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<{ data: Payment | null, error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('payments')
    .insert([payment])
    .select()
    .single();

  if (error) return handleSupabaseError(error, 'addPayment');
  return { data, error: null };
}

export async function deletePayment(paymentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId);

  if (error) {
    console.error('Error al eliminar pago:', error);
    return false;
  }
  return true;
}

