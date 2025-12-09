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

  const {
    customer_name,
    customer_email,
    customer_phone,
    technology,
    description,
    timestamp,
  } = req.body;

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

    // Email Content
    const mailOptions = {
      from: `"3D2 Web" <${process.env.EMAIL_USER}>`, // Sender identity
      to: process.env.EMAIL_USER, // Send to the company email (Admin Notification)
      replyTo: customer_email, // Allow replying directly to the customer
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
            ${description.replace(/\n/g, "<br/>")}
          </blockquote>
          
          <p style="font-size: 12px; color: #888; margin-top: 30px;">
            Enviado el: ${new Date().toLocaleString("es-AR")}
          </p>
        </div>
      `,
    };

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
