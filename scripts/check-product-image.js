import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "❌ Error: Missing Supabase credentials in environment variables.",
  );
  console.log("Please ensure .env file exists or variables are set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkProductImage() {
  const searchTerm = "Pañalera";
  console.log(`🔍 Searching for products matching: "${searchTerm}"...`);

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, image_url")
    .ilike("name", `%${searchTerm}%`)
    .limit(5);

  if (error) {
    console.error("❌ Error fetching products:", error);
    return;
  }

  if (!products || products.length === 0) {
    console.log("⚠️ No products found matching that name.");
    return;
  }

  console.log(`✅ Found ${products.length} product(s):`);
  products.forEach((p) => {
    console.log("---------------------------------------------------");
    console.log(`🆔 ID: ${p.id}`);
    console.log(`📦 Name: ${p.name}`);
    console.log(`🖼️ Image URL: ${p.image_url || "NULL (No image!)"}`);

    if (p.image_url) {
      // Simple check for URL format
      if (!p.image_url.startsWith("http")) {
        console.warn("⚠️ WARNING: Image URL does not start with http/https.");
      }
      // Check for common issues
      if (p.image_url.includes(" localhost")) {
        console.warn("⚠️ WARNING: Image URL points to localhost!");
      }
    } else {
      console.error("❌ CRITICAL: Product has NO official image URL.");
    }
  });
  console.log("---------------------------------------------------");
}

checkProductImage();
