import { OrderItem } from '../types';

const MP_ACCESS_TOKEN = (import.meta as any).env?.VITE_MP_ACCESS;
const MP_PUBLIC_KEY = (import.meta as any).env?.VITE_MP_PUBLIC;

interface PreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

interface PreferenceResponse {
  id: string;
  init_point: string; // URL para redirigir al checkout
  sandbox_init_point?: string;
}

/**
 * Crear preferencia de pago en MercadoPago
 */
export async function createPaymentPreference(
  orderId: string,
  orderNumber: string,
  items: OrderItem[],
  shippingCost: number,
  customerEmail: string
): Promise<{ preferenceId: string; initPoint: string } | null> {
  if (!MP_ACCESS_TOKEN) {
    console.error('MercadoPago Access Token no configurado');
    return null;
  }

  // Convertir items del pedido a formato de MercadoPago
  const mpItems: PreferenceItem[] = items.map((item) => ({
    title: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    currency_id: 'ARS',
  }));

  // Agregar envío como item separado si tiene costo
  if (shippingCost > 0) {
    mpItems.push({
      title: 'Envío',
      quantity: 1,
      unit_price: shippingCost,
      currency_id: 'ARS',
    });
  }

  // MercadoPago no acepta localhost - usar URL de producción en desarrollo
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost 
    ? 'https://yamirorock-ctrl.github.io/3d2-proyecto-web' 
    : window.location.origin;

  const preference = {
    items: mpItems,
    payer: {
      email: customerEmail,
    },
    back_urls: {
      success: `${baseUrl}/order-success?order_id=${orderId}`,
      failure: `${baseUrl}/order-failure?order_id=${orderId}`,
      pending: `${baseUrl}/order-success?order_id=${orderId}`,
    },
    auto_return: 'all',
    external_reference: orderId,
    statement_descriptor: '3D2 STORE',
  };

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error al crear preferencia de MercadoPago:', error);
      return null;
    }

    const data: PreferenceResponse = await response.json();

    return {
      preferenceId: data.id,
      initPoint: data.init_point,
    };
  } catch (error) {
    console.error('Error al comunicarse con MercadoPago:', error);
    return null;
  }
}

/**
 * Obtener información de un pago
 */
export async function getPaymentInfo(paymentId: string): Promise<any> {
  if (!MP_ACCESS_TOKEN) {
    console.error('MercadoPago Access Token no configurado');
    return null;
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error al obtener información del pago:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error al comunicarse con MercadoPago:', error);
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
