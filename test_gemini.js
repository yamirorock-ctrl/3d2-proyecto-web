const apiKey = "AIzaSyDRK93KQ6_a_HcRKWBS4iR7AguOL8vq814";

async function testExp() {
  console.log("Testing gemini-2.0-flash-exp...");
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Draw a simple red square." }],
          },
        ],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );
  const data = await result.json();

  if (
    data.candidates &&
    data.candidates[0].content.parts.some((p) => p.inlineData)
  ) {
    console.log("gemini-2.0-flash-exp WORKED");
  } else {
    console.log("gemini-2.0-flash-exp FAIL:", data);
  }
}

async function testImagen() {
  console.log("\nTesting imagen-3.0-generate-001...");
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: "Draw a simple blue square." }],
        parameters: { sampleCount: 1 },
      }),
    },
  );
  const data = await result.json();
  if (data.predictions) {
    console.log("imagen-3.0-generate-001 WORKED");
  } else {
    console.log("imagen-3.0-generate-001 FAIL:", data);
  }
}

async function run() {
  await testExp();
  await testImagen();
}

run();
