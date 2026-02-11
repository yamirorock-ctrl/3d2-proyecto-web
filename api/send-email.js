import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*"); // Adjust this in production if needed
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type } = req.body;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Missing email credentials");
    return res
      .status(500)
      .json({ error: "Server email configuration missing" });
  }

  try {
    // Configure Outlook SMTP Transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: "SSLv3",
      },
    });

    // Verify connection
    await transporter.verify();

    let mailOptions = {};

    if (type === "new_sale") {
      const {
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        items,
        total,
        shipping_method,
        notes,
      } = req.body;

      const itemsHtml = (items || [])
        .map(
          (item) =>
            `<li>${item.quantity}x ${item.title || item.product_id} - $${item.price}</li>`,
        )
        .join("");

      mailOptions = {
        from: `"3D2 Ventas" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: `[Nueva Venta] Orden #${order_number} - ${customer_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #10b981;">¡Nueva Venta Realizada! 💰</h2>
            <p>Se ha registrado una nueva orden exitosa en el sistema.</p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top:0;">Orden #${order_number}</h3>
              <p style="font-size: 24px; font-weight: bold; color: #111;">Total: $${Number(total).toLocaleString("es-AR")}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Cliente:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${customer_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${customer_email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Teléfono:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${customer_phone || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Envío:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${shipping_method}</td>
              </tr>
              ${notes ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Notas:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${notes}</td></tr>` : ""}
            </table>
            
            <h3>Productos:</h3>
            <ul>${itemsHtml}</ul>
            
            <p style="font-size: 12px; color: #888; margin-top: 30px;">
              Sistema de Ventas 3D2 - ${new Date().toLocaleString("es-AR")}
            </p>
          </div>
        `,
      };
    } else {
      // Default: Custom Order
      const {
        customer_name,
        customer_email,
        customer_phone,
        technology,
        description,
      } = req.body;

      mailOptions = {
        from: `"3D2 Web" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        replyTo: customer_email,
        subject: `[Nuevo Pedido Personalizado] ${customer_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #4f46e5;">Nuevo Pedido Personalizado Recibido</h2>
            <p>Se ha recibido una nueva solicitud desde la web.</p>
            
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            
            <h3>Detalles del Cliente</h3>
            <p><strong>Nombre:</strong> ${customer_name}</p>
            <p><strong>Email:</strong> ${customer_email}</p>
            <p><strong>Teléfono:</strong> ${customer_phone || "No indicado"}</p>
            
            <h3>Detalles del Proyecto</h3>
            <p><strong>Tecnología:</strong> ${technology}</p>
            <p><strong>Descripción:</strong></p>
            <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #4f46e5;">
              ${description ? description.replace(/\n/g, "<br/>") : ""}
            </blockquote>
            
            <p style="font-size: 12px; color: #888; margin-top: 30px;">
              Enviado el: ${new Date().toLocaleString("es-AR")}
            </p>
          </div>
        `,
      };
    }

    // Send Email
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);

    return res
      .status(200)
      .json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send email",
      details: error.message,
    });
  }
}
