/**
 * Webhook de MercadoPago para Vercel Serverless Functions
 * Recibe notificaciones de pagos y actualiza el estado en Supabase
 * FUSIONADO: También gestiona notificaciones de ventas de MercadoLibre Marketplace
 */

import { createClient } from "@supabase/supabase-js";

// Variables de servidor sin prefijo VITE, con fallback a VITE_* para compatibilidad
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MP_ACCESS_TOKEN =
  process.env.MP_ACCESS_TOKEN ||
  process.env.MP_ACCESS ||
  process.env.VITE_MP_ACCESS;

// Validación inicial: loguear qué está faltando
if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("[Webhook] CRÍTICO: Faltan variables de entorno de Supabase", {
    SUPABASE_URL: Boolean(SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(SUPABASE_SERVICE_ROLE_KEY)
  });
}

// Crear cliente Supabase usando Service Role si existe (para saltar RLS en backend)
let supabase = null;
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
if (SUPABASE_URL && supabaseKey) {
  supabase = createClient(SUPABASE_URL, supabaseKey);
}

export default async function handler(req, res) {
  // Validación temprana: si no hay variables, responder con error descriptivo
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !MP_ACCESS_TOKEN) {
    console.error(
      "[Webhook] ERROR DE CONFIGURACIÓN: Faltan variables de entorno",
      {
        SUPABASE_URL: Boolean(SUPABASE_URL),
        SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
        MP_ACCESS_TOKEN: Boolean(MP_ACCESS_TOKEN),
      },
    );
    return res.status(500).json({
      error: "Server misconfigured",
      message:
        "Missing environment variables. Configure SUPABASE_URL, SUPABASE_ANON, and MP_ACCESS in Vercel.",
      env: {
        SUPABASE_URL: Boolean(SUPABASE_URL),
        SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
        MP_ACCESS_TOKEN: Boolean(MP_ACCESS_TOKEN),
      },
    });
  }

  // Health-check y soporte GET para topic=id (algunos paneles envían GET)
  if (req.method === "GET") {
    // Test manual
    if (req.query && req.query.test_payment_id) {
      const testPaymentId = req.query.test_payment_id;
      const testOrderId = req.query.order_id;
      try {
        const paymentDetails = await fetch(
          `https://api.mercadopago.com/v1/payments/${testPaymentId}`,
          { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
        );
        if (!paymentDetails.ok) {
          const errText = await paymentDetails.text().catch(() => "");
          console.error("[Webhook][TEST][GET] mp fetch failed", {
            status: paymentDetails.status,
            body: errText,
          });
          return res
            .status(200)
            .json({ received: true, note: "mp fetch failed (test-get)" });
        }
        const payment = await paymentDetails.json();
        const orderId = testOrderId || payment.external_reference;
        let orderStatus = "pending";
        if (payment.status === "approved") orderStatus = "paid";
        if (payment.status === "rejected" || payment.status === "cancelled")
          orderStatus = "cancelled";

        const { error } = await supabase
          .from("orders")
          .update({
            status: orderStatus,
            payment_id: String(testPaymentId),
            payment_status: payment.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (error) {
          console.error("[Webhook][TEST][GET] db update failed", error);
          return res
            .status(200)
            .json({ received: true, error: "db update failed (test-get)" });
        }
        return res
          .status(200)
          .json({ success: true, orderId, status: orderStatus, test: true });
      } catch (e) {
        console.error("[Webhook][TEST][GET] exception", e);
        return res
          .status(200)
          .json({ received: true, error: "exception (test-get)" });
      }
    }

    // Soporte para GET con topic/id (fallback)
    const topic = req.query?.topic || req.query?.type;
    const idParam = req.query?.id;
    if ((topic === "payment" || topic === "merchant_order") && idParam) {
      try {
        if (topic === "payment") {
          const pResp = await fetch(
            `https://api.mercadopago.com/v1/payments/${idParam}`,
            { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
          );
          if (!pResp.ok) {
            const txt = await pResp.text().catch(() => "");
            console.error("[Webhook][GET] payment fetch failed", {
              status: pResp.status,
              body: txt,
            });
            return res
              .status(200)
              .json({ received: true, note: "payment fetch failed (get)" });
          }
          const payment = await pResp.json();
          const orderId = payment.external_reference;
          let orderStatus = "pending";
          if (payment.status === "approved") orderStatus = "paid";
          if (payment.status === "rejected" || payment.status === "cancelled")
            orderStatus = "cancelled";

          const { error } = await supabase
            .from("orders")
            .update({
              status: orderStatus,
              payment_id: String(idParam),
              payment_status: payment.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          if (error) {
            console.error("[Webhook][GET] db update failed", error);
            return res
              .status(200)
              .json({ received: true, error: "db update failed (get)" });
          }
          return res.status(200).json({
            success: true,
            orderId,
            status: orderStatus,
            source: "get-payment",
          });
        }

        if (topic === "merchant_order") {
          const moResp = await fetch(
            `https://api.mercadopago.com/merchant_orders/${idParam}`,
            { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
          );
          if (!moResp.ok) {
            const txt = await moResp.text().catch(() => "");
            console.error("[Webhook][GET] merchant_order fetch failed", {
              status: moResp.status,
              body: txt,
            });
            return res.status(200).json({
              received: true,
              note: "merchant_order fetch failed (get)",
            });
          }
          const mo = await moResp.json();
          const orderId = mo.external_reference;
          const payment = (mo.payments && mo.payments[0]) || null;
          const paymentId = payment ? payment.id : null;
          const paymentStatus = payment ? payment.status : "pending";
          let orderStatus = "pending";
          if (paymentStatus === "approved") orderStatus = "paid";
          if (paymentStatus === "rejected" || paymentStatus === "cancelled")
            orderStatus = "cancelled";

          const { error } = await supabase
            .from("orders")
            .update({
              status: orderStatus,
              payment_id: paymentId ? String(paymentId) : null,
              payment_status: paymentStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          if (error) {
            console.error(
              "[Webhook][GET] db update failed (merchant_order)",
              error,
            );
            return res.status(200).json({
              received: true,
              error: "db update failed (get-merchant_order)",
            });
          }
          return res.status(200).json({
            success: true,
            orderId,
            status: orderStatus,
            source: "get-merchant_order",
          });
        }
      } catch (e) {
        console.error("[Webhook][GET] exception", e);
        return res
          .status(200)
          .json({ received: true, error: "exception (get)" });
      }
    }

    // Health-check
    return res.status(200).json({
      ok: true,
      message: "Webhook activo",
      lookingFor: {
        "SUPABASE_URL o VITE_SUPABASE_URL": Boolean(SUPABASE_URL),
        "SUPABASE_ANON o VITE_SUPABASE_ANON_TOKEN": Boolean(SUPABASE_ANON_KEY),
        "MP_ACCESS o VITE_MP_ACCESS": Boolean(MP_ACCESS_TOKEN),
      },
      allEnvKeys: Object.keys(process.env).filter(
        (k) =>
          k.includes("SUPABASE") || k.includes("MP_") || k.includes("VITE"),
      ),
    });
  }

  // Solo aceptar POST para notificaciones
  if (req.method !== "POST") {
    console.warn("[Webhook] Método no permitido:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Loguear headers básicos para diagnóstico
    console.log("[Webhook] Headers:", {
      "content-type": req.headers["content-type"],
      "x-forwarded-for": req.headers["x-forwarded-for"],
      "user-agent": req.headers["user-agent"],
    });

    // Asegurar que el body exista
    const { type, data, action } = req.body || {};

    // Modo prueba: permitir ?test_payment_id=<id>&order_id=<uuid>
    if (req.query && req.query.test_payment_id) {
      const testPaymentId = req.query.test_payment_id;
      const testOrderId = req.query.order_id;
      console.log(
        "[Webhook][TEST] Ejecutando prueba manual con payment_id:",
        testPaymentId,
        "order_id:",
        testOrderId,
      );

      const paymentDetails = await fetch(
        `https://api.mercadopago.com/v1/payments/${testPaymentId}`,
        {
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          },
        },
      );

      if (!paymentDetails.ok) {
        const errText = await paymentDetails.text().catch(() => "");
        console.error("[Webhook][TEST] Error al obtener detalles del pago", {
          status: paymentDetails.status,
          statusText: paymentDetails.statusText,
          body: errText,
        });
        return res
          .status(200)
          .json({ received: true, note: "mp fetch failed (test)" });
      }

      const payment = await paymentDetails.json();
      const orderId = testOrderId || payment.external_reference;
      let orderStatus;
      switch (payment.status) {
        case "approved":
          orderStatus = "paid";
          break;
        case "pending":
        case "in_process":
          orderStatus = "pending";
          break;
        case "rejected":
        case "cancelled":
          orderStatus = "cancelled";
          break;
        default:
          orderStatus = "pending";
      }

      const { error } = await supabase
        .from("orders")
        .update({
          status: orderStatus,
          payment_id: String(testPaymentId),
          payment_status: payment.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        console.error("[Webhook][TEST] Error al actualizar orden:", error);
        return res
          .status(200)
          .json({ received: true, error: "db update failed (test)" });
      }

      console.log(
        `[Webhook][TEST] Orden ${orderId} actualizada a estado: ${orderStatus}`,
      );
      return res
        .status(200)
        .json({ success: true, orderId, status: orderStatus, test: true });
    }

    console.log("[Webhook] Notificación recibida:", { type, action, data });

    // Si no hay body, responder 200 para evitar reintentos pero loguear
    if (!type && !data) {
      console.warn("[Webhook] Body vacío o inválido recibido");
      return res.status(200).json({ received: true, note: "empty body" });
    }

    // MercadoPago envía diferentes tipos de notificaciones
    if (type === "payment") {
      const paymentId = data.id;

      // Obtener detalles del pago desde MercadoPago
      const paymentDetails = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          },
        },
      );

      if (!paymentDetails.ok) {
        const errText = await paymentDetails.text().catch(() => "");
        console.error("[Webhook] Error al obtener detalles del pago", {
          status: paymentDetails.status,
          statusText: paymentDetails.statusText,
          body: errText,
        });
        // Responder 200 para evitar reintentos; el panel de simulación puede mostrar 401 si usa IDs ficticios
        return res
          .status(200)
          .json({ received: true, note: "mp fetch failed" });
      }

      const payment = await paymentDetails.json();
      console.log("[Webhook] Detalles del pago:", payment);

      // Extraer el order_id del external_reference
      const orderId = payment.external_reference;

      if (!orderId) {
        console.warn("[Webhook] No se encontró external_reference en el pago");
        return res.status(200).json({ received: true });
      }

      // Mapear el estado de MercadoPago a nuestro sistema
      let orderStatus;
      switch (payment.status) {
        case "approved":
          orderStatus = "paid"; // Pago aprobado
          break;
        case "pending":
        case "in_process":
          orderStatus = "pending"; // Pago pendiente
          break;
        case "rejected":
        case "cancelled":
          orderStatus = "cancelled"; // Pago rechazado/cancelado
          break;
        default:
          orderStatus = "pending";
      }

      // Actualizar la orden en Supabase
      const { error } = await supabase
        .from("orders")
        .update({
          status: orderStatus,
          payment_id: paymentId.toString(),
          payment_status: payment.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        console.error("[Webhook] Error al actualizar orden:", error);
        return res.status(500).json({ error: "Database update failed" });
      }

      console.log(
        `[Webhook] Orden ${orderId} actualizada a estado: ${orderStatus}`,
      );

      // Si el pago fue aprobado, notificar por WhatsApp y DESCONTAR STOCK
      if (orderStatus === "paid") {
        console.log(
          `[Webhook] Pago aprobado para Orden ${orderId}. Iniciando descuento de stock...`,
        );

        // 1. Obtener items de la orden
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("items, shipping_method")
          .eq("id", orderId)
          .single();

        if (!orderError && orderData && orderData.items) {
          // 2. Descontar stock para cada item
          for (const item of orderData.items) {
            if (item.id && item.quantity) {
              // Buscar stock actual
              const { data: product } = await supabase
                .from("products")
                .select("stock, name")
                .eq("id", item.id)
                .single();

              if (product) {
                const newStock = Math.max(
                  0,
                  (product.stock || 0) - item.quantity,
                );
                await supabase
                  .from("products")
                  .update({ stock: newStock })
                  .eq("id", item.id);

                console.log(
                  `[Webhook] Stock descontado: ${product.name} (${product.stock} -> ${newStock})`,
                );
              }
            }
          }
          
          // 3. Descontar stock de insumos y materia prima
          try {
             await deductRawMaterialsWEB(orderData.items, supabase);
             console.log("[Webhook] Insumos descontados correctamente.");
          } catch (mErr) {
             console.error("[Webhook] Error descontando insumos:", mErr);
          }
          
        } else {
          console.error(
            "[Webhook] Error obteniendo items para descuento de stock:",
            orderError,
          );
        }

        const businessPhone =
          process.env.VITE_WHATSAPP_NUMBER || process.env.WHATSAPP_NUMBER;
        const personalPhone =
          process.env.VITE_PERSONAL_NUMBER || process.env.PERSONAL_NUMBER;
        // ... (resto del código de notificación)
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

        const sendWap = async (phone, msg) => {
          if (!phone) return;
          try {
            await fetch(
              "https://hook.us2.make.com/3du519txd4fyw541s7gtcfnto432gmeg",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phone,
                  message: msg,
                  timestamp: new Date().toISOString(),
                }),
              },
            );
          } catch (e) {
            console.error("[Webhook] Error enviando WhatsApp a " + phone, e);
          }
        };

        const message = `🚀 ¡Nueva Venta por Web! 🤑\nOrden: #${orderId}\nEstado: Pagado\nRevisar admin para más detalles.`;

        // Notificar en paralelo (sin await para no bloquear respuesta a MP)
        if (businessPhone) sendWap(businessPhone, message);
        if (personalPhone && personalPhone !== businessPhone)
          sendWap(personalPhone, message);
      }

      // Si el pago fue aprobado, intentar crear envío en MercadoLibre (no bloqueante)
      if (orderStatus === "paid") {
        console.log(
          "[Webhook] Pago aprobado - iniciando creación de envío en ML",
        );

        // Obtener datos de la orden para verificar si necesita envío de ML
        const { data: orderData, error: orderFetchError } = await supabase
          .from("orders")
          .select("shipping_method")
          .eq("id", orderId)
          .single();

        if (!orderFetchError && orderData) {
          const needsMLShipment = ["moto", "correo"].includes(
            orderData.shipping_method,
          );

          if (needsMLShipment) {
            // Obtener el primer user_id disponible de ml_tokens (el vendedor)
            const { data: mlToken, error: mlTokenError } = await supabase
              .from("ml_tokens")
              .select("user_id")
              .order("updated_at", { ascending: false })
              .limit(1)
              .single();

            if (mlTokenError || !mlToken) {
              console.error(
                "[Webhook] No se encontró token de ML. Ejecuta el OAuth callback primero.",
              );
              return res.status(200).json({
                success: true,
                orderId,
                status: orderStatus,
                warning: "No ML token found",
              });
            }

            const userId = String(mlToken.user_id);
            console.log(
              "[Webhook] Usando ML user_id:",
              userId,
              "para orden:",
              orderId,
            );

            // Llamar al endpoint de crear envío (asíncrono, no bloqueante)
            fetch(
              `${process.env.VERCEL_URL || "https://3d2-bewhook.vercel.app"}/api/ml-shipping?action=create`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId, userId }),
              },
            )
              .then((resp) => resp.json())
              .then((data) => {
                if (data.success) {
                  console.log(
                    "[Webhook] Envío ML creado exitosamente:",
                    data.shipment,
                  );
                } else {
                  console.warn(
                    "[Webhook] No se pudo crear envío ML:",
                    data.error,
                    data.details,
                  );
                }
              })
              .catch((err) => {
                console.error(
                  "[Webhook] Error al llamar ml-shipping?action=create:",
                  err.message,
                );
              });
          } else {
            console.log(
              "[Webhook] Método de envío no requiere ML:",
              orderData.shipping_method,
            );
          }
        }
      }

      return res.status(200).json({
        success: true,
        orderId,
        status: orderStatus,
      });
    }

    // Soporte básico para merchant_order: obtener payment y external_reference
    if (type === "merchant_order") {
      const merchantOrderId = data.id;
      try {
        const moResp = await fetch(
          `https://api.mercadopago.com/merchant_orders/${merchantOrderId}`,
          { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
        );
        if (!moResp.ok) {
          const txt = await moResp.text().catch(() => "");
          console.error("[Webhook] Error merchant_order fetch", {
            status: moResp.status,
            statusText: moResp.statusText,
            body: txt,
          });
          return res
            .status(200)
            .json({ received: true, note: "merchant_order fetch failed" });
        }
        const mo = await moResp.json();
        const orderId = mo.external_reference;
        const payment = (mo.payments && mo.payments[0]) || null;
        const paymentId = payment ? payment.id : null;
        const paymentStatus = payment ? payment.status : "pending";
        let orderStatus = "pending";
        if (paymentStatus === "approved") orderStatus = "paid";
        if (paymentStatus === "rejected" || paymentStatus === "cancelled")
          orderStatus = "cancelled";

        if (!orderId) {
          console.warn("[Webhook] merchant_order sin external_reference");
          return res.status(200).json({
            received: true,
            note: "merchant_order missing external_reference",
          });
        }

        const { error } = await supabase
          .from("orders")
          .update({
            status: orderStatus,
            payment_id: paymentId ? String(paymentId) : null,
            payment_status: paymentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (error) {
          console.error(
            "[Webhook] Error al actualizar orden desde merchant_order:",
            error,
          );
          return res.status(200).json({
            received: true,
            error: "db update failed (merchant_order)",
          });
        }

        console.log(
          `[Webhook] Orden ${orderId} actualizada vía merchant_order a estado: ${orderStatus}`,
        );
        return res.status(200).json({
          success: true,
          orderId,
          status: orderStatus,
          source: "merchant_order",
        });
      } catch (e) {
        console.error("[Webhook] Excepción merchant_order:", e);
        return res
          .status(200)
          .json({ received: true, error: "merchant_order exception" });
      }
    }

    // Otros tipos de notificaciones (merchant_order, etc.)
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error procesando notificación:", error);
    // Responder 200 para evitar reintentos del panel de prueba, pero loguear el error
    return res.status(200).json({ received: true, error: "processing error" });
  }
}

// ------------------------------------------------------------------
// UTILS
// ------------------------------------------------------------------

async function deductRawMaterialsWEB(items, supabaseClient) {
  // 1. Get raw materials
  const { data: materials, error } = await supabaseClient
    .from('raw_materials')
    .select('id, name, quantity, unit, category');

  if (error || !materials) return;

  // 2. Get product definitions with consumables
  const productIds = items.map((i) => i.id || i.product_id).filter(Boolean);
  if (productIds.length === 0) return;

  const { data: productDefinitions } = await supabaseClient
    .from('products')
    .select('id, name, weight, net_weight, consumables, color_percentage') 
    .in('id', productIds);
  
  const productMap = new Map(productDefinitions?.map((p) => [p.id, p]) || []);
  const updates = new Map();

  const findMaterialIdByName = (searchName, categoryFilter) => {
    if (!searchName) return null;
    const lowerSearch = searchName.toLowerCase().trim();
    
    // 1. Exact match
    let mat = materials.find((m) => m.name.toLowerCase() === lowerSearch);
    if (mat) return mat;

    // 2. Fuzzy words
    const searchWords = lowerSearch.split(/\s+/).filter(w => w.length > 2);
    let candidates = materials.filter((m) => {
        if (categoryFilter && m.category !== categoryFilter) return false;
        const matName = m.name.toLowerCase();
        return searchWords.every(word => matName.includes(word));
    });

    if (candidates.length > 0) return candidates[0];

    // 3. Inverse support
    candidates = materials.filter((m) => {
        if (categoryFilter && m.category !== categoryFilter) return false;
        const matName = m.name.toLowerCase();
        return matName.includes(lowerSearch) || lowerSearch.includes(matName);
    });
    
    return candidates.length > 0 ? candidates[0] : null;
  };

  const addDeduction = (materialId, amount) => {
      const current = updates.get(materialId) || 0;
      updates.set(materialId, current + amount);
  };

  // 3. Analyze items
  for (const item of items) {
    const pId = item.id || item.product_id;
    if (!pId) continue;
    
    // Si viene con items preseteados (opciones) se respetan
    if (item.consumables && Array.isArray(item.consumables) && item.consumables.length > 0) {
        item.consumables.forEach((c) => {
            if (c.material && c.quantity) {
                const mat = findMaterialIdByName(c.material);
                if (mat) addDeduction(mat.id, c.quantity * item.quantity);
            }
        });
        continue;
    }

    const qty = item.quantity;
    const productDef = productMap.get(pId);
    if (!productDef) continue;

    // Fixed Consumables
    if (productDef.consumables && Array.isArray(productDef.consumables)) {
        productDef.consumables.forEach((c) => {
            if (c.material && c.quantity) {
                const mat = findMaterialIdByName(c.material);
                if (mat) addDeduction(mat.id, c.quantity * qty);
            }
        });
    }

    // Filament (color Percentage)
    if (productDef.color_percentage && Array.isArray(productDef.color_percentage)) {
        productDef.color_percentage.forEach((cp) => {
            const originalColorName = cp.color;
            let targetMaterialName = originalColorName;
            
            const isPredominant = (cp.percentage || 0) > 40 || (productDef.color_percentage.length === 1);
            if (isPredominant && item.selected_options && item.selected_options.color) {
                targetMaterialName = item.selected_options.color;
            }

            const mat = findMaterialIdByName(targetMaterialName, 'Filamento');
            if (mat) {
                let amountToDeduct = 0;
                if (cp.grams) {
                    amountToDeduct = cp.grams * qty;
                } else if (cp.percentage) {
                    const referenceWeight = productDef.net_weight || productDef.weight || 0;
                    if (referenceWeight > 0) {
                        amountToDeduct = (referenceWeight * qty) * (cp.percentage / 100);
                    }
                }

                if (amountToDeduct > 0) {
                    if (mat.unit && (mat.unit.toLowerCase().includes('kg') || mat.unit.toLowerCase().includes('kilo') || mat.unit.toLowerCase().includes('rollo'))) {
                        amountToDeduct = amountToDeduct / 1000;
                    }
                    addDeduction(mat.id, amountToDeduct);
                }
            }
        });
    }
  }

  // 4. Batch Updates
  if (updates.size > 0) {
    const promises = Array.from(updates.entries()).map(async ([id, totalDeduct]) => {
      const mat = materials.find((m) => m.id === id);
      if (mat) {
        const currentQty = Number(mat.quantity);
        const newQty = Math.max(0, currentQty - totalDeduct);
        const roundedNewQty = Math.round(newQty * 1000) / 1000;

        const { error: updateError } = await supabaseClient
          .from('raw_materials')
          .update({ quantity: roundedNewQty })
          .eq('id', id);
          
        if (updateError) console.error(`[Stock WEB] Error updating ${mat.name}:`, updateError);
      }
    });
    await Promise.all(promises);
  }
}

