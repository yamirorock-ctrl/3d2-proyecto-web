const apiKey = "AIzaSyDRK93KQ6_a_HcRKWBS4iR7AguOL8vq814";

async function testExp() {
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
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
    console.log("gemini-3.1-flash-image-preview WORKED!");
  } else {
    console.log("FAIL:", JSON.stringify(data, null, 2));
  }
}
testExp();
