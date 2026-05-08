const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

let resendClient = null;
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!resendClient && apiKey) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Generates a PDF buffer for a single ticket
 * Optimized for a single A5 page with a professional "Electronic Music" aesthetic
 */
async function generateTicketPDF(ticket, brandLogoPath) {
  // Try to get event details if not present
  let eventDate = 'Consultar fecha';
  let eventLocation = 'Por confirmar';

  // If the ticket has an event object attached (from an include)
  if (ticket.event) {
    if (ticket.event.date) eventDate = new Date(ticket.event.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (ticket.event.location) eventLocation = ticket.event.location;
  } else {
    // Fallback if event is not attached (should ideally be attached before calling this)
    try {
      const Event = require('../models/Event');
      const event = await Event.findByPk(ticket.eventId);
      if (event) {
        eventDate = new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        eventLocation = event.location;
      }
    } catch (err) {
      console.warn('Could not fetch event details for PDF', err);
    }
  }

  return new Promise((resolve, reject) => {
    // Use A5 but portrait and tight controls
    const doc = new PDFDocument({
      size: 'A5',
      margin: 0,
      info: {
        Title: `Ticket ${ticket.eventName}`,
        Author: '808 PULSE',
      }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Design System
    const BRAND_COLOR = process.env.BRAND_COLOR || '#00ffff'; // Neon Cyan
    const BG_COLOR = '#05090d'; // Deep Dark
    const CARD_BG = '#0b0f14'; // Slightly lighter dark
    const TEXT_LIGHT = '#eafcff';
    const TEXT_MUTED = '#9cc9d3';

    const width = doc.page.width;
    const height = doc.page.height;

    // 1. Background
    doc.rect(0, 0, width, height).fill(BG_COLOR);

    // 2. Side Accent Bar
    doc.rect(0, 0, 8, height).fill(BRAND_COLOR);

    // 3. Header Section (Logo only - Centered & Proportional)
    const margin = 30;
    let currentY = 15;

    try {
      if (brandLogoPath && fs.existsSync(brandLogoPath)) {
        // Use fit to maintain aspect ratio and center horizontally
        doc.image(brandLogoPath, 0, currentY, {
          fit: [width, 50],
          align: 'center'
        });
      } else {
        doc.fillColor(BRAND_COLOR)
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('PULSE', 0, currentY + 10, { align: 'center', width: width, characterSpacing: 3 });
      }
    } catch (e) {
      console.error('Error drawing logo:', e);
    }

    // 4. Main Event Card
    currentY = 80;
    const cardHeight = 460;
    const cardWidth = width - (margin * 2);

    // Subtle Outer Glow
    doc.roundedRect(margin - 4, currentY - 4, cardWidth + 8, cardHeight + 8, 14).fill('rgba(0,255,255,0.02)');
    doc.roundedRect(margin, currentY, cardWidth, cardHeight, 10).fill(CARD_BG);

    // Gradient-like border
    doc.roundedRect(margin, currentY, cardWidth, cardHeight, 10).lineWidth(1).stroke('rgba(0,255,255,0.25)');

    // Event Title (Centered)
    currentY += 30;
    doc.fillColor(TEXT_LIGHT)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(ticket.eventName ? ticket.eventName.toUpperCase() : 'EVENTO', margin + 10, currentY, {
        width: cardWidth - 20,
        align: 'center',
        height: 55,
        ellipsis: true
      });

    // Divider with centered pulses
    currentY += 60;
    const dividerWidth = cardWidth - 80;
    const dividerX = (width / 2) - (dividerWidth / 2);

    doc.circle(dividerX, currentY, 2).fill(BRAND_COLOR);
    doc.moveTo(dividerX + 5, currentY)
      .lineTo(dividerX + dividerWidth - 5, currentY)
      .lineWidth(0.5)
      .stroke('rgba(0, 255, 255, 0.4)');
    doc.circle(dividerX + dividerWidth, currentY, 2).fill(BRAND_COLOR);

    // Event Details (Strictly Centered)
    currentY += 20;
    doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica').text('FECHA Y HORA', 0, currentY, { align: 'center', width: width });
    currentY += 12;
    doc.fillColor(TEXT_LIGHT).fontSize(12).font('Helvetica-Bold').text(eventDate.toUpperCase(), 0, currentY, { align: 'center', width: width });

    currentY += 25;
    doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica').text('UBICACIÓN', 0, currentY, { align: 'center', width: width });
    currentY += 12;
    doc.fillColor(TEXT_LIGHT).fontSize(11).font('Helvetica-Bold').text(eventLocation.toUpperCase(), 0, currentY, { align: 'center', width: width });

    // 5. QR Code Section (Large & Centered)
    currentY += 40;
    const qrSize = 160;
    const qrX = (width / 2) - (qrSize / 2);

    // QR Window 
    doc.roundedRect(qrX - 15, currentY - 15, qrSize + 30, qrSize + 30, 12).fill('#000000');
    doc.roundedRect(qrX - 15, currentY - 15, qrSize + 30, qrSize + 30, 12).lineWidth(1).stroke('rgba(0, 255, 255, 0.5)');

    // QR White background for maximum scanability
    doc.rect(qrX - 5, currentY - 5, qrSize + 10, qrSize + 10).fill('#ffffff');

    const qrMatch = /^data:(.+);base64,(.+)$/.exec(ticket.qrData || '');
    if (qrMatch) {
      const qrBuffer = Buffer.from(qrMatch[2], 'base64');
      doc.image(qrBuffer, qrX, currentY, { width: qrSize });
    }

    // 6. Ticket Identification Info (Centered)
    currentY += qrSize + 40;
    doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica').text('TICKET ID', 0, currentY, { align: 'center', width: width });
    currentY += 10;
    doc.fillColor(BRAND_COLOR).fontSize(11).font('Helvetica-Bold').text(ticket.ticketId, 0, currentY, { align: 'center', width: width });

    currentY += 20;
    doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica').text('ASISTENTE', 0, currentY, { align: 'center', width: width });
    currentY += 10;

    let assistantText = ticket.customerName.toUpperCase();
    if (ticket.customerCedula) {
      assistantText += ` (C.C. ${ticket.customerCedula})`;
    }

    doc.fillColor(TEXT_LIGHT).fontSize(13).font('Helvetica-Bold').text(assistantText, 0, currentY, { align: 'center', width: width });

    // 7. Footer / Terms
    doc.fontSize(7)
      .fillColor('#445566')
      .font('Helvetica')
      .text('Válido para un solo ingreso. Presenta este QR en la entrada.', 0, height - 35, { align: 'center', width: width });

    doc.fillColor(BRAND_COLOR)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('PULSE', 0, height - 20, { align: 'center', width: width, characterSpacing: 5 });

    doc.end();
  });
}

async function sendTicketsEmail(to, order, tickets) {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[EmailService] RESEND_API_KEY no detectado. Omite envío.');
    return { sent: false, reason: 'api_key_not_configured' };
  }

  const BRAND = process.env.BRAND_NAME || '808 PULSE';
  const BRAND_COLOR = process.env.BRAND_COLOR || '#00ffff';
  const TEXT_LIGHT = '#eafcff';
  const TEXT_MUTED = '#9cc9d3';
  const attachments = [];

  // Define the public URL for the brand logo to display in the email body
  const logoUrl = `${process.env.BASE_URL || 'http://localhost:3002'}/assets/img/logos/logo-menta.png`;

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

  // Extract unique events from tickets to display their flyers in the email
  const uniqueEvents = [];
  const eventIds = new Set();
  // Use FRONTEND_URL for assets (Netlify), BASE_URL only for backend endpoints
  const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3002';

  for (const t of tickets) {
    const eventId = t.eventId;
    if (!eventIds.has(eventId)) {
      eventIds.add(eventId);

      // Priority: ticket.event.image (attached by ticketService) → getDataValue fallback
      const rawImage = (t.event && t.event.image)
        ? t.event.image
        : (t.getDataValue ? t.getDataValue('eventImage') : null);

      const eventData = {
        name: t.eventName || 'Evento',
        image: rawImage,
        description: t.event ? t.event.description : ''
      };

      uniqueEvents.push(eventData);
    }
  }

  const flyersHtml = uniqueEvents.map(ev => {
    return `
      <div style="margin-bottom: 30px; border-radius: 12px; overflow: hidden; background: #111821; border: 1px solid rgba(0,255,255,0.1);">
        <div style="padding: 24px 20px; text-align: center; border-bottom: 2px solid ${BRAND_COLOR};">
          <h2 style="color: ${TEXT_LIGHT}; margin: 0; font-size: 22px; letter-spacing: 4px; font-weight: 700;">${ev.name.toUpperCase()}</h2>
        </div>
      </div>
    `;
  }).join('');

  const totalStr = (order.total || 0).toLocaleString('es-CO');
  const preheader = `Tus tickets para la orden ${order.orderId}`;

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>${BRAND} - Tickets</title>
  </head>
  <body style="margin:0; padding:0; background:#05090d; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
    <table width="100%" bgcolor="#05090d" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 10px;">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#0b0f14; border:1px solid rgba(0,255,255,0.2); border-radius:16px;">
            <tr><td style="height:5px; background:${BRAND_COLOR}; border-radius:16px 16px 0 0;"></td></tr>
            <tr>
              <td align="center" style="padding:30px;">
                <img src="${logoUrl}" height="50" style="margin-bottom:30px;" alt="808 PULSE">
                
                <h1 style="color:${TEXT_LIGHT}; margin:0; font-size:26px; font-weight: bold;">¡TU ACCESO ESTÁ LISTO!</h1>
                <p style="color:${TEXT_MUTED}; font-size:16px; margin:15px 0 30px 0;">
                  Hola <strong>${order.customerName}</strong>, gracias por tu compra. Tus tickets han sido generados exitosamente.
                </p>

                <!-- Flyer Section -->
                ${flyersHtml}

                <div style="background:rgba(0,255,255,0.03); border:1px dashed rgba(0,255,255,0.2); border-radius:12px; padding:25px; margin:30px 0; text-align: left;">
                  <h3 style="color:${BRAND_COLOR}; margin: 0 0 15px 0; font-size: 14px; letter-spacing: 1px;">DETALLES DE LA COMPRA</h3>
                  <p style="color:${TEXT_LIGHT}; margin:5px 0; font-size: 15px;"><strong>Orden:</strong> #${order.orderId.substring(0, 8).toUpperCase()}</p>
                  <p style="color:${TEXT_LIGHT}; margin:5px 0; font-size: 15px;"><strong>Total Pagado:</strong> $${totalStr}</p>
                  <p style="color:${TEXT_LIGHT}; margin:5px 0; font-size: 15px;"><strong>Cantidad:</strong> ${tickets.length} ticket(s)</p>
                </div>

                <div style="background: ${BRAND_COLOR}; color: #000; padding: 15px; border-radius: 8px; font-weight: bold; font-size: 14px; margin-bottom: 25px;">
                  LOS TICKETS ESTÁN ADJUNTOS EN ESTE CORREO COMO PDF
                </div>

                <p style="color:${TEXT_MUTED}; font-size:13px; line-height: 1.6;">
                  Busca los archivos adjuntos en este email. Cada PDF contiene un código QR único que deberás presentar en la entrada (digital o impreso).
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:30px; border-top:1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); border-radius: 0 0 16px 16px;">
                <p style="color:#445566; font-size:12px; margin:0; letter-spacing: 2px;">808 PULSE - ELECTRONIC MUSIC EVENTS</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // Clean up attachments specifically for Resend (BaseURL URLs already taking care of flyers)
  const safeAttachments = attachments.filter(a => a.contentType === 'application/pdf').map(a => ({
    filename: a.filename,
    content: a.content // Resend accepts streams, buffers or base64
  }));

  try {
    const response = await resend.emails.send({
      from: process.env.SMTP_FROM || '808 PULSE <no-reply@808pulse.com>',
      to,
      subject: `Tus tickets (${tickets.length}) - Orden ${order.orderId}`,
      html,
      attachments: safeAttachments
    });

    // Resend SDK v2+ returns { data, error } instead of throwing
    if (response.error) {
      console.error('[EmailService] Resend API Error:', response.error);
      return { sent: false, reason: response.error.message };
    }

    return { sent: true, messageId: response.data ? response.data.id : null };
  } catch (error) {
    console.error('[EmailService] Catch Error:', error);
    return { sent: false, reason: error.message };
  }
}

module.exports = { sendTicketsEmail };
