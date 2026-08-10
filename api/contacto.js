// Archivo: api/contacto.js

export default async function handler(req, res) {
  // Solo aceptamos peticiones POST (envío de formulario)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Capturamos los datos que envió el HTML
  const { nombre, email, telefono, mensaje } = req.body;

  try {
    // Usamos la API de Resend para enviarte el correo
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', // Resend usa este correo de prueba gratis
        to: 'growstudio.w@gmail.com', // <--- ¡CAMBIA ESTO POR TU CORREO REAL AQUÍ!
        subject: `🔥 NUEVA COTIZACIÓN: ${nombre}`,
        html: `
          <h2>Nueva solicitud de proyecto en Grow Studio</h2>
          <p><strong>Cliente/Empresa:</strong> ${nombre}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>WhatsApp/Teléfono:</strong> ${telefono}</p>
          <p><strong>Parámetros del proyecto:</strong></p>
          <p>${mensaje}</p>
        `
      })
    });

    const data = await response.json();

    if (response.ok) {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ error: data });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}