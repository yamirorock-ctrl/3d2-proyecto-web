const https = require("https");

// Prueba 1: GET (Más simple, suele fallar menos)
const query = encodeURIComponent("SET de mate! ✨ ¿De qué cuadro sos?");
const optionsGet = {
  hostname: "3d2-proyecto-web.vercel.app",
  path: `/api/find-link?q=${query}&platform=instagram`,
  method: "GET",
};

console.log("🔍 INTENTO 1: GET Request...");

const reqGet = https.request(optionsGet, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    console.log(`📬 GET STATUS: ${res.statusCode}`);
    console.log(`📩 GET BODY: ${body}`); // Ver el error crudo
  });
});
reqGet.on("error", (e) => console.error("💥 Error GET:", e));
reqGet.end();

// Prueba 2: POST (Como lo hace Make)
const data = JSON.stringify({
  text: "SET de mate! ✨ ¿De qué cuadro sos?",
  platform: "instagram",
});

const optionsPost = {
  hostname: "3d2-proyecto-web.vercel.app",
  path: "/api/find-link",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

console.log("\n🔍 INTENTO 2: POST Request...");

const reqPost = https.request(optionsPost, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    console.log(`📬 POST STATUS: ${res.statusCode}`);
    console.log(`📩 POST BODY: ${body}`);
  });
});
reqPost.on("error", (e) => console.error("💥 Error POST:", e));
reqPost.write(data);
reqPost.end();
