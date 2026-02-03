const title = "Mate impreso 3d personalizado con bombilla";
const url = `https://api.mercadolibre.com/sites/MLA/category_predictor/predict?title=${encodeURIComponent(title)}`;

async function testPrediction() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

testPrediction();
