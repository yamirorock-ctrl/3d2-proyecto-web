const https = require("https");

const WEBHOOK_HOST = "www.creart3d2.com";
const WEBHOOK_PATH = "/api/ml-webhook";

const mockPayload = {
  resource: "/questions/TEST-12345",
  user_id: 123456,
  topic: "questions",
  application_id: 123456,
  attempts: 1,
  sent: new Date().toISOString(),
  received: new Date().toISOString(),
};

const data = JSON.stringify(mockPayload);

const options = {
  hostname: WEBHOOK_HOST,
  port: 443,
  path: WEBHOOK_PATH,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

console.log(`📡 Conectando a https://${WEBHOOK_HOST}${WEBHOOK_PATH}...`);
console.log("📨 Payload:", data);

const req = https.request(options, (res) => {
  console.log(`✅ Status Code: ${res.statusCode}`);

  let responseBody = "";

  res.on("data", (chunk) => {
    responseBody += chunk;
  });

  res.on("end", () => {
    console.log("📝 Respuesta Completa:", responseBody);

    try {
      const json = JSON.parse(responseBody);
      if (json.error || json.status) {
        console.log("\n🎉 ¡ÉXITO! El Webhook respondió.");
        console.log("👉 Esto confirma que Printy está escuchando.");
        console.log(
          "👉 Revisa tu Monitor IA. Debería haber un registro ROJO (Error) por el ID falso.",
        );
      }
    } catch (e) {
      console.log("⚠️ No pude parsear JSON. Quizás HTML de error?");
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Error de conexión:", error);
});

req.write(data);
req.end();
