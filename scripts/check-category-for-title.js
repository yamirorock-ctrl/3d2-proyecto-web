import { fileURLToPath } from "url";
import path from "path";

// Extract args
const args = process.argv.slice(2);
const title = args.join(" ") || "Mate impreso 3d";

const predictorUrl = `https://api.mercadolibre.com/sites/MLA/domain_discovery/search?limit=1&q=${encodeURIComponent(title)}`;

async function check() {
  console.log(`\n🔍 Analizando título: "${title}"...\n`);

  try {
    // 1. Predict
    const predRes = await fetch(predictorUrl);
    const predData = await predRes.json();

    if (!predData || predData.length === 0) {
      console.log(
        "❌ No se pudo predecir una categoría. Intenta ser más específico.",
      );
      return;
    }

    const prediction = predData[0];
    const catId = prediction.category_id;
    const catName = prediction.category_name;
    const domainId = prediction.domain_id;

    console.log(`✅ Categoría Sugerida por ML:`);
    console.log(`   ID: ${catId}`);
    console.log(`   Nombre: ${catName}`);
    console.log(`   Dominio: ${domainId}`);
    console.log(`----------------------------------------`);

    // 2. Get Category Details (Attributes)
    console.log(`📋 Consultando requisitos de la categoría ${catId}...`);
    const catRes = await fetch(
      `https://api.mercadolibre.com/categories/${catId}`,
    );
    const catData = await catRes.json();

    console.log(`   Nombre Completo: ${catData.name}`);
    console.log(
      `   Permite variantes: ${catData.settings?.allow_variations ? "SÍ" : "NO"}`,
    );

    // 3. Get Attributes
    const attrsRes = await fetch(
      `https://api.mercadolibre.com/categories/${catId}/attributes`,
    );
    const attrsData = await attrsRes.json();

    const required = attrsData.filter((a) => a.tags && a.tags.required);

    if (required.length > 0) {
      console.log(`\n⚠️  ATRIBUTOS OBLIGATORIOS detectados:`);
      required.forEach((a) => {
        console.log(`   - [${a.id}] ${a.name} (${a.value_type})`);
      });
    } else {
      console.log(
        `\n✨ No hay atributos obligatorios adicionales (aparte de Marca/Modelo/Condición).`,
      );
    }

    console.log(`\n💡 RECOMENDACIÓN:`);
    console.log(
      `   Si ML rechazó tu producto, asegúrate de que tu Sync envíe estos atributos.`,
    );
    console.log(
      `   El sistema intenta usar la categoría ${catId} automáticamente.`,
    );
  } catch (error) {
    console.error("Error:", error.message);
  }
}

check();
