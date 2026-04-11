export default async function handler(req, res) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_MZMsg14U_6M3Tk5rhrjen7xK5K3MGmrLa";

  try {
    const { type, order_number, customer_name, customer_email, total, items, shipping_method, notes, attachment_base64 } = req.body;

    const itemsHtml = (items || [])
      .map(item => `<li>${item.quantity}x ${item.title || item.product_id} - $${item.price}</li>`)
      .join("");

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background: #111; color: #fff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Creart 3D2</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #10b981;">¡Gracias por tu compra, ${customer_name}! 🚀</h2>
          <p>Tu orden <strong>#${order_number}</strong> ha sido registrada exitosamente.</p>
          ${attachment_base64 ? `
          <div style="background: #e0e7ff; color: #3730a3; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #4f46e5; font-size: 14px;">
            <strong>¡Gracias por tu compra! 📄</strong><br />
            Hemos adjuntado tu factura. ¡Gracias por elegirnos, volvé cuando quieras, te esperamos!
          </div>
          ` : ""}
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 25px 0;">
            <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: bold;">Total Pagado</p>
            <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: 800; color: #0f172a;">$${Number(total).toLocaleString("es-AR")}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>Metodo de Envío:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${shipping_method}</td></tr>
            ${notes ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>Notas:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${notes}</td></tr>` : ""}
          </table>

          <h3 style="border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 30px;">Detalle de Productos</h3>
          <ul style="padding-left: 20px; line-height: 1.6;">${itemsHtml}</ul>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #94a3b8; font-size: 12px;">
            Este es un correo automático de Creart 3D2. Por consultas, contactanos por WhatsApp.
          </div>
        </div>
      </div>
    `;

    // 🚀 Llamada a la API de Resend (Vía Fetch para mayor velocidad)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "Creart 3D2 <ventas@creart3d2.com>",
        to: ["creart3d2@gmail.com", customer_email].filter(Boolean),
        subject: `Confirmación de Orden #${order_number} - Creart 3D2`,
        html: emailHtml,
        attachments: attachment_base64 ? [
          {
            filename: `Factura-${order_number}.pdf`,
            content: attachment_base64
          }
        ] : undefined
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Error en Resend API");

    return res.status(200).json({ success: true, id: result.id });

  } catch (error) {
    console.error("Resend Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
