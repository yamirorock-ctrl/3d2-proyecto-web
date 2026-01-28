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

// Explicit ML Credentials from VERCEL_ENV_SETUP.md
const ML_APP_ID = "5838942654994123";
const ML_APP_SECRET = "kcETuVxKitH1kvSrnhraI4RMstwwJfBG";

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
  let accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  console.log(`Using Token for User ID: ${tokenData.user_id}`);

  async function tryPost(token) {
    const itemBody = {
      title: "Item de Prueba Sync " + Date.now(),
      category_id: "MLA1430",
      price: 1500,
      currency_id: "ARS",
      available_quantity: 1,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: "free",
      description: {
        plain_text: "Prueba de sincronización v3.",
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

    return fetch("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(itemBody),
    });
  }

  let response = await tryPost(accessToken);
  let data = await response.json();

  console.log("Initial Status:", response.status);

  if (response.status === 401 || response.status === 403) {
    console.log("Token issues. Attempting refresh...");
    const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: ML_APP_ID,
        client_secret: ML_APP_SECRET,
        refresh_token: refreshToken,
      }),
    });

    const refreshData = await refreshRes.json();
    if (!refreshRes.ok) {
      console.error("Refresh failed:", refreshData);
      return;
    }

    console.log("Refresh successful!");
    accessToken = refreshData.access_token;

    console.log("Retrying post with new token...");
    response = await tryPost(accessToken);
    data = await response.json();
    console.log("Retry Status:", response.status);
    console.log("Retry Data:", JSON.stringify(data, null, 2));
  } else {
    console.log("Data:", JSON.stringify(data, null, 2));
  }
}

dryRun();
