const WEBHOOK_URL = "https://3d2-proyecto-web.vercel.app/api/ml-webhook";

const mockPayload = {
  resource: "/questions/TEST-12345",
  user_id: 123456,
  topic: "questions",
  application_id: 123456,
  attempts: 1,
  sent: new Date().toISOString(),
  received: new Date().toISOString(),
};

async function testLiveWebhook() {
  console.log("📡 Conectando con Printy (PROD) en:", WEBHOOK_URL);
  console.log("📨 Payload:", JSON.stringify(mockPayload));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(mockPayload),
      headers: { "Content-Type": "application/json" },
    });

    console.log("✅ Respuesta del Servidor:", response.status);
    const text = await response.text();
    console.log("📝 DATA:", text);

    if (text.includes("error") || text.includes("status")) {
      console.log("\n🎉 ¡ÉXITO! Printy está vivo y contestando.");
      console.log(
        "👉 Deberías ver un ERROR en tu Monitor IA (porque el ID es falso).",
      );
    } else {
      console.log("🤔 Respuesta rara:", text);
    }
  } catch (error) {
    console.error("❌ Error de red:", error.message);
  }
}

testLiveWebhook();
