const https = require("https");

// Texto EXACTO que falló
const data = JSON.stringify({
  text: "SET de mate! ✨ ¿De qué cuadro sos? Poné mg y comentá tu equipo 👇🏻",
  platform: "instagram",
});

const options = {
  hostname: "3d2-proyecto-web.vercel.app",
  path: "/api/find-link",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  },
};

console.log("🔍 Testeando Cerebro con 'SET de mate'...");

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    console.log(`📬 STATUS: ${res.statusCode}`);
    try {
      const json = JSON.parse(body);
      console.log("🧠 RESPUESTA COMPLETA:");
      console.log(JSON.stringify(json, null, 2));

      if (!json.found) {
        console.log("⚠️ NO ENCONTRADO. Razón:", json.reason);
      }
    } catch (e) {
      console.log("📩 BODY (No JSON):", body);
    }
  });
});

req.on("error", (e) => console.error("💥 Error de red:", e));
req.write(data);
req.end();
