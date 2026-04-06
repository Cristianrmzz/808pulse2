const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Order, OrderItem } = require('../models/Order');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const TicketService = require('../services/ticketService');
const { sendTicketsEmail } = require('../services/emailService');

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
    try {
        const { items, customerInfo } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item' });
        }

        let total = 0;
        const orderItems = [];

        // Validate each item and calculate total
        for (const item of items) {
            const event = await Event.findByPk(item.eventId);
            if (!event) {
                return res.status(404).json({ message: `Event not found: ${item.eventId}` });
            }

            if (!event.hasAvailableTickets(item.quantity)) {
                return res.status(400).json({
                    message: `Not enough tickets available for ${event.name}. Available: ${event.getAvailableTickets()}`
                });
            }

            const subtotal = item.quantity * event.price;
            total += subtotal;

            orderItems.push({
                eventId: event.id,
                eventName: event.name,
                quantity: item.quantity,
                price: event.price,
                subtotal: subtotal,
                attendees: item.attendees || []
            });
        }

        // Create order
        const order = await Order.create({
            orderId: uuidv4(),
            total: total,
            customerName: customerInfo?.name || null,
            customerPhone: customerInfo?.phone || null,
            customerEmail: customerInfo?.email || null
        });

        // Create order items
        for (const item of orderItems) {
            await OrderItem.create({
                orderId: order.id,
                eventId: item.eventId,
                eventName: item.eventName,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal,
                attendees: item.attendees
            });
        }

        // Update ticket counts for each event
        for (const item of orderItems) {
            await Event.increment('ticketsSold', {
                by: item.quantity,
                where: { id: item.eventId }
            });
        }

        // Fetch the complete order with items
        const savedOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem, as: 'items' }]
        });

        res.status(201).json(savedOrder);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Error creating order' });
    }
});

// GET /api/orders - Get all orders
router.get('/', async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: [{ model: OrderItem, as: 'items' }],
            order: [['createdAt', 'DESC']]
        });
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// GET /api/orders/:orderId - Get single order
router.get('/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { orderId: req.params.orderId },
            include: [{ model: OrderItem, as: 'items' }]
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Error fetching order' });
    }
});

