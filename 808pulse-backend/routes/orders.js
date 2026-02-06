const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Order, OrderItem } = require('../models/Order');
const Event = require('../models/Event');

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
                subtotal: subtotal
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
                subtotal: item.subtotal
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

// PUT /api/orders/:orderId/status - Update order status
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
        if (status === 'cancelled') {
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
