const { sequelize } = require('../config/database');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { Order, OrderItem } = require('../models/Order');
const { Op } = require('sequelize');

async function cleanup() {
    try {
        await sequelize.authenticate();
        console.log('🔗 Conectado a la BD para limpieza profunda...');

        // 1. Identificar eventos que NO son Lourdes
        const eventsToDelete = await Event.findAll({
            where: {
                name: { [Op.ne]: 'Lourdes' }
            }
        });
        const eventIds = eventsToDelete.map(e => e.id);

        if (eventIds.length > 0) {
            console.log(`⚠️ Encontrados ${eventIds.length} eventos para borrar. Procediendo con datos vinculados...`);

            // 2. Borrar Tickets vinculados a esos eventos
            const ticketsDeleted = await Ticket.destroy({ where: { eventId: { [Op.in]: eventIds } } });
            console.log(`- Borrados ${ticketsDeleted} tickets.`);

            // 3. Borrar OrderItems vinculados a esos eventos
            const itemsDeleted = await OrderItem.destroy({ where: { eventId: { [Op.in]: eventIds } } });
            console.log(`- Borrados ${itemsDeleted} ítems de órdenes.`);

            // 4. Borrar Órdenes que hayan quedado vacías (opcional, pero limpio todo para empezar de cero)
            // Para simplificar, borramos todas las órdenes antiguas
            const ordersDeleted = await Order.destroy({ where: {} });
            console.log(`- Borradas ${ordersDeleted} órdenes totales para limpieza completa.`);

            // 5. Finalmente borrar los eventos
            const eventsDeleted = await Event.destroy({ where: { id: { [Op.in]: eventIds } } });
            console.log(`- Borrados ${eventsDeleted} eventos.`);
        } else {
            console.log('No había otros eventos que borrar.');
        }

        // 6. Asegurar que Lourdes exista
        const [lourdes, created] = await Event.findOrCreate({
            where: { name: 'Lourdes' },
            defaults: {
                date: new Date('2024-06-15T22:00:00Z'),
                location: 'Lourdes Music Hall',
                price: 80000,
                image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop',
                description: 'Una experiencia musical única en el corazón de la ciudad.',
                capacity: 500,
                isActive: true
            }
        });

        if (created) {
            console.log('✅ Evento "Lourdes" creado exitosamente.');
        } else {
            console.log('ℹ️ El evento "Lourdes" ya existía.');
        }

        console.log('🚀 Base de datos optimizada y limpia.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
        process.exit(1);
    }
}

cleanup();
