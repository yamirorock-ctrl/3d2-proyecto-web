const categories = ["MLA3530", "MLA1910", "MLA437544", "MLA1384"];

async function checkCategories() {
  for (const id of categories) {
    try {
      const res = await fetch(`https://api.mercadolibre.com/categories/${id}`);
      const data = await res.json();
      console.log(`\n--- ${data.name} (${data.id}) ---`);
      console.log(
        `Path: ${data.path_from_root.map((p) => p.name).join(" > ")}`,
      );
      console.log(
        `Settings: Buying Modes: ${JSON.stringify(data.settings.buying_modes)}`,
      );
      console.log(
        `Settings: Item Conditions: ${JSON.stringify(data.settings.item_conditions)}`,
      );

      const attrRes = await fetch(
        `https://api.mercadolibre.com/categories/${id}/attributes`,
      );
      const attributes = await attrRes.json();
      const required = attributes
        .filter((a) => a.tags && a.tags.required)
        .map((a) => a.id);
      console.log(`Required Attributes: ${required.join(", ")}`);
    } catch (e) {
      console.error(`Error fetching ${id}:`, e.message);
    }
  }
}

checkCategories();
