const express = require('express');
const router = express.Router();
const TicketService = require('../services/ticketService');
const { Order, OrderItem } = require('../models/Order');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { authRequired, adminOnly } = require('../middleware/auth');
const { sendTicketsEmail } = require('../services/emailService');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// Proteger todas las rutas de admin
router.use(authRequired, adminOnly);

// GET /api/admin/orders - Ver todas las órdenes pendientes (PAGINADO)
router.get('/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const { count, rows: orders } = await Order.findAndCountAll({
            include: [{ model: OrderItem, as: 'items' }],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.json({
            orders: orders.map(order => ({
                id: order.id,
                orderId: order.orderId,
                total: order.total,
                status: order.status,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                customerEmail: order.customerEmail,
                createdAt: order.createdAt,
                items: order.items.map(item => ({
                    eventName: item.eventName,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.subtotal
                }))
            })),
            pagination: {
                total: count,
                pages: Math.ceil(count / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ message: 'Error obteniendo órdenes' });
    }
});

// POST /api/admin/confirm-payment/:orderId - Confirmar pago y generar QRs
router.post('/confirm-payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { customerName, customerPhone, customerEmail, customerCedula } = req.body || {};

        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Si no se envían datos, usar los que ya tiene la orden
        const finalName = customerName || order.customerName || 'Cliente';
        const finalPhone = customerPhone || order.customerPhone || 'N/A';
        const finalEmail = customerEmail || order.customerEmail || null;
        const finalCedula = customerCedula || order.customerCedula || null;

        // Actualizar orden con información del cliente y confirmar pago
        await order.update({
            status: 'confirmed',
            customerName: finalName,
            customerPhone: finalPhone,
            customerEmail: finalEmail,
            customerCedula: finalCedula
        });

        // Generar tickets con QR únicos
        const customerInfo = { name: finalName, phone: finalPhone, cedula: finalCedula };
        const tickets = await TicketService.generateTicketsForOrder(orderId, customerInfo);

        // Enviar tickets por correo si hay email
        let emailStatus = { sent: false };
        try {
            if (order.customerEmail) {
                // Enrich tickets with event image (needed for email)
                for (const t of tickets) {
                    const event = await Event.findByPk(t.eventId);
                    if (event) t.setDataValue('eventImage', event.image);
                }
                const emailResult = await sendTicketsEmail(order.customerEmail, order, tickets);
                emailStatus = emailResult;
            }
        } catch (err) {
            console.error('[ADMIN] Error enviando tickets por email:', err);
            emailStatus = { sent: false, error: err?.message || 'email_error' };
        }

        res.json({
            message: 'Pago confirmado y tickets generados exitosamente',
            order: {
                orderId: order.orderId,
                status: order.status,
                total: order.total,
                customerName: order.customerName,
                customerPhone: order.customerPhone
            },
            email: emailStatus,
            tickets: tickets.map(ticket => ({
                ticketId: ticket.ticketId,
                eventName: ticket.eventName,
                qrToken: ticket.qrToken,
                // qrData removido para ahorrar memoria en el response
                expiresAt: ticket.expiresAt,
                verifyUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/tickets/verify/${ticket.qrToken}`
            }))
        });

    } catch (error) {
        console.error('[ADMIN] Error confirmando pago:', error?.stack || error);
        res.status(500).json({ message: 'Error confirmando pago', details: error?.message || 'unknown' });
    }
});

// GET /api/admin/tickets - Ver todos los tickets (PAGINADO)
router.get('/tickets', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const { count, rows: tickets } = await Ticket.findAndCountAll({
            attributes: { exclude: ['qrData'] },
            include: [
                { model: Event, as: 'event' },
                { model: Order, as: 'order' }
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.json({
            tickets: tickets.map(ticket => ({
                ticketId: ticket.ticketId,
                eventName: ticket.eventName,
                qrToken: ticket.qrToken,
                customerName: ticket.customerName,
                customerPhone: ticket.customerPhone,
                status: ticket.status,
                expiresAt: ticket.expiresAt,
                usedAt: ticket.usedAt,
                createdAt: ticket.createdAt
            })),
            pagination: {
                total: count,
                pages: Math.ceil(count / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error('Error obteniendo tickets:', error);
        res.status(500).json({ message: 'Error obteniendo tickets' });
    }
});

// POST /api/admin/scan-ticket/:token - Escanear QR en la entrada del evento
router.post('/scan-ticket/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await TicketService.useTicket(token);

        // Si falló pero es porque ya fue usado, asegurar que devolvemos 400 pero con la data
        if (!result.success && result.message.includes('ya utilizado')) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error escaneando ticket:', error);
        res.status(500).json({ message: 'Error escaneando ticket' });
    }
});

// GET /api/admin/dashboard - Dashboard con estadísticas
router.get('/dashboard', async (req, res) => {
    try {
        const [totalOrders, confirmedOrders, totalTickets, usedTickets] = await Promise.all([
            Order.count(),
            Order.count({ where: { status: 'confirmed' } }),
            Ticket.count(),
            Ticket.count({ where: { status: 'used' } })
        ]);

        res.json({
            stats: {
                totalOrders,
                confirmedOrders,
                pendingOrders: totalOrders - confirmedOrders,
                totalTickets,
                usedTickets,
                activeTickets: totalTickets - usedTickets
            }
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ message: 'Error obteniendo estadísticas' });
    }
});

// GET /api/admin/accounting - Contabilidad por evento
router.get('/accounting', async (req, res) => {
    try {
        const { from, to } = req.query;
        // Construir filtros de fecha
        const orderDateWhere = {};
        const ticketDateWhere = {};
        if (from && to) {
            const fromDate = new Date(from);
            const toDate = new Date(to);
            if (!isNaN(fromDate) && !isNaN(toDate)) {
                // incluir fin del día para 'to'
                toDate.setHours(23, 59, 59, 999);
                orderDateWhere.createdAt = { [Op.between]: [fromDate, toDate] };
                ticketDateWhere.createdAt = { [Op.between]: [fromDate, toDate] };
            }
        } else if (from) {
            const fromDate = new Date(from);
            if (!isNaN(fromDate)) {
                orderDateWhere.createdAt = { [Op.gte]: fromDate };
                ticketDateWhere.createdAt = { [Op.gte]: fromDate };
            }
        } else if (to) {
            const toDate = new Date(to);
            if (!isNaN(toDate)) {
                toDate.setHours(23, 59, 59, 999);
                orderDateWhere.createdAt = { [Op.lte]: toDate };
                ticketDateWhere.createdAt = { [Op.lte]: toDate };
            }
        }
        // Agregados de ingresos y entradas vendidas por evento (solo órdenes confirmadas)
        const revenueAgg = await OrderItem.findAll({
            attributes: [
                'eventId',
                'eventName',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'ticketsSold'],
                [sequelize.fn('SUM', sequelize.col('subtotal')), 'revenue']
            ],
            include: [{ model: Order, required: true, where: Object.assign({ status: 'confirmed' }, orderDateWhere), attributes: [] }],
            group: ['eventId', 'eventName']
        });

        // Agregados de tickets generados y usados por evento
        const ticketsAgg = await Ticket.findAll({
            attributes: [
                'eventId',
                'eventName',
                [sequelize.fn('COUNT', sequelize.col('id')), 'ticketsGenerated'],
                [sequelize.literal("SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END)"), 'ticketsUsed']
            ],
            where: ticketDateWhere,
            group: ['eventId', 'eventName']
        });

        // Mapear resultados
        const byEvent = new Map();
        for (const r of revenueAgg) {
            const key = String(r.get('eventId'));
            byEvent.set(key, {
                eventId: Number(r.get('eventId')),
                eventName: r.get('eventName'),
                ticketsSold: Number(r.get('ticketsSold')) || 0,
                revenue: Number(r.get('revenue')) || 0,
                ticketsGenerated: 0,
                ticketsUsed: 0
            });
        }
        for (const t of ticketsAgg) {
            const key = String(t.get('eventId'));
            const existing = byEvent.get(key) || {
                eventId: Number(t.get('eventId')),
                eventName: t.get('eventName'),
                ticketsSold: 0,
                revenue: 0,
                ticketsGenerated: 0,
                ticketsUsed: 0
            };
            existing.ticketsGenerated = Number(t.get('ticketsGenerated')) || 0;
            existing.ticketsUsed = Number(t.get('ticketsUsed')) || 0;
            byEvent.set(key, existing);
        }

        // También incluir eventos sin ventas para contexto
        const events = await Event.findAll({ attributes: ['id', 'name'] });
        for (const ev of events) {
            const key = String(ev.id);
            if (!byEvent.has(key)) {
                byEvent.set(key, {
                    eventId: ev.id,
                    eventName: ev.name,
                    ticketsSold: 0,
                    revenue: 0,
                    ticketsGenerated: 0,
                    ticketsUsed: 0
                });
            }
        }

        const data = Array.from(byEvent.values()).sort((a, b) => a.eventId - b.eventId);
        res.json({ accounting: data });
    } catch (error) {
        console.error('Error obteniendo contabilidad:', error);
        res.status(500).json({ message: 'Error obteniendo contabilidad' });
    }
});

// DELETE /api/admin/accounting/event/:eventId - Vaciar contabilidad de un evento (BORRADO TOTAL)
router.delete('/accounting/event/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const t = await sequelize.transaction();
    try {
        // 1. Obtener IDs de las órdenes que contienen este evento
        const orderItems = await OrderItem.findAll({ where: { eventId } });
        const orderIds = [...new Set(orderItems.map(oi => oi.orderId))];

        // 2. Eliminar tickets del evento
        await Ticket.destroy({ where: { eventId }, transaction: t });

        // 3. Eliminar items del evento
        await OrderItem.destroy({ where: { eventId }, transaction: t });

        // 4. Limpiar órdenes vacías (si existían solo para ese evento)
        for (const oId of orderIds) {
            const remainingItems = await OrderItem.count({ where: { orderId: oId }, transaction: t });
            if (remainingItems === 0) {
                await Order.destroy({ where: { id: oId }, transaction: t });
            }
        }

        // 5. Reiniciar contador en el evento
        await Event.update({ ticketsSold: 0 }, { where: { id: eventId }, transaction: t });

        await t.commit();
        res.json({ message: 'Contabilidad del evento reiniciada correctamente' });
    } catch (err) {
        await t.rollback();
        console.error('Error vaciando contabilidad:', err);
        res.status(500).json({ message: 'Error al vaciar contabilidad' });
    }
});

// DELETE /api/admin/accounting/event/:eventId/last - Borrar únicamente la ÚLTIMA venta realizada de este evento
router.delete('/accounting/event/:eventId/last', async (req, res) => {
    const { eventId } = req.params;
    const t = await sequelize.transaction();
    try {
        // Encontrar el último ítem vendido de este evento
        const lastItem = await OrderItem.findOne({
            where: { eventId },
            order: [['id', 'DESC']],
            transaction: t
        });

        if (!lastItem) {
            await t.rollback();
            return res.status(404).json({ message: 'No se encontraron ventas para este evento' });
        }

        const qty = lastItem.quantity;
        const orderId = lastItem.orderId;

        // 1. Eliminar tickets de este item
        await Ticket.destroy({
            where: {
                orderId: lastItem.orderId,
                eventId: eventId
            },
            transaction: t
        });

        // 2. Eliminar el item de la orden
        await lastItem.destroy({ transaction: t });

        // 3. Si la orden se quedó sin items, borrar la orden
        const remainingItems = await OrderItem.count({ where: { orderId }, transaction: t });
        if (remainingItems === 0) {
            await Order.destroy({ where: { id: orderId }, transaction: t });
        }

        // 4. Devolver stock al evento (reducir ticketsSold)
        const event = await Event.findByPk(eventId, { transaction: t });
        if (event) {
            await event.decrement('ticketsSold', { by: qty, transaction: t });
        }

        await t.commit();
        res.json({ message: 'Última venta eliminada y stock devuelto' });
    } catch (err) {
        await t.rollback();
        console.error('Error borrando última venta:', err);
        res.status(500).json({ message: 'Error al borrar última venta' });
    }
});

module.exports = router;

// --- BULK CLEANUP ENDPOINTS ---
// Nota: por seguridad, protegidas por authRequired/adminOnly vía router.use

// DELETE /api/admin/orders - Limpieza PROFUNDA de órdenes (Borrón y cuenta nueva)
router.delete('/orders', async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // 1. Eliminar todos los tickets
        await Ticket.destroy({ where: {}, transaction: t });

        // 2. Eliminar todos los items de órdenes
        await OrderItem.destroy({ where: {}, transaction: t });

        // 3. Eliminar todas las órdenes
        const deleted = await Order.destroy({ where: {}, transaction: t });

        // 4. Reiniciar el contador de tickets vendidos en TODOS los eventos
        await Event.update({ ticketsSold: 0 }, { where: {}, transaction: t });

        // 5. Reiniciar los contadores de ID (AutoIncrement) para empezar desde 1
        // Nota: Esto es específico de MySQL
        await sequelize.query("ALTER TABLE tickets AUTO_INCREMENT = 1;", { transaction: t });
        await sequelize.query("ALTER TABLE order_items AUTO_INCREMENT = 1;", { transaction: t });
        await sequelize.query("ALTER TABLE orders AUTO_INCREMENT = 1;", { transaction: t });

        await t.commit();
        res.json({ message: 'Sistema reiniciado: órdenes, tickets y contadores limpios', deleted });
    } catch (err) {
        await t.rollback();
        console.error('[ADMIN] Deep cleanup failed:', err);
        res.status(500).json({ message: 'Error en la limpieza profunda' });
    }
});

// DELETE /api/admin/tickets - Limpieza de tickets por filtros
// body: { status?: 'active'|'used', beforeDate?: ISOString, eventId?: number }
router.delete('/tickets', async (req, res) => {
    const { status, beforeDate, eventId } = req.body || {};
    const where = {};
    if (status) where.status = status;
    if (eventId) where.eventId = eventId;
    if (beforeDate) {
        const d = new Date(beforeDate);
        if (!isNaN(d)) where.createdAt = { [Op.lt]: d };
    }
    try {
        const deleted = await Ticket.destroy({ where });
        res.json({ deleted });
    } catch (err) {
        console.error('[ADMIN] cleanup tickets failed:', err);
        res.status(500).json({ message: 'Error limpiando tickets' });
    }
});
