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
