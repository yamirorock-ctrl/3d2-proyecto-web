const https = require("https");

// La URL de PRODUCCIÓN
const host = "3d2-proyecto-web.vercel.app";
const path = "/api/find-link";

const payload = JSON.stringify({
  text: "Soporte Auriculares Gamer",
  platform: "pinterest",
  image_url:
    "https://http2.mlstatic.com/D_NQ_NP_796593-MLA46610027179_072021-O.webp",
});

const options = {
  hostname: host,
  port: 443,
  path: path,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": payload.length,
  },
};

const req = https.request(options, (res) => {
  console.log(`🤖 Status Code: ${res.statusCode}`);

  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const json = JSON.parse(data);
        console.log("✅ ÉXITO! JSON Recibido:");
        console.log(JSON.stringify(json, null, 2));
      } else {
        console.log("❌ Error HTTP:", res.statusCode);
        console.log("📜 Body:", data);
      }
    } catch (e) {
      console.error("❌ Error Parseando JSON:", e.message);
      console.log("📜 Raw Data:", data);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Error de Red:", error);
});

req.write(payload);
req.end();
