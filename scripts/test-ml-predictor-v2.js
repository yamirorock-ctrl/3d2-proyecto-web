const title = "Mate impreso 3d";
const predictorUrl = `https://api.mercadolibre.com/sites/MLA/category_predictor/predict?title=${encodeURIComponent(title)}`;
const domainUrl = `https://api.mercadolibre.com/sites/MLA/domain_discovery/search?q=${encodeURIComponent(title)}`;

async function testPrediction() {
  console.log("Testing Predictor:");
  try {
    const res = await fetch(predictorUrl);
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
  } catch (e) {
    console.error(e);
  }

  console.log("\nTesting Domain Discovery:");
  try {
    const res = await fetch(domainUrl);
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
  } catch (e) {
    console.error(e);
  }
}

testPrediction();
