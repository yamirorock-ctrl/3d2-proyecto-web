export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, message } = req.body;
  const apiKey =
    process.env.CALLMEBOT_API_KEY || process.env.VITE_CALLMEBOT_API_KEY;

  if (!phone || !message) {
    return res.status(400).json({ error: "Missing phone or message" });
  }

  if (!apiKey) {
    console.warn(
      "[WhatsApp] No se encontró API Key de CallMeBot. La notificación no se enviará.",
    );
    return res.status(200).json({
      skipped: true,
      reason:
        "Missing API Key. Get one for free at https://www.callmebot.com/blog/free-api-whatsapp-messages/",
    });
  }

  try {
    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;

    const response = await fetch(url);
    const text = await response.text();

    // CallMeBot usually returns simple text like "Message queued"
    console.log("[WhatsApp] Response:", text);

    return res.status(200).json({ success: true, provider_response: text });
  } catch (error) {
    console.error("[WhatsApp] Error sending message:", error);
    return res.status(500).json({ error: error.message });
  }
}
