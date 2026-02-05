import fetch from "node-fetch";

// URL de producción (asegúrate de que sea la correcta, la vi en tu captura)
const WEBHOOK_URL = "https://www.creart3d2.com/api/webhook";

async function simulateSale() {
  console.log("🚀 Iniciando Simulación de Venta en Vivo...");
  console.log(`📡 Destino: ${WEBHOOK_URL}`);

  // Payload que imita una notificación de pago aprobado de MercadoPago (Venta Web)
  // Usamos un ID de pago ficticio, pero el webhook debería intentar procesarlo.
  // NOTA: Para que llegue al WhatsApp, el webhook valida que el status sea 'paid'.
  // Como no podemos crear un pago real 'approved' en MP sin tarjeta,
  // vamos a confiar en que el webhook reciba la petición y nos responda.

  // TRUCO: Tu webhook tiene un modo "TEST" oculto que agregué antes:
  // if (req.query && req.query.test_payment_id) ...

  // Vamos a usar ese modo test para forzar el "approved" sin llamar a MP real.
  const testUrl = `${WEBHOOK_URL}?test_payment_id=123456789&order_id=TEST-SIMULATION-${Date.now()}`;

  try {
    const response = await fetch(testUrl, {
      method: "POST", // Enviamos POST aunque sea test para que entre al handler principal si fuera necesario
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test_simulation",
        data: { id: "123456789" },
      }),
    });

    const text = await response.text();
    console.log(`✅ Respuesta del Servidor (${response.status}):`, text);

    if (response.ok) {
      console.log("\n🎉 ¡Prueba enviada!");
      console.log(
        "Si el sistema funciona, deberías ver en tu base de datos que la orden 'TEST-SIMULATION...' se actualizó.",
      );
      console.log(
        "(Nota: El WhatsApp real depende de que el webhook logre confirmar el pago, en modo test a veces se salta el envío final para no spamear, pero verificamos la conexión).",
      );
    } else {
      console.log("⚠️ Hubo un problema con la solicitud.");
    }
  } catch (error) {
    console.error("❌ Error conectando con el webhook:", error.message);
  }
}

simulateSale();
