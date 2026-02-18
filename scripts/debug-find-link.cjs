const https = require("https");

const data = JSON.stringify({
  text: "SET de mate! ✨ ¿De qué cuadro sos?",
  platform: "instagram",
});

const options = {
  hostname: "3d2-proyecto-web.vercel.app",
  path: "/api/find-link",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

console.log("🔍 Enviando prueba al Cerebro ('SET de mate')...");

const req = https.request(options, (res) => {
  let body = "";

  res.on("data", (chunk) => {
    body += chunk;
  });

  res.on("end", () => {
    console.log(`\n📬 STATUS: ${res.statusCode}`);
    try {
      const json = JSON.parse(body);
      console.log("🧠 RESPUESTA DEL CEREBRO:");
      console.log(JSON.stringify(json, null, 2));

      if (json.found) {
        console.log("\n✅ ¡ENCONTRADO! El sistema funciona para este caso.");
      } else {
        console.log(
          "\n❌ NO ENCONTRADO. Algo está mal en la lógica o el catálogo.",
        );
        console.log(`Razón: ${json.reason}`);
      }
    } catch (e) {
      console.log("❌ Error al leer respuesta:", body);
    }
  });
});

req.on("error", (error) => {
  console.error("💥 Error de conexión:", error);
});

req.write(data);
req.end();
