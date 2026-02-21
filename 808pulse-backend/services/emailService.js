const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

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

/**
 * Generates a PDF buffer for a single ticket
 */
async function generateTicketPDF(ticket, brandLogoPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 30 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const BRAND_COLOR = process.env.BRAND_COLOR || '#00ffff';
    const BG_COLOR = '#05090d';
    const CARD_BG = '#0b0f14';

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BG_COLOR);

    // Header Border
    doc.rect(0, 0, doc.page.width, 10).fill(BRAND_COLOR);

    // Logo
    try {
      if (brandLogoPath && fs.existsSync(brandLogoPath)) {
        doc.image(brandLogoPath, doc.page.width / 2 - 40, 30, { height: 60 });
      }
    } catch (e) {
      console.error('Error adding logo to PDF:', e);
    }

    doc.moveDown(5);

    // Brand Name
    doc.fillColor(BRAND_COLOR).fontSize(24).text('808 PULSE', { align: 'center', characterSpacing: 2 });
    doc.fillColor('#eafcff').fontSize(10).text('Tu acceso a la música electrónica', { align: 'center' });

    doc.moveDown(2);

    // Ticket Card
    const cardTop = doc.y;
    doc.roundedRect(40, cardTop, doc.page.width - 80, 260, 15).fill(CARD_BG);
    doc.roundedRect(40, cardTop, doc.page.width - 80, 260, 15).lineWidth(1).stroke('rgba(0,255,255,0.3)');

    // QR Code
    const qrMatch = /^data:(.+);base64,(.+)$/.exec(ticket.qrData || '');
    if (qrMatch) {
      const qrBuffer = Buffer.from(qrMatch[2], 'base64');
      doc.image(qrBuffer, doc.page.width / 2 - 75, cardTop + 20, { width: 150 });
    }

    // Info
    doc.fillColor('#eafcff').fontSize(14).text(ticket.eventName || 'Evento', 50, cardTop + 185, { align: 'center', width: doc.page.width - 100 });
    doc.fillColor('#9cc9d3').fontSize(10).text(`Ticket ID: ${ticket.ticketId}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#eafcff').fontSize(11).text(`Cliente: ${ticket.customerName}`, { align: 'center' });

    // Footer info
    doc.fontSize(8).fillColor('#445566').text('Presenta este QR en la entrada - Válido para un solo uso', 0, doc.page.height - 30, { align: 'center' });

    doc.end();
  });
}

async function sendTicketsEmail(to, order, tickets) {
  const transporter = createTransport();
  if (!transporter) {
    console.warn('[EmailService] No transporter. Se omite envío.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const BRAND = process.env.BRAND_NAME || '808 PULSE';
  const BRAND_COLOR = process.env.BRAND_COLOR || '#00ffff';
  const TEXT_LIGHT = '#eafcff';
  const TEXT_MUTED = '#9cc9d3';
  const attachments = [];

  const logoPath = process.env.BRAND_LOGO_PATH || path.resolve(__dirname, '..', '..', 'Menta sin fondo.png');
  let logoCid = null;
  if (fs.existsSync(logoPath)) {
    const extension = path.extname(logoPath).substring(1);
    logoCid = 'brandlogo@808pulse';
    attachments.push({
      filename: `logo.${extension}`,
      path: logoPath,
      cid: logoCid
    });
  }

  // Generate individual PDFs for each ticket
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    try {
      const pdfBuffer = await generateTicketPDF(ticket, logoPath);
      attachments.push({
        filename: `Ticket-${ticket.ticketId || (i + 1)}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    } catch (err) {
      console.error(`Error generating PDF for ticket ${ticket.ticketId}:`, err);
    }
  }

  const totalStr = (order.total || 0).toLocaleString('es-CO');
  const preheader = `Tus tickets para la orden ${order.orderId}`;

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>${BRAND} - Tickets</title>
  </head>
  <body style="margin:0; padding:0; background:#05090d; font-family: sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
    <table width="100%" bgcolor="#05090d" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 10px;">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#0b0f14; border:1px solid rgba(0,255,255,0.2); border-radius:16px;">
            <tr><td style="height:5px; background:${BRAND_COLOR}; border-radius:16px 16px 0 0;"></td></tr>
            <tr>
              <td align="center" style="padding:30px;">
                ${logoCid ? `<img src="cid:${logoCid}" height="60" style="margin-bottom:20px;">` : ''}
                <h1 style="color:${TEXT_LIGHT}; margin:0; font-size:24px;">¡Hola ${order.customerName}!</h1>
                <p style="color:${TEXT_MUTED}; font-size:16px; margin:15px 0;">
                  Tus tickets para <strong>${BRAND}</strong> están listos. 
                  Los hemos adjuntado a este correo como archivos PDF individuales.
                </p>
                <div style="background:rgba(0,255,255,0.05); border:1px dashed rgba(0,255,255,0.3); border-radius:10px; padding:20px; margin:20px 0;">
                  <p style="color:${TEXT_LIGHT}; margin:5px 0;"><strong>Orden:</strong> ${order.orderId}</p>
                  <p style="color:${TEXT_LIGHT}; margin:5px 0;"><strong>Total:</strong> $${totalStr}</p>
                  <p style="color:${TEXT_LIGHT}; margin:5px 0;"><strong>Tickets adjuntos:</strong> ${tickets.length}</p>
                </div>
                <p style="color:${TEXT_MUTED}; font-size:14px;">
                  Por favor, descarga los archivos PDF y presenta los códigos QR en la entrada del evento.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px; border-top:1px solid rgba(255,255,255,0.05);">
                <p style="color:#445566; font-size:12px; margin:0;">808 PULSE - Electronic Events Platform</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || `808 PULSE <no-reply@808pulse.local>`,
    to,
    subject: `Tus tickets (${tickets.length}) - Orden ${order.orderId}`,
    html,
    attachments
  });

  return { sent: true, messageId: info.messageId };
}

module.exports = { sendTicketsEmail };
