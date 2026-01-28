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

async function check() {
  const { data: tokens } = await supabase
    .from("ml_tokens")
    .select("*")
    .limit(1)
    .single();
  const token = tokens.access_token;
  const connectedUserId = tokens.user_id;

  console.log("Connected User ID (from Token):", connectedUserId);

  const testItemIds = ["MLA1632262143", "MLA2744027218", "MLA2744028480"];

  for (const id of testItemIds) {
    console.log(`\nChecking Item: ${id}...`);
    try {
      const res = await fetch(`https://api.mercadolibre.com/items/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.error) {
        console.log(`Error fetching ${id}:`, d.message);
        // Try without token to see if it's public
        const resPublic = await fetch(
          `https://api.mercadolibre.com/items/${id}`,
        );
        const dPublic = await resPublic.json();
        if (dPublic.seller_id) {
          console.log(`Public Info - Seller ID: ${dPublic.seller_id}`);
        }
      } else {
        console.log(`Item Found! Seller ID: ${d.seller_id}`);
      }
    } catch (e) {
      console.error("Fetch failed:", e.message);
    }
  }
}

check();
