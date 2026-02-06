const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { authRequired, adminOnly } = require('../middleware/auth');

// GET /api/events - Get all active events
router.get('/', async (req, res) => {
    try {
        const events = await Event.findAll({
            where: { isActive: true },
            order: [['date', 'ASC']]
        });
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
});

// GET /api/events/:id - Get single event
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Error fetching event' });
    }
});

// POST /api/events - Create new event (admin only)
router.post('/', authRequired, adminOnly, async (req, res) => {
    try {
        const { name, date, location, price, image, description, capacity } = req.body;
        
        const event = await Event.create({
            name,
            date,
            location,
            price,
            image,
            description,
            capacity
        });

        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Error creating event' });
    }
});

// PUT /api/events/:id - Update event (admin only)
router.put('/:id', authRequired, adminOnly, async (req, res) => {
    try {
        const [updatedRowsCount] = await Event.update(req.body, {
            where: { id: req.params.id }
        });
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        const updatedEvent = await Event.findByPk(req.params.id);
        res.json(updatedEvent);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Error updating event' });
    }
});

// DELETE /api/events/:id - Delete event (admin only)
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
    try {
        const [updatedRowsCount] = await Event.update(
            { isActive: false },
            { where: { id: req.params.id } }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        res.json({ message: 'Event deactivated successfully' });
    } catch (error) {
        console.error('Error deactivating event:', error);
        res.status(500).json({ message: 'Error deactivating event' });
    }
});

module.exports = router;
