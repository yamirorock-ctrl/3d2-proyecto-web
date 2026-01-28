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

async function diagnose() {
  console.log("--- 🕵️ DIAGNÓSTICO DE CUENTA MERCADOLIBRE ---");

  const { data: tokenData, error: tokenError } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !tokenData) {
    console.error(
      "❌ No se encontró token en Supabase. Conecta la cuenta en el panel de admin.",
    );
    return;
  }

  const token = tokenData.access_token;
  const userId = tokenData.user_id;
  console.log(`✅ Token encontrado para User ID: ${userId}`);
  console.log(`📅 Última actualización: ${tokenData.updated_at}`);

  async function fetchML(endpoint) {
    const res = await fetch(`https://api.mercadolibre.com${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  console.log("\n1. Verificando información del usuario (/users/me)...");
  const userMe = await fetchML("/users/me");
  if (userMe.ok) {
    console.log(`   - Usuario: ${userMe.data.nickname} (${userMe.data.id})`);
    console.log(`   - País: ${userMe.data.site_id}`);
    console.log(`   - Estado de cuenta: ${userMe.data.status?.site_status}`);
    console.log(`   - Tags: ${userMe.data.tags?.join(", ")}`);
  } else {
    console.error("   ❌ Error al obtener /users/me:", userMe.data);
  }

  console.log("\n2. Verificando restricciones (/users/{id}/restrictions)...");
  const restrictions = await fetchML(`/users/${userId}/restrictions`);
  if (restrictions.ok) {
    if (restrictions.data.length === 0) {
      console.log("   ✅ Sin restricciones activas.");
    } else {
      console.log(
        `   ⚠️ Se encontraron ${restrictions.data.length} restricciones:`,
      );
      restrictions.data.forEach((r) => {
        console.log(
          `     - [${r.type}] ${r.message} (Desde: ${r.date_created})`,
        );
      });
    }
  } else {
    console.error("   ❌ Error al obtener restricciones:", restrictions.data);
  }

  console.log("\n3. Verificando permisos de escritura (Validación de item)...");
  const testItem = {
    title: "Item de Diagnóstico - NO COMPRAR",
    category_id: "MLA3530",
    price: 1000,
    currency_id: "ARS",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "free",
    pictures: [
      {
        source:
          "https://http2.mlstatic.com/storage/developers-site-cms-admin/dtmv/73479100-7561-11eb-a5a4-99881d77a28e.png",
      },
    ],
  };

  const validate = await fetch(`https://api.mercadolibre.com/items/validate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(testItem),
  });

  const validateData = await validate.json();
  if (validate.ok) {
    console.log(
      "   ✅ Validación exitosa. La aplicación tiene permisos para publicar.",
    );
  } else {
    console.error(`   ❌ Error en validación (Status ${validate.status}):`);
    console.error(`     - Mensaje: ${validateData.message}`);
    if (validateData.cause) {
      validateData.cause.forEach((c) =>
        console.log(`     - Causa: ${c.message}`),
      );
    }
    if (validate.status === 403) {
      console.log(
        "\n   💡 SUGERENCIA: El error 403 con PolicyAgent suele indicar que la cuenta",
      );
      console.log(
        "      tiene una suspensión temporal o que falta completar datos de facturación",
      );
      console.log("      en MercadoLibre.");
    }
  }

  console.log("\n--- Fin del diagnóstico ---");
}

diagnose();
