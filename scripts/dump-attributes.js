const categoryId = process.argv[2] || "MLA437544";

async function checkAttributes() {
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/categories/${categoryId}/attributes`,
    );
    const attributes = await res.json();

    attributes.forEach((attr) => {
      const tags = Object.keys(attr.tags || {}).filter(
        (t) => attr.tags[t] === true,
      );
      if (tags.length > 0) {
        console.log(`${attr.id}: ${attr.name} tags=[${tags.join(", ")}]`);
      }
    });
  } catch (error) {
    console.error("Request failed:", error);
  }
}

checkAttributes();
