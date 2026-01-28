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

async function checkTokens() {
  console.log("Fetching tokens from ml_tokens...");
  const { data, error } = await supabase.from("ml_tokens").select("*");

  if (error) {
    console.error("Error fetching tokens:", error);
    return;
  }

  console.log("Tokens found:", data.length);
  data.forEach((t) => {
    console.log(`User ID: ${t.user_id}`);
    console.log(`Updated At: ${t.updated_at}`);
    console.log(
      `Access Token: ${t.access_token ? t.access_token.substring(0, 10) + "..." : "MISSING"}`,
    );
    console.log(
      `Refresh Token: ${t.refresh_token ? t.refresh_token.substring(0, 10) + "..." : "MISSING"}`,
    );
    console.log("---");
  });
}

checkTokens();
