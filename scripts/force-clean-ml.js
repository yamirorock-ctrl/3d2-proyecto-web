const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load env simply
const envPath = path.resolve(".env");
const envConfig = {};
if (fs.existsSync(envPath)) {
  const envLocal = fs.readFileSync(envPath, "utf8");
  envLocal.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      if (key && value) envConfig[key] = value;
    }
  });
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_TOKEN || envConfig.VITE_SUPABASE_ANON_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanML() {
  console.log("Searching for synced products...");
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, ml_title, ml_item_id")
    .not("ml_item_id", "is", null);

  if (error) {
    console.error("Error fetching:", error);
    return;
  }

  console.log(`Found ${products.length} linked products.`);

  // Strategy: Find the most likely candidate (The one about "Baby" or "Door" or "Name")
  const targets = products.filter((p) => {
    const txt = (p.name + " " + (p.ml_title || "")).toLowerCase();
    return (
      txt.includes("bebé") ||
      txt.includes("bebe") ||
      txt.includes("colgante") ||
      txt.includes("puerta")
    );
  });

  if (targets.length === 0) {
    console.log("No matches found for keywords: bebe, colgante, puerta");
    return;
  }

  for (const t of targets) {
    console.log(
      `Cleaning product: [${t.id}] ${t.name} (ML ID: ${t.ml_item_id})`,
    );

    const { error: updateError } = await supabase
      .from("products")
      .update({
        ml_item_id: null,
        ml_status: null,
        ml_permalink: null,
        last_ml_sync: null,
      })
      .eq("id", t.id);

    if (updateError) console.error("Failed to update:", updateError);
    else console.log("SUCCESS: Product unlinked.");
  }
}

cleanML();