// PUT /api/orders/:orderId - Update order details
router.put('/:orderId', async (req, res) => {
    try {
        const { customerInfo, status, items: updatedItems } = req.body;

        const order = await Order.findOne({
            where: { orderId: req.params.orderId },
            include: [{ model: OrderItem, as: 'items' }]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Update basic info
        let emailChanged = false;
        if (customerInfo) {
            if (customerInfo.name !== undefined) order.customerName = customerInfo.name;
            if (customerInfo.phone !== undefined) order.customerPhone = customerInfo.phone;
            if (customerInfo.email !== undefined) {
                if (customerInfo.email !== order.customerEmail) {
                    emailChanged = true;
                }
                order.customerEmail = customerInfo.email;
            }
        }

        if (status && ['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
            // If status is changing TO cancelled, return tickets
            if (status === 'cancelled' && order.status !== 'cancelled') {
                for (const item of order.items) {
                    await Event.increment('ticketsSold', {
                        by: -item.quantity,
                        where: { id: item.eventId }
                    });
                }
            }
            // If status is changing FROM cancelled, take tickets back
            else if (status !== 'cancelled' && order.status === 'cancelled') {
                for (const item of order.items) {
                    await Event.increment('ticketsSold', {
                        by: item.quantity,
                        where: { id: item.eventId }
                    });
                }
            }
            order.status = status;
        }

        // Update items (quantities) and sync tickets
        let orderChanged = emailChanged;
        if (updatedItems && Array.isArray(updatedItems)) {
            let newTotal = 0;
            for (const updatedItem of updatedItems) {
                const existingItem = order.items.find(i => i.id === updatedItem.id);
                if (existingItem) {
                    const quantityDiff = updatedItem.quantity - existingItem.quantity;

                    if (quantityDiff !== 0) {
                        orderChanged = true;
                        // Check availability if increasing
                        if (quantityDiff > 0) {
                            const event = await Event.findByPk(existingItem.eventId);
                            if (!event.hasAvailableTickets(quantityDiff)) {
                                return res.status(400).json({
                                    message: `Not enough tickets available for ${event.name}.`
                                });
                            }
                        }

                        // Update event inventory
                        await Event.increment('ticketsSold', {
                            by: quantityDiff,
                            where: { id: existingItem.eventId }
                        });

                        // Update item
                        existingItem.quantity = updatedItem.quantity;
                        existingItem.subtotal = updatedItem.quantity * existingItem.price;
                        await existingItem.save();

                        // Sync Tickets
                        if (order.status === 'confirmed') {
                            if (quantityDiff > 0) {
                                // Generate new tickets
                                await TicketService.generateTickets(
                                    order.id,
                                    existingItem.eventId,
                                    existingItem.eventName,
                                    { name: order.customerName, phone: order.customerPhone },
                                    quantityDiff
                                );
                            } else if (quantityDiff < 0) {
                                // Remove unused tickets (active status)
                                const ticketsToRemove = await Ticket.findAll({
                                    where: {
                                        orderId: order.id,
                                        eventId: existingItem.eventId,
                                        status: 'active'
                                    },
                                    limit: Math.abs(quantityDiff),
                                    order: [['createdAt', 'DESC']]
                                });
                                for (const t of ticketsToRemove) {
                                    await t.destroy();
                                }
                            }
                        }
                    }
                    newTotal += Number(existingItem.subtotal);
                }
            }
            order.total = newTotal;
        }

        await order.save();

        // --- EMAIL RESEND LOGIC ---
        // If anything important changed (email, quantity, or status became confirmed), resend tickets
        if (order.status === 'confirmed' && order.customerEmail && orderChanged) {
            try {
                const tickets = await TicketService.getTicketsByOrder(order.id);
                if (tickets && tickets.length > 0) {
                    // Enrich tickets with event image (needed for email)
                    for (const t of tickets) {
                        const event = await Event.findByPk(t.eventId);
                        if (event) t.setDataValue('eventImage', event.image);
                    }
                    await sendTicketsEmail(order.customerEmail, order, tickets);
                    console.log(`[Orders] Tickets updated/resent to ${order.customerEmail} for order ${order.orderId}`);
                }
            } catch (emailError) {
                console.error('[Orders] Error resending tickets email:', emailError);
            }
        }

        // Refresh order data
        const savedOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem, as: 'items' }]
        });

        res.json(savedOrder);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ message: 'Error updating order' });
    }
});

// PUT /api/orders/:orderId/status - Update order status (legacy/minimal)
router.put('/:orderId/status', async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const order = await Order.findOne({
            where: { orderId: req.params.orderId },
            include: [{ model: OrderItem, as: 'items' }]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // If order is cancelled, return tickets to inventory
        if (status === 'cancelled' && order.status !== 'cancelled') {
            for (const item of order.items) {
                await Event.increment('ticketsSold', {
                    by: -item.quantity,
                    where: { id: item.eventId }
                });
            }
        }

        await order.update({ status });
        res.json(order);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
});

// POST /api/orders/whatsapp - Create order from WhatsApp data
router.post('/whatsapp', async (req, res) => {
    try {
        const { encodedData } = req.body;

        if (!encodedData) {
            return res.status(400).json({ message: 'Encoded data is required' });
        }

        // Decode the order data
        const orderData = JSON.parse(Buffer.from(encodedData, 'base64').toString());

        // Create order from decoded data
        const order = await Order.create({
            orderId: uuidv4(),
            total: orderData.total,
            paymentMethod: 'whatsapp'
        });

        // Create order items
        for (const item of orderData.items) {
            await OrderItem.create({
                orderId: order.id,
                eventId: item.id,
                eventName: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.quantity * item.price
            });
        }

        // Fetch the complete order with items
        const savedOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem, as: 'items' }]
        });

        res.status(201).json(savedOrder);
    } catch (error) {
        console.error('Error processing WhatsApp order:', error);
        res.status(500).json({ message: 'Error processing WhatsApp order' });
    }
});

module.exports = router;
