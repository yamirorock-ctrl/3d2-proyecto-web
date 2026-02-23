import { Order, OrderItem } from '../types';

interface EmailData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  technology: string;
  description: string;
  timestamp: string;
}

export async function sendCustomOrderEmail(data: EmailData): Promise<boolean> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Email enviado exitosamente');
      return true;
    } else {
      console.error('❌ Error al enviar email:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error de red al enviar email:', error);
    return false;
  }
}

export async function sendSaleNotificationEmail(
  order: Order,
  items: OrderItem[]
): Promise<boolean> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'new_sale',
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        total: order.total,
        shipping_method: order.shipping_method,
        notes: order.notes,
        items: items
      }),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      console.log('📧 Notificación de venta enviada');
      return true;
    }
    console.error('❌ Error enviando notificación de venta:', result.error, result.details || '');
    return false;
  } catch (err) {
    console.error('❌ Error de red (Notificación venta):', err);
    return false;
  }
}
