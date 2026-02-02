const categories = ["MLA3530", "MLA1910", "MLA437544"];

async function check() {
  for (const id of categories) {
    console.log(`\n--- Category: ${id} ---`);
    try {
      const res = await fetch(
        `https://api.mercadolibre.com/categories/${id}/attributes`,
      );
      const attributes = await res.json();
      if (!Array.isArray(attributes)) {
        console.log(`Failed to fetch attributes for ${id}:`, attributes);
        continue;
      }
      const required = attributes.filter((a) => a.tags && a.tags.required);
      console.log("Required attributes:");
      required.forEach((a) =>
        console.log(`- ${a.id}: ${a.name} (${a.value_type})`),
      );

      const conditional = attributes.filter(
        (a) => a.tags && a.tags.conditionally_required,
      );
      console.log("Conditionally required:");
      conditional.forEach((a) => console.log(`- ${a.id}: ${a.name}`));
    } catch (e) {
      console.log(`Error checking ${id}:`, e.message);
    }
  }
}

check();
