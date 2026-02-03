// Notification handler using Make.com Webhook
// This allows flexible routing of notifications (WhatsApp, Email, Telegram) configured in Make.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, message } = req.body;

  // Make.com Webhook URL provided by user
  const MAKE_WEBHOOK_URL =
    "https://hook.us2.make.com/3du519txd4fyw541s7gtcfnto432gmeg";

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    // We send a JSON payload to Make
    const payload = {
      phone: phone,
      message: message, // Can contain markdown like *bold*
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    console.log("[Notification] Sent to Make.com:", text);

    return res.status(200).json({ success: true, provider: "Make.com" });
  } catch (error) {
    console.error("[Notification] Error sending to Make:", error);
    return res.status(500).json({ error: error.message });
  }
}
