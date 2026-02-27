const apiKey = "AIzaSyDRK93KQ6_a_HcRKWBS4iR7AguOL8vq814";
async function listModels() {
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );
  const data = await result.json();
  const models = data.models.map((m) => m.name);
  console.dir(models, { maxArrayLength: null });
}
listModels();
