import emailjs from '@emailjs/browser';

// Configuración de EmailJS
// Reemplaza estos valores con tus credenciales de EmailJS
const EMAILJS_SERVICE_ID = '3d2';     // ← Pega aquí tu Service ID
const EMAILJS_TEMPLATE_ID = 'template_11x7q2j';   // ← Pega aquí tu Template ID
const EMAILJS_PUBLIC_KEY = 'MXnc4plFgGsjiz5xw';     // ← Pega aquí tu Public Key

interface EmailData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  technology: string;
  description: string;
  timestamp: string;
}

export async function sendCustomOrderEmail(data: EmailData): Promise<boolean> {
  // Verificar si las credenciales están configuradas
  if (EMAILJS_SERVICE_ID.startsWith('TU_') || 
      EMAILJS_TEMPLATE_ID.startsWith('TU_') || 
      EMAILJS_PUBLIC_KEY.startsWith('TU_')) {
    console.warn('⚠️ EmailJS no está configurado. Por favor actualiza las credenciales en services/emailService.ts');
    return false;
  }

  try {
    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone || 'No proporcionado',
        technology: data.technology,
        description: data.description,
        timestamp: data.timestamp,
      },
      EMAILJS_PUBLIC_KEY
    );

    console.log('✅ Email enviado exitosamente:', result.text);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    return false;
  }
}
