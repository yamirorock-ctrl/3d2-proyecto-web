require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_TOKEN,
);

async function checkDate() {
  const { data } = await supabase
    .from("products")
    .select("id, created_at, name")
    .in("id", [54, 55, 56, 57])
    .order("id");
  fs.writeFileSync("temp_dates.json", JSON.stringify(data, null, 2));
}

checkDate();
