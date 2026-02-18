import fetch from "node-fetch"; // Para Node antiguo si es necesario (o usar fetch nativo)

const ENDPOINT = "https://3d2-proyecto-web.vercel.app/api/find-link";

async function testFindLink() {
  console.log("🤖 Probando Cerebro en:", ENDPOINT);

  const payload = {
    text: "Soporte Auriculares Gamer",
    platform: "pinterest",
    image_url:
      "https://http2.mlstatic.com/D_NQ_NP_796593-MLA46610027179_072021-O.webp",
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text(); // Leemos texto crudo
    console.log("📜 Respuesta RAW:", text.substring(0, 200)); // Mostramos primeros 200 chars

    try {
      const data = JSON.parse(text);
      console.log("✅ Resultado JSON:", JSON.stringify(data, null, 2));
    } catch {
      console.error("❌ Error parseando JSON. Status HTTP:", res.status);
    }
  } catch (e) {
    console.error("❌ Error Fetch:", e);
  }
}

testFindLink();
