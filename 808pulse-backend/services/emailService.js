const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';

  if (!host || !user || !pass) {
    console.warn('[EmailService] SMTP no configurado. Defina SMTP_HOST, SMTP_USER, SMTP_PASS en .env');
    return null;
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

function dataUrlToAttachment(dataUrl, filenameBase, index) {
  // dataUrl: data:image/png;base64,AAAA
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  const buffer = Buffer.from(b64, 'base64');
  const ext = mime.split('/')[1] || 'png';
  return {
    filename: `${filenameBase || 'ticket'}-${index + 1}.${ext}`,
    content: buffer,
    contentType: mime,
    cid: `ticket${index + 1}@qr` // para inline en HTML
  };
}

async function sendTicketsEmail(to, order, tickets) {
  const transporter = createTransport();
  if (!transporter) {
    console.warn('[EmailService] No transporter. Se omite envío.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = process.env.SMTP_FROM || `808 PULSE <no-reply@808pulse.local>`;
  const BRAND = process.env.BRAND_NAME || '808 PULSE';
  const BRAND_COLOR = process.env.BRAND_COLOR || '#00ffff';
  const ACCENT_BG = '#0b0f14';
  const TEXT_LIGHT = '#eafcff';
  const TEXT_MUTED = '#9cc9d3';

  const attachments = [];

  // Try to attach brand logo by CID
  let logoCid = null;
  try {
    const explicitPath = process.env.BRAND_LOGO_PATH && process.env.BRAND_LOGO_PATH.trim();
    const fallbackPath = path.resolve(__dirname, '..', '..', 'Menta sin fondo.png');
    const logoPath = explicitPath ? explicitPath : fallbackPath;
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      const ext = path.extname(logoPath).replace('.', '') || 'png';
      logoCid = 'brandlogo@808pulse';
      attachments.push({ filename: `brand-logo.${ext}`, content: logoBuffer, contentType: `image/${ext}`, cid: logoCid });
    }
  } catch (e) {
    console.warn('[EmailService] No se pudo cargar el logo de marca:', e.message);
  }
  const ticketItemsHtml = tickets.map((t, i) => {
    const att = dataUrlToAttachment(t.qrData, t.ticketId || 'ticket', i);
    if (att) attachments.push(att);
    const token = t.qrToken || (t.verifyUrl ? new URL(t.verifyUrl).pathname.split('/').pop() : '');
    // Ticket card (responsive-friendly table layout)
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0; background:${ACCENT_BG}; border:1px solid rgba(0,255,255,0.22); border-radius:14px; box-shadow:0 0 14px rgba(0,255,255,0.18);">
        <tr>
          <td style="padding:16px 16px 16px 16px; vertical-align:top;">
            <div style="font-weight:700; font-size:15px; color:${TEXT_LIGHT}; line-height:1.3;">${t.ticketId || ''} — ${t.eventName || ''}</div>
            <div style="font-size:12px; color:${TEXT_MUTED}; margin-top:6px;">Token: ${token}</div>
            ${t.verifyUrl ? `
              <div style="margin-top:10px;">
                <a href="${t.verifyUrl}" style="display:inline-block; padding:8px 12px; background:${BRAND_COLOR}; color:#0a0f12; text-decoration:none; border-radius:8px; font-weight:600;">Verificar ticket</a>
              </div>
            ` : ''}
          </td>
          ${att ? `
          <td align="right" style="padding:16px; vertical-align:middle;">
            <img src="cid:${att.cid}" alt="QR" width="160" height="160" style="display:block; border-radius:10px; box-shadow:0 0 10px rgba(0,255,255,0.25);"/>
          </td>` : ''}
        </tr>
      </table>
    `;
  }).join('');

  const totalStr = (order.total || 0).toLocaleString('es-CO');
  const preheader = `Tus tickets para la orden ${order.orderId}`;
  // Use the event flyer as watermark if provided by ticketService (first available)
  const flyerUrl = (tickets && tickets.find(t => t.eventImage)?.eventImage) || null;
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${BRAND} - Tickets</title>
  </head>
  <body style="margin:0; padding:0; background:#05090d;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05090d; background-image: radial-gradient(circle at 1px 1px, rgba(0,255,255,0.035) 1px, transparent 1.2px); background-size: 14px 14px;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px; max-width:100%; background:rgba(11,15,20,0.7); border:1px solid rgba(0,255,255,0.2); border-radius:16px; box-shadow:0 0 26px rgba(0,255,255,0.22); backdrop-filter: blur(8px);">
            <!-- Neon Banner Strip -->
            <tr>
              <td style="height:8px; background:${BRAND_COLOR}; filter: drop-shadow(0 0 8px rgba(0,255,255,0.8)); border-top-left-radius:16px; border-top-right-radius:16px;"></td>
            </tr>
            <!-- Header -->
            <tr>
              <td align="center" style="padding:28px 20px; border-bottom:1px solid rgba(255,255,255,0.08); background: radial-gradient(120px 60px at 50% 0%, rgba(0,255,255,0.18), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent);">
                ${logoCid ? `<img src="cid:${logoCid}" alt="${BRAND} Logo" height="72" style="display:block; margin:0 auto 12px auto; border-radius:10px; box-shadow:0 0 12px rgba(0,255,255,0.35);"/>` : ''}
                <div style="font-size:28px; font-weight:800; color:${TEXT_LIGHT}; letter-spacing:0.5px; text-shadow:0 0 10px rgba(0,255,255,0.25);">${BRAND}</div>
                <div style="margin-top:6px; font-size:13px; color:${TEXT_MUTED};">Tus tickets están listos</div>
              </td>
            </tr>
            <!-- Watermark (very subtle) -->
            ${flyerUrl ? `
            <tr>
              <td align="center" style="padding:0;">
                <img src="${flyerUrl}" alt="Marca de agua del evento" height="220" style="display:block; margin:16px auto -12px auto; opacity:0.06; filter:saturate(75%);"/>
              </td>
            </tr>` : ''}
            <!-- Greeting -->
            <tr>
              <td style="padding:20px 22px; color:${TEXT_LIGHT}; font-family:Arial, Helvetica, sans-serif;">
                <div style="font-size:16px;">Hola ${order.customerName || ''},</div>
                <p style="margin:8px 0 0; font-size:14px; color:${TEXT_MUTED}; line-height:1.6;">
                  Gracias por tu compra. Presenta estos códigos QR en la entrada del evento. Te recomendamos mantener este correo a la mano el día del evento.
                </p>
              </td>
            </tr>
            <!-- Tickets list -->
            <tr>
              <td style="padding:0 22px 10px 22px;">
                ${ticketItemsHtml}
              </td>
            </tr>
            <!-- Order footer -->
            <tr>
              <td style="padding:12px 22px 22px 22px; color:${TEXT_MUTED}; font-size:12px;">
                <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:12px; display:flex; justify-content:space-between;">
                  <span>Orden: <strong style="color:${TEXT_LIGHT}">${order.orderId}</strong></span>
                  <span>Total: <strong style="color:${TEXT_LIGHT}">$${totalStr}</strong></span>
                </div>
              </td>
            </tr>
            <!-- Help -->
            <tr>
              <td align="center" style="padding:0 22px 26px 22px;">
                <a href="mailto:${process.env.SMTP_USER || 'soporte@808pulse.local'}" style="display:inline-block; padding:10px 16px; border:1px solid rgba(0,255,255,0.45); color:${TEXT_LIGHT}; text-decoration:none; border-radius:10px; box-shadow:0 0 10px rgba(0,255,255,0.2);">¿Necesitas ayuda?</a>
              </td>
            </tr>
          </table>
          <div style="color:${TEXT_MUTED}; font-size:11px; margin-top:12px;">Por favor no compartas tus códigos QR. Cada ticket es válido para una sola entrada.</div>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  const info = await transporter.sendMail({
    from,
    to,
    subject: `Tus tickets - Orden ${order.orderId}`,
    html,
    attachments
  });

  return { sent: true, messageId: info.messageId };
}

module.exports = { sendTicketsEmail };
