import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

let env = {};
try {
  const envFile = fs.readFileSync(envPath, "utf8");
  envFile.split("\n").forEach((line) => {
    const [key, val] = line.split("=");
    if (key && val) env[key.trim()] = val.trim().replace(/^["']|["']$/g, "");
  });
} catch (e) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_TOKEN || env.VITE_SUPABASE_ANON_TOKEN;
const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function test() {
  const { data: tokenData } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (!tokenData) {
    console.error("No token found");
    return;
  }

  const token = tokenData.access_token;
  console.log("Testing with User ID:", tokenData.user_id);
  console.log("Token Scopes:", tokenData.scope);

  // Attempt to validate a basic item (this doesn't publish, just tests permissions/rules)
  const itemBody = {
    title: "Item de Prueba del Sistema - No Comprar",
    category_id: "MLA3530", // Otros
    price: 1000,
    currency_id: "ARS",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "free", // Test with 'free' first to avoid listing fee issues
    pictures: [
      {
        source:
          "https://http2.mlstatic.com/storage/developers-site-cms-admin/dtmv/73479100-7561-11eb-a5a4-99881d77a28e.png",
      },
    ],
  };

  console.log("\nFetching /users/me...");
  const uRes = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const uData = await uRes.json();
  console.log(
    "User Info:",
    JSON.stringify(
      {
        id: uData.id,
        nickname: uData.nickname,
        status: uData.status,
        site_id: uData.site_id,
        tags: uData.tags,
      },
      null,
      2,
    ),
  );

  console.log("\nFetching User Restrictions...");
  const rRes = await fetch(
    `https://api.mercadolibre.com/users/${uData.id}/restrictions`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const rData = await rRes.json();
  console.log("Restrictions:", JSON.stringify(rData, null, 2));

  console.log("\nSearching for own items...");
  const sOwnRes = await fetch(
    `https://api.mercadolibre.com/users/${uData.id}/items/search?limit=10`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const sOwnData = await sOwnRes.json();
  console.log("Own Items Search Result:", JSON.stringify(sOwnData, null, 2));

  console.log("\nAttempting /items/validate with 'free' listing...");
  const rSetUrl = "https://api.mercadolibre.com/items/validate";
  const res = await fetch(rSetUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(itemBody),
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (res.status === 403) {
    console.log("\n--- FAILED TEST ---");
    console.log(
      "The token does not have permission to publish items in MLA site.",
    );
    console.log(
      "Check if the account is in MLA (Argentina) and if the App is also in MLA.",
    );
  }
}

test();
