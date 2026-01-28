import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

// Simple .env parser
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) {
      env[key.trim()] = rest
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  });
}

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_TOKEN,
);

async function dryRun() {
  console.log("Fetching token from Supabase...");
  const { data: tokens, error: tokenError } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tokenError || !tokens || tokens.length === 0) {
    console.error("No tokens found in ml_tokens table.");
    return;
  }

  const tokenData = tokens[0];
  const accessToken = tokenData.access_token;
  console.log(`Using Token for User ID: ${tokenData.user_id}`);

  const itemBody = {
    title: "Item de Prueba Sync - No Comprar",
    category_id: "MLA1430", // "Otros" category
    price: 1500,
    currency_id: "ARS",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "free", // Use 'free' for minimal restrictions
    description: {
      plain_text:
        "Esta es una prueba de sincronización desde el sistema de gestión.",
    },
    pictures: [
      {
        source:
          "https://http2.mlstatic.com/storage/developers-site-cms-admin/dtmv/73479100-7561-11eb-a5a4-99881d77a28e.png",
      },
    ],
    attributes: [
      { id: "BRAND", value_name: "Genérico" },
      { id: "MODEL", value_name: "Prueba" },
    ],
  };

  console.log("Sending POST /items...");
  const response = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(itemBody),
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response Data:", JSON.stringify(data, null, 2));

  if (response.status === 403) {
    console.log("\nPossible causes for 403 Forbidden with PolicyAgent:");
    console.log(
      "1. Application ID is not authorized for marketplace operations.",
    );
    console.log("2. User account (YAMIRO) has a restriction on selling.");
    console.log("3. Missing scopes (though token has write).");
  }
}

dryRun();
