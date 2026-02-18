const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Cargar variables de entorno
const envPath = path.resolve(process.cwd(), ".env.local");
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const SUPABASE_URL = envConfig.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.VITE_SUPABASE_ANON_TOKEN;

console.log("🔍 Verificando visibilidad de productos para ANON key...");
console.log(`URL: ${SUPABASE_URL}`);
// console.log(`Key: ${SUPABASE_ANON_KEY}`); // No imprimir key por seguridad

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkProducts() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name")
    .limit(10); // Traer solo 10 para probar

  if (error) {
    console.error("💥 Error al consultar productos:", error.message);
    return;
  }

  console.log(`📦 Productos encontrados: ${products.length}`);

  if (products.length === 0) {
    console.log(
      "⚠️ ¡ALERTA! La lista está vacía. RLS está bloqueando el acceso público.",
    );
  } else {
    console.log("✅ La API puede ver los productos:");
    products.forEach((p) => console.log(` - ${p.name}`));
  }
}

checkProducts();
