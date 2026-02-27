const apiKey = "AIzaSyDRK93KQ6_a_HcRKWBS4iR7AguOL8vq814";
async function listModels() {
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );
  const data = await result.json();
  const models = data.models
    .filter((m) => /image|exp|imagen|2.5-flash/i.test(m.name))
    .map((m) => m.name);
  console.log(models.join("\n"));
}
listModels();
