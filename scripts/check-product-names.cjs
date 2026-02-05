const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Manual .env loading
const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
envContent.split("\n").forEach((line) => {
  const [key, value] = line.split("=");
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_TOKEN,
);

async function listProducts() {
  console.log("Conectando a Supabase...");
  const { data, error } = await supabase
    .from("products")
    .select("name")
    .limit(15);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Productos encontrados:");
    data.forEach((p) => console.log(`- ${p.name}`));
  }
}

listProducts();
