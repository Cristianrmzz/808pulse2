const { sequelize } = require('../config/database');

async function addColumn() {
    try {
        await sequelize.authenticate();
        console.log('Conectado...');

        await sequelize.query("ALTER TABLE orders ADD customerCedula VARCHAR(255) AFTER customerEmail;");
        console.log('✅ Columna customerCedula añadida a la tabla orders.');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addColumn();
