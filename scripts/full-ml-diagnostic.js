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

const ML_APP_ID = env.VITE_ML_APP_ID || env.ML_APP_ID;
const ML_APP_SECRET = env.VITE_ML_APP_SECRET || env.ML_APP_SECRET;

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_TOKEN,
);

console.log("=== DIAGNÓSTICO COMPLETO DE MERCADOLIBRE ===\n");

async function runDiagnostic() {
  // 1. Verificar credenciales de la app
  console.log("1. CREDENCIALES DE LA APLICACIÓN");
  console.log(
    `   App ID: ${ML_APP_ID ? ML_APP_ID.substring(0, 10) + "..." : "NO ENCONTRADO"}`,
  );
  console.log(
    `   App Secret: ${ML_APP_SECRET ? "***" + ML_APP_SECRET.substring(ML_APP_SECRET.length - 4) : "NO ENCONTRADO"}`,
  );

  if (!ML_APP_ID || !ML_APP_SECRET) {
    console.log("   ❌ FALTA CONFIGURACIÓN DE LA APP\n");
    return;
  }
  console.log("   ✓ Credenciales presentes\n");

  // 2. Obtener token de Supabase
  console.log("2. TOKEN DE ACCESO");
  const { data: tokens, error: tokenError } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tokenError || !tokens || tokens.length === 0) {
    console.log("   ❌ No se encontró token en Supabase");
    console.log(`   Error: ${tokenError?.message || "Sin tokens"}\n`);
    return;
  }

  const tokenData = tokens[0];
  let accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  const userId = tokenData.user_id;

  console.log(`   User ID: ${userId}`);
  console.log(`   Token: ${accessToken.substring(0, 15)}...`);
  console.log(`   Última actualización: ${tokenData.updated_at}\n`);

  // 3. Verificar información del usuario
  console.log("3. INFORMACIÓN DEL USUARIO");
  try {
    const userRes = await fetch(
      `https://api.mercadolibre.com/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const userData = await userRes.json();

    if (userRes.ok) {
      console.log(`   ✓ Usuario: ${userData.nickname}`);
      console.log(`   ✓ Site: ${userData.site_id}`);
      console.log(`   ✓ Status: ${userData.status?.site_status || "N/A"}`);
      console.log(
        `   ✓ Seller Reputation: ${userData.seller_reputation?.level_id || "N/A"}\n`,
      );
    } else {
      console.log(`   ❌ Error al obtener usuario: ${userData.message}`);
      if (userRes.status === 401) {
        console.log("   → Intentando refrescar token...\n");
        const refreshRes = await fetch(
          "https://api.mercadolibre.com/oauth/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: ML_APP_ID,
              client_secret: ML_APP_SECRET,
              refresh_token: refreshToken,
            }),
          },
        );

        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          console.log("   ✓ Token refrescado exitosamente");
          accessToken = refreshData.access_token;

          // Guardar nuevo token
          await supabase
            .from("ml_tokens")
            .update({
              access_token: refreshData.access_token,
              refresh_token: refreshData.refresh_token,
              expires_in: refreshData.expires_in,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          console.log("   ✓ Token guardado en Supabase\n");
        } else {
          console.log(
            `   ❌ Error al refrescar: ${refreshData.message || refreshData.error}\n`,
          );
          return;
        }
      } else {
        console.log();
        return;
      }
    }
  } catch (e) {
    console.log(`   ❌ Excepción: ${e.message}\n`);
    return;
  }

  // 4. Verificar permisos de publicación
  console.log("4. PERMISOS DE PUBLICACIÓN");
  try {
    const validateRes = await fetch(
      "https://api.mercadolibre.com/items/validate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Test Item",
          category_id: "MLA1910",
          price: 100,
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
        }),
      },
    );

    const validateData = await validateRes.json();

    if (validateRes.ok) {
      console.log("   ✓ Validación exitosa - Puede publicar");
    } else {
      console.log(`   ❌ Error en validación (${validateRes.status})`);
      console.log(`   Mensaje: ${validateData.message || validateData.error}`);
      if (validateData.blocked_by) {
        console.log(`   Bloqueado por: ${validateData.blocked_by}`);
      }
      if (validateData.cause && validateData.cause.length > 0) {
        console.log("   Causas:");
        validateData.cause.forEach((c) => {
          console.log(`     - ${c.code || c.message}`);
        });
      }
    }
    console.log();
  } catch (e) {
    console.log(`   ❌ Excepción: ${e.message}\n`);
  }

  // 5. Verificar restricciones de cuenta
  console.log("5. RESTRICCIONES DE CUENTA");
  try {
    const restrictionsRes = await fetch(
      `https://api.mercadolibre.com/users/${userId}/restrictions`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const restrictions = await restrictionsRes.json();

    if (restrictionsRes.ok) {
      if (restrictions.length === 0) {
        console.log("   ✓ Sin restricciones");
      } else {
        console.log(
          `   ⚠️  ${restrictions.length} restricción(es) encontrada(s):`,
        );
        restrictions.forEach((r) => {
          console.log(`     - ${r.type}: ${r.message}`);
        });
      }
    } else {
      console.log(
        `   ℹ️  No se pudo verificar: ${restrictions.message || restrictions.error}`,
      );
    }
    console.log();
  } catch (e) {
    console.log(`   ❌ Excepción: ${e.message}\n`);
  }

  // 6. Verificar categorías disponibles
  console.log("6. CATEGORÍAS DE PRUEBA");
  const testCategories = ["MLA1910", "MLA3530", "MLA1430"];
  for (const catId of testCategories) {
    try {
      const catRes = await fetch(
        `https://api.mercadolibre.com/categories/${catId}`,
      );
      const catData = await catRes.json();
      if (catRes.ok) {
        const path =
          catData.path_from_root?.map((p) => p.name).join(" > ") ||
          catData.name;
        console.log(`   ✓ ${catId}: ${path}`);
      } else {
        console.log(`   ❌ ${catId}: Error`);
      }
    } catch (e) {
      console.log(`   ❌ ${catId}: Excepción`);
    }
  }
  console.log();

  console.log("=== FIN DEL DIAGNÓSTICO ===");
}

runDiagnostic().catch(console.error);
