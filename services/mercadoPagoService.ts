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
  customerEmail: string
): Promise<{ preferenceId: string; initPoint: string } | null> {
  
  // Convertir items del pedido a formato de MercadoPago
  const mpItems: PreferenceItem[] = items.map((item) => ({
    id: String(item.product_id || `item-${item.name.replace(/\s+/g, '-').toLowerCase()}`),
    title: item.name,
    description: `Producto impreso en 3D - ${item.name}`,
    category_id: 'art',
    quantity: item.quantity,
    unit_price: item.price,
    currency_id: 'ARS',
  }));

  if (shippingCost > 0) {
    mpItems.push({
      id: `shipping-${orderId}`,
      title: 'Envío',
      description: 'Costo de envío del pedido',
      category_id: 'services',
      quantity: 1,
      unit_price: shippingCost,
      currency_id: 'ARS',
    });
  }

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost 
    ? 'https://yamirorock-ctrl.github.io/3d2-proyecto-web' 
    : window.location.origin;

  const preferencePayload = {
    items: mpItems,
    payer: { email: customerEmail },
    back_urls: {
      success: `${baseUrl}/order-success?order_id=${orderId}`,
      failure: `${baseUrl}/order-failure?order_id=${orderId}`,
      pending: `${baseUrl}/order-success?order_id=${orderId}`,
    },
    auto_return: 'all',
    external_reference: orderId,
    statement_descriptor: '3D2 STORE',
    notification_url: (import.meta as any).env.VITE_MP_WEBHOOK_URL || `${window.location.origin}/api/webhook`,
  };

  try {
    const response = await fetch('/api/mercadopago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'create_preference', 
        payload: preferencePayload 
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error al crear preferencia vía proxy:', error);
      return null;
    }

    const data = await response.json();
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
