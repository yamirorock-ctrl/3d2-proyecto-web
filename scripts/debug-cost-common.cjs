const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_TOKEN;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .or(
      "name.ilike.%River Plate 3D - Mate Monumental%,name.ilike.%Combo Boca Juniors 3D%",
    );

  let output = "--- PRODUCTS ---\n";
  products.forEach((p) => {
    output += `Product: ${p.name}\n`;
    output += `- Recipe: ${JSON.stringify(p.color_percentage)}\n`;
    output += `- Consumables: ${JSON.stringify(p.consumables)}\n`;
    output += `- Weight: ${p.weight}, PrintingTime: ${p.printing_time}\n`;
  });

  const { data: materials } = await supabase
    .from("raw_materials")
    .select("name, last_cost, unit");

  output += "\n--- MATERIALS ---\n";
  output += JSON.stringify(materials, null, 2);

  fs.writeFileSync("debug_output.txt", output);
  console.log("Output written to debug_output.txt");
}

checkData();
