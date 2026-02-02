const categoryId = process.argv[2] || "MLA437544";

async function findRequired() {
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/categories/${categoryId}/attributes`,
    );
    const attributes = await res.json();

    const required = attributes.filter(
      (attr) =>
        attr.tags &&
        (attr.tags.required ||
          attr.tags.catalog_required ||
          attr.tags.conditional_required),
    );

    console.log(`\n--- MANDATORY ATTRIBUTES FOR ${categoryId} ---`);
    required.forEach((attr) => {
      const tagList = Object.keys(attr.tags).filter(
        (t) => attr.tags[t] === true,
      );
      console.log(`${attr.id}: ${attr.name} [${tagList.join(", ")}]`);
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

findRequired();
