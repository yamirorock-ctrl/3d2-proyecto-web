import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

// Initialize Supabase
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export default async function handler(req, res) {
  try {
    // 1. Handling Notification Inputs
    const topic = req.query?.topic || req.body?.topic;
    const resource = req.query?.resource || req.body?.resource; // e.g., "/orders/123456"

    // Quick ping response for ML
    if (req.method === "GET") {
      return res.status(200).send("OK");
    }

    console.log(`[ML Webhook] Received: ${topic} -> ${resource}`);

    if (!supabase) {
      console.error("[ML Webhook] Supabase not configured");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    // 2. We only care about ORDERS for now (Stock deduction + Notification)
    if (topic !== "orders_v2" && topic !== "orders") {
      // Ignore other topics like questions or items updates to save resources
      return res.status(200).json({ ignored: true, topic });
    }

    // 3. Fetch valid ML Token to query the Order details
    const { data: tokenData, error: tokenError } = await supabase
      .from("ml_tokens")
      .select("access_token, user_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Webhook] No ML Token found to fetch order details.");
      return res.status(200).json({ error: "No token" }); // Return 200 to stop ML retries
    }

    // 4. Fetch Order Details from MercadoLibre
    const mlResponse = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!mlResponse.ok) {
      console.error(`[ML Webhook] Failed to fetch order: ${mlResponse.status}`);
      return res.status(200).json({ error: "ML API Error" });
    }

    const order = await mlResponse.json();
    const orderId = order.id;
    const totalAmount = order.total_amount;
    const buyerName = order.buyer?.first_name + " " + order.buyer?.last_name;

    // 5. Process Items
    const orderItems = order.order_items || [];
    let itemsProcessed = [];

    for (const item of orderItems) {
      const mlItemId = item.item.id;
      const quantity = item.quantity;
      const title = item.item.title;

      // Find product in our DB
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("ml_item_id", mlItemId);

      const product = products && products.length > 0 ? products[0] : null;

      if (product) {
        // Decrement Stock
        const newStock = Math.max(0, (product.stock || 0) - quantity);
        await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", product.id);

        itemsProcessed.push(`${quantity}x ${product.name}`);
        console.log(
          `[ML Webhook] Stock updated for ${product.name}: ${product.stock} -> ${newStock}`,
        );
      } else {
        itemsProcessed.push(`${quantity}x ${title} (No vinculado)`);
        console.log(`[ML Webhook] Product not linked locally: ${mlItemId}`);
      }
    }

    // 6. Send WhatsApp Notification
    const message = `💰 *¡Nueva Venta ML!*
    
🆔 Orden: ${orderId}
👤 Comprador: ${buyerName}
💵 Total: $${totalAmount}

📦 *Productos:*
${itemsProcessed.join("\n")}

_Stock actualizado automáticamente_ ✅`;

    // Internal call to notify-whatsapp (or direct fetch if preferred to keep it simple)
    const whatsappNum = process.env.VITE_WHATSAPP_NUMBER || "5491171285516";
    const apiKey =
      process.env.CALLMEBOT_API_KEY || process.env.VITE_CALLMEBOT_API_KEY;

    if (apiKey) {
      const encodedMsg = encodeURIComponent(message);
      await fetch(
        `https://api.callmebot.com/whatsapp.php?phone=${whatsappNum}&text=${encodedMsg}&apikey=${apiKey}`,
      );
      console.log("[ML Webhook] WhatsApp sent.");
    } else {
      console.log("[ML Webhook] WhatsApp skipped (No API Key).");
    }

    return res.status(200).json({ success: true, order: orderId });
  } catch (e) {
    console.error("[ML Webhook] Error:", e);
    return res.status(500).json({ error: e.message });
  }
}
