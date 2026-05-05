const { sequelize } = require('../config/database');
const Event = require('../models/Event');

async function updateImage() {
    try {
        await sequelize.authenticate();
        console.log('Conectado a la BD...');

        const [updatedRows] = await Event.update(
            { image: 'assets/img/Flayers/morphic.jpg' },
            { where: { name: 'MORPHIC' } }
        );

        if (updatedRows > 0) {
            console.log('✅ Imagen de MORPHIC actualizada en la Base de Datos.');
        } else {
            // Intentar con una búsqueda más flexible por si el nombre varía un poco
            const event = await Event.findOne({ where: { name: { [require('sequelize').Op.like]: '%MORPHIC%' } } });
            if (event) {
                event.image = 'assets/Flayers/morphic.jpg';
                await event.save();
                console.log('✅ Imagen de MORPHIC actualizada (búsqueda flexible).');
            } else {
                console.log('❌ No se encontró el evento "MORPHIC" en la base de datos para actualizar.');
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateImage();
