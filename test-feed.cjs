require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_TOKEN,
);

async function dumpFeed() {
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  console.log("Total products:", products.length);

  const escapeCsv = (text) => {
    if (!text) return '""';
    const CleanText = String(text).replace(/\n/g, " ").replace(/\r/g, "");
    return '"' + CleanText.replace(/"/g, '""') + '"';
  };

  const baseUrl = "https://www.creart3d2.com";

  const csvRows = (products || []).map((product) => {
    const availability =
      product.stock && product.stock > 0 ? "in stock" : "out of stock";
    let imageUrl = product.image;
    if (
      product.images &&
      Array.isArray(product.images) &&
      product.images.length > 0
    ) {
      const firstImg = product.images[0];
      imageUrl = typeof firstImg === "string" ? firstImg : firstImg.url;
    }
    const price = Number(product.price).toFixed(2) + " ARS";
    return [
      product.id,
      escapeCsv(product.name),
      escapeCsv(product.description),
      availability,
      "new",
      price,
      baseUrl + "/?product_id=" + product.id,
      imageUrl || "",
      "3D2",
      "632",
    ].join(",");
  });

  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
    "google_product_category",
  ];
  const csvContent = headers.join(",") + "\n" + csvRows.join("\n");
  fs.writeFileSync("test-feed.csv", csvContent);
  console.log("Written to test-feed.csv");
}

dumpFeed();
