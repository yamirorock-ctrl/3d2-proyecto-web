import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

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
  const { data: tokenData } = await supabase
    .from("ml_tokens")
    .select("*")
    .limit(1)
    .single();
  if (!tokenData) return console.log("NO_TOKEN");

  const meRes = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const me = await meRes.json();

  const res = await fetch(
    `https://api.mercadolibre.com/users/${me.id}/restrictions`,
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );
  const data = await res.json();
  console.log("RESTRICTIONS_DATA:", JSON.stringify(data));
}

check();
