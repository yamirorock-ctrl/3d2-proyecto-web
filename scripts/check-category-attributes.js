const categoryId = process.argv[2] || "MLA437544";

async function checkAttributes() {
  console.log(`Checking attributes for category: ${categoryId}...`);
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/categories/${categoryId}/attributes`,
    );
    const attributes = await res.json();

    if (!Array.isArray(attributes)) {
      console.error("Error fetching attributes:", attributes);
      return;
    }

    const required = attributes.filter(
      (attr) => attr.tags && attr.tags.required,
    );

    console.log("\n--- REQUIRED ATTRIBUTES ---");
    if (required.length === 0) {
      console.log("No required attributes found in tags.");
    } else {
      required.forEach((attr) => {
        console.log(`- ${attr.id}: ${attr.name} (${attr.value_type})`);
      });
    }

    const conditionallyRequired = attributes.filter(
      (attr) => attr.tags && attr.tags.conditionally_required,
    );
    console.log("\n--- CONDITIONALLY REQUIRED ATTRIBUTES ---");
    conditionallyRequired.forEach((attr) => {
      console.log(`- ${attr.id}: ${attr.name}`);
    });
  } catch (error) {
    console.error("Request failed:", error);
  }
}

checkAttributes();
