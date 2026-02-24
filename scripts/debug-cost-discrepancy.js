import { createClient } from "@supabase/supabase-client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
  const { data: products, error: pError } = await supabase
    .from("products")
    .select("name, color_percentage")
    .filter("name", "ilike", "%River%");

  if (pError) console.error(pError);
  console.log("Products:", JSON.stringify(products, null, 2));

  const { data: materials, error: mError } = await supabase
    .from("raw_materials")
    .select("name, last_cost, unit");

  if (mError) console.error(mError);
  console.log("Materials:", JSON.stringify(materials, null, 2));
}

checkProducts();
