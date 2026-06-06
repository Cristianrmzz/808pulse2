const express = require('express');
const router = express.Router();
const TicketService = require('../services/ticketService');
const { Order } = require('../models/Order');
const Ticket = require('../models/Ticket');

// POST /api/tickets/generate - Generar tickets después de confirmar pago
router.post('/generate', async (req, res) => {
    try {
        const { orderId, customerInfo } = req.body;

        if (!orderId || !customerInfo || !customerInfo.name || !customerInfo.phone) {
            return res.status(400).json({
                message: 'Se requiere orderId y información del cliente (name, phone)'
            });
        }

        // Verificar que la orden existe y está confirmada
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        if (order.status !== 'confirmed') {
            return res.status(400).json({
                message: 'La orden debe estar confirmada para generar tickets'
            });
        }

        // Generar tickets
        const tickets = await TicketService.generateTicketsForOrder(orderId, customerInfo);

        res.status(201).json({
            message: 'Tickets generados exitosamente',
            tickets: tickets.map(ticket => ({
                ticketId: ticket.ticketId,
                eventName: ticket.eventName,
                // qrData removido para ahorrar memoria
                expiresAt: ticket.expiresAt
            }))
        });

    } catch (error) {
        console.error('Error generando tickets:', error);
        res.status(500).json({ message: 'Error generando tickets' });
    }
});

// GET /api/tickets/verify/:token - Verificar un ticket por su token QR
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await TicketService.verifyTicket(token);

        if (result.valid) {
            res.json({
                valid: true,
                ticket: result.ticket
            });
        } else {
            res.status(400).json({
                valid: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Error verificando ticket:', error);
        res.status(500).json({ message: 'Error verificando ticket' });
    }
});

// POST /api/tickets/use/:token - Marcar ticket como usado
router.post('/use/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await TicketService.useTicket(token);

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                ticket: result.ticket
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message,
                details: result.details // Añadido para mostrar info de uso previo
            });
        }

    } catch (error) {
        console.error('Error usando ticket:', error);
        res.status(500).json({ message: 'Error usando ticket' });
    }
});

// GET /api/tickets/order/:orderId - Obtener tickets de una orden
router.get('/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const tickets = await TicketService.getTicketsByOrder(orderId);

        res.json({
            tickets: tickets.map(ticket => ({
                ticketId: ticket.ticketId,
                eventName: ticket.eventName,
                customerName: ticket.customerName,
                status: ticket.status,
                // qrData removido para ahorrar memoria
                expiresAt: ticket.expiresAt,
                usedAt: ticket.usedAt
            }))
        });

    } catch (error) {
        console.error('Error obteniendo tickets:', error);
        res.status(500).json({ message: 'Error obteniendo tickets' });
    }
});

// POST /api/tickets/confirm-payment - Confirmar pago y generar tickets
router.post('/confirm-payment', async (req, res) => {
    try {
        const { orderId, customerInfo, paymentProof } = req.body;

        if (!orderId || !customerInfo) {
            return res.status(400).json({
                message: 'Se requiere orderId y información del cliente'
            });
        }

        // Actualizar estado de la orden a confirmada
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Actualizar información del cliente en la orden
        await order.update({
            status: 'confirmed',
            customerName: customerInfo.name,
            customerPhone: customerInfo.phone,
            customerEmail: customerInfo.email || null
        });

        // Generar tickets automáticamente
        const tickets = await TicketService.generateTicketsForOrder(orderId, customerInfo);

        res.json({
            message: 'Pago confirmado y tickets generados',
            order: {
                orderId: order.orderId,
                status: order.status,
                total: order.total
            },
            tickets: tickets.map(ticket => ({
                ticketId: ticket.ticketId,
                eventName: ticket.eventName,
                // qrData removido para ahorrar memoria
                expiresAt: ticket.expiresAt
            }))
        });

    } catch (error) {
        console.error('Error confirmando pago:', error);
        res.status(500).json({ message: 'Error confirmando pago' });
    }
});

module.exports = router;
