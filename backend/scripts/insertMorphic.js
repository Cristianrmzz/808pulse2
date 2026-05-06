const { sequelize } = require('../config/database');
const Event = require('../models/Event');

async function insertMorphic() {
    try {
        await sequelize.authenticate();

        // Sincronizar sin forzar (para no borrar lo que ya está)
        await sequelize.sync();

        const morphicEvent = {
            name: "MORPHIC",
            date: new Date("2026-06-15"), // Puedes editarla en el panel
            location: "Por Confimar",
            price: 50000,
            image: "assets/img/Flayers/morphic.jpg", // La ruta que averiguamos
            description: "No te pierdas esta edición especial.",
            capacity: 1000,
            isActive: true
        };

        await Event.create(morphicEvent);
        console.log('✅ Evento MORPHIC insertado exitosamente en la BD de Railway.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error insertando MORPHIC:', error);
        process.exit(1);
    }
}

insertMorphic();
