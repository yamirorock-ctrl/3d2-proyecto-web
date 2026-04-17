import { OrderItem } from '../types';

const MP_PUBLIC_KEY = (import.meta as any).env?.VITE_MP_PUBLIC;

interface PreferenceItem {
  id?: string;
  title: string;
  description?: string;
  category_id?: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

/**
 * Crear preferencia de pago en MercadoPago vía Backend Proxy
 */
export async function createPaymentPreference(
  orderId: string,
  _orderNumber: string,
  items: OrderItem[],
  shippingCost: number,
  customerEmail: string,
  zipCode?: string,
  dimensions?: string,
  deviceId?: string
): Promise<{ preferenceId: string; initPoint: string } | null> {
  
  const subtotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const totalAmount = subtotal + shippingCost;

  // Convertir items al estándar de la API de Orders
  const mpItems = items.map((item) => ({
    id: String(item.product_id || item.id),
    title: item.name,
    description: `3D2 Product - ${item.name}`,
    category_id: 'art',
    quantity: item.quantity,
    unit_price: item.price
  }));

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost 
    ? 'https://yamirorock-ctrl.github.io/3d2-proyecto-web' 
    : window.location.origin;

  // Construcción del Payload para la API de Orders
  const orderPayload: any = {
    external_reference: orderId,
    total_amount: totalAmount,
    items: mpItems,
    payer: { email: customerEmail },
    processing_mode: 'automatic', // Documentado en capturas para activación me2
    back_urls: {
      success: `${baseUrl}/order-success?order_id=${orderId}`,
      failure: `${baseUrl}/order-failure?order_id=${orderId}`,
      pending: `${baseUrl}/order-success?order_id=${orderId}`,
    },
    notification_url: (import.meta as any).env.VITE_MP_WEBHOOK_URL || `${window.location.origin}/api/webhook`,
  };

  // Log para depuración (solo en desarrollo)
  if (isLocalhost) {
    console.log('[MP Service] Usando notification_url:', orderPayload.notification_url);
  }

  // Configuración de Envíos (me2)
  if (zipCode && dimensions) {
    // Validar y asegurar formato "AxAxL,P"
    const dimensionsRegex = /^\d+x\d+x\d+,\d+$/;
    const finalDimensions = dimensionsRegex.test(dimensions) ? dimensions : "15x15x15,500";

    orderPayload.shipments = {
      mode: "me2",
      dimensions: finalDimensions,
      receiver_address: {
        zip_code: zipCode
      }
    };
  } else if (shippingCost > 0) {
    // Si no es me2, agregamos el envío como un item adicional para el total
    mpItems.push({
      id: `shipping-${orderId}`,
      title: 'Costo de Envío',
      description: 'Envío personalizado',
      category_id: 'services',
      quantity: 1,
      unit_price: shippingCost
    } as any);
  }

  try {
    const response = await fetch('/api/mercadopago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'create_order', 
        payload: orderPayload,
        deviceId: deviceId
      }),
    });

    const data = await response.json();

    // FALLBACK INTELIGENTE: Si falla por falta de me2 activo en la cuenta
    if (!response.ok && (data.message?.includes('me2') || data.error?.includes('me2'))) {
      console.warn('[MP Service] ME2 no activo en cuenta. Reintentando sin logística automática...');
      
      // Quitamos shipments y agregamos el costo como item (si no estaba ya)
      const fallbackPayload = { ...orderPayload };
      delete fallbackPayload.shipments;
      
      if (shippingCost > 0 && !mpItems.find(i => i.id?.includes('shipping'))) {
        mpItems.push({
          id: `shipping-${orderId}`,
          title: 'Costo de Envío (Manual)',
          quantity: 1,
          unit_price: shippingCost
        } as any);
      }

      const retryResponse = await fetch('/api/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_order', payload: fallbackPayload, deviceId }),
      });
      
      const retryData = await retryResponse.json();
      if (retryResponse.ok) {
        return { preferenceId: retryData.id, initPoint: retryData.init_point };
      }
    }

    if (!response.ok) {
      console.error('Error al crear orden vía proxy:', data);
      return null;
    }

    return {
      preferenceId: data.id,
      initPoint: data.init_point,
    };
  } catch (error) {
    console.error('Error al comunicarse con el backend de MercadoPago:', error);
    return null;
  }
}

/**
 * Obtener información de un pago vía Backend Proxy
 */
export async function getPaymentInfo(paymentId: string): Promise<any> {
  try {
    const response = await fetch('/api/mercadopago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'get_payment', 
        payload: { paymentId } 
      }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error al obtener info de pago vía proxy:', error);
    return null;
  }
}

/**
 * Verificar el estado de un pago
 */
export async function checkPaymentStatus(paymentId: string): Promise<{
  status: string;
  status_detail: string;
  approved: boolean;
} | null> {
  const paymentInfo = await getPaymentInfo(paymentId);

  if (!paymentInfo) return null;

  return {
    status: paymentInfo.status,
    status_detail: paymentInfo.status_detail,
    approved: paymentInfo.status === 'approved',
  };
}

/**
 * Obtener Public Key para el frontend
 */
export function getMercadoPagoPublicKey(): string {
  return MP_PUBLIC_KEY || '';
}
