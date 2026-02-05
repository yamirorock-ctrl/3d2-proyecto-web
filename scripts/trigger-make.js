const MAKE_WEBHOOK_URL =
  "https://hook.us2.make.com/3du519txd4fyw541s7gtcfnto432gmeg";

async function sendTest() {
  console.log("Sending test payload to Make...");
  try {
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "5491171285516",
        message:
          "¡Prueba de conexión exitosa! Sistema de Notificaciones 3D2 Activo.",
        timestamp: new Date().toISOString(),
      }),
    });
    const text = await response.text();
    console.log("Response:", text);
  } catch (error) {
    console.error("Error:", error);
  }
}

sendTest();
