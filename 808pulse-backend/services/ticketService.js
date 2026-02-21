const QRCode = require('qrcode');
const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const { Order, OrderItem } = require('../models/Order');
const Event = require('../models/Event');

class TicketService {

    // Generar tickets después de confirmar el pago
    static async generateTicketsForOrder(orderId, customerInfo) {
        try {
            console.log('[TicketService] Generando tickets para orden:', orderId, 'cliente:', customerInfo);
            // Buscar la orden con sus items
            const order = await Order.findByPk(orderId, {
                include: [{ model: OrderItem, as: 'items' }]
            });

            if (!order) {
                throw new Error('Orden no encontrada');
            }

            if (order.status !== 'confirmed') {
                throw new Error('La orden debe estar confirmada para generar tickets');
            }

            const tickets = [];

            // Generar tickets para cada item de la orden
            for (const item of order.items) {
                console.log('[TicketService] Procesando item:', {
                    eventId: item.eventId,
                    eventName: item.eventName,
                    quantity: item.quantity
                });
                const event = await Event.findByPk(item.eventId);
                if (!event) {
                    throw new Error(`Evento no encontrado (id=${item.eventId})`);
                }

                // Generar la cantidad de tickets solicitada
                for (let i = 0; i < item.quantity; i++) {
                    const ticketData = {
                        orderId: order.id,
                        eventId: item.eventId,
                        eventName: item.eventName,
                        customerName: customerInfo.name,
                        customerPhone: customerInfo.phone,
                        eventDate: event.date
                    };

                    const ticket = await Ticket.create(ticketData);
                    console.log('[TicketService] Ticket creado (sin QR):', ticket.ticketId);

                    // Generar datos del QR
                    const qrData = await this.generateQRData(ticket);
                    ticket.qrData = qrData;
                    // Adjuntar imagen del evento en dataValues para el email (no persiste columna separada)
                    ticket.setDataValue('eventImage', event.image);
                    await ticket.save();
                    console.log('[TicketService] QR generado y guardado para ticket:', ticket.ticketId);

                    // No marcar como usado automáticamente: se deshabilita solo al primer escaneo

                    tickets.push(ticket);
                }
            }

            return tickets;
        } catch (error) {
            console.error('[TicketService] Error generando tickets:', error?.stack || error);
            throw new Error(error?.message || 'Error interno al generar tickets');
        }
    }

    // Generar datos únicos para el QR
    static async generateQRData(ticket) {
        const qrContent = {
            ticketId: ticket.ticketId,
            token: ticket.qrToken,
            eventId: ticket.eventId,
            eventName: ticket.eventName,
            customerName: ticket.customerName,
            verifyUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/tickets/verify/${ticket.qrToken}`
        };

        // Generar el código QR como base64
        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrContent), {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        return qrCodeDataURL;
    }

    // Verificar un ticket por su token QR
    static async verifyTicket(qrToken) {
        try {
            const ticket = await Ticket.findOne({
                where: { qrToken },
                include: [
                    { model: Event, as: 'event' }
                ]
            });

            if (!ticket) {
                return { valid: false, message: 'Ticket no encontrado' };
            }

            // Sin expiración temporal: solo invalida si ya fue usado o está cancelado
            if (ticket.status === 'cancelled') {
                return { valid: false, message: 'Ticket cancelado' };
            }
            if (ticket.status === 'used') {
                return {
                    valid: false,
                    message: `QR ya utilizado por ${ticket.customerName}`,
                    details: {
                        customerName: ticket.customerName,
                        usedAt: ticket.usedAt,
                        ticketId: ticket.ticketId
                    }
                };
            }

            return {
                valid: true,
                ticket: {
                    ticketId: ticket.ticketId,
                    eventName: ticket.eventName,
                    customerName: ticket.customerName,
                    status: ticket.status,
                    used: ticket.status === 'used',
                    usedAt: ticket.usedAt || null
                }
            };
        } catch (error) {
            console.error('Error verificando ticket:', error);
            return { valid: false, message: 'Error interno del servidor' };
        }
    }

    // Marcar ticket como usado (al ingresar al evento)
    static async useTicket(qrToken) {
        try {
            const ticket = await Ticket.findOne({ where: { qrToken } });

            if (!ticket) {
                return { success: false, message: 'Ticket no encontrado' };
            }

            if (!ticket.isValid()) {
                return {
                    success: false,
                    message: ticket.status === 'used'
                        ? `QR ya utilizado por ${ticket.customerName} el ${new Date(ticket.usedAt).toLocaleString('es-ES')}`
                        : 'Ticket cancelado',
                    details: ticket.status === 'used' ? {
                        customerName: ticket.customerName,
                        usedAt: ticket.usedAt,
                        ticketId: ticket.ticketId
                    } : undefined
                };
            }

            await ticket.markAsUsed();

            return {
                success: true,
                message: 'Ticket utilizado exitosamente',
                ticket: {
                    ticketId: ticket.ticketId,
                    eventName: ticket.eventName,
                    customerName: ticket.customerName,
                    usedAt: ticket.usedAt
                }
            };
        } catch (error) {
            console.error('Error usando ticket:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    // Obtener todos los tickets de una orden
    static async getTicketsByOrder(orderId) {
        try {
            const tickets = await Ticket.findAll({
                where: { orderId },
                include: [
                    { model: Event, as: 'event' }
                ]
            });

            return tickets;
        } catch (error) {
            console.error('Error obteniendo tickets:', error);
            throw error;
        }
    }

    // Generar un número específico de tickets para un evento y orden
    static async generateTickets(orderId, eventId, eventName, customerInfo, quantity) {
        const tickets = [];
        const event = await Event.findByPk(eventId);
        if (!event) throw new Error(`Evento no encontrado (id=${eventId})`);

        for (let i = 0; i < quantity; i++) {
            const ticketData = {
                orderId: orderId,
                eventId: eventId,
                eventName: eventName,
                customerName: customerInfo.name,
                customerPhone: customerInfo.phone
            };

            const ticket = await Ticket.create(ticketData);
            const qrData = await this.generateQRData(ticket);
            ticket.qrData = qrData;
            await ticket.save();
            tickets.push(ticket);
        }
        return tickets;
    }
}

module.exports = TicketService;
