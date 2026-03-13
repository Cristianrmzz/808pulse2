const dotenv = require('dotenv');
const { sequelize } = require('../config/database');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');

// Load environment variables
dotenv.config();

const eventsData = [
    {
        name: "Neon Dreams Fest",
        date: new Date("2025-10-25"),
        location: "Centro de Eventos Metropolitano",
        price: 150000,
        image: "https://images.unsplash.com/photo-1582711012103-60a6539455f8?q=80&w=1974&auto=format&fit=crop",
        description: "Una experiencia única de música electrónica con los mejores DJs internacionales",
        capacity: 2000
    },
    {
        name: "Lourdes - Techno Odyssey",
        date: new Date("2025-12-20"),
        location: "Distrito Popular - CLL 14 #11-95",
        price: 20000,
        image: "http://localhost:8088/Lourdes_Techno_Odyssey.png",
        description: "LINE UP: SPOCK, ZAREK, R4MMY B2B SYNAPSYS, DANPOXX B2B LUZITHYX, TENDO B2B SANDOVAL DV. Preventa: 20K - Taquilla: 25K",
        capacity: 1500
    },
    {
        name: "Pulse Warehouse Rave",
        date: new Date("2025-12-06"),
        location: "Lugar Secreto (se revela 24h antes)",
        price: 180000,
        image: "https://images.unsplash.com/photo-1543306979-041433994a32?q=80&w=2070&auto=format&fit=crop",
        description: "El evento más exclusivo del año en una ubicación secreta",
        capacity: 800
    }
];

const seedDatabase = async () => {
    try {
        // Connect to MySQL
        await sequelize.authenticate();
        console.log('✅ Connected to MySQL database');

        // Sync database (create tables)
        await sequelize.sync({ force: true });
        console.log('✅ Database tables synchronized');

        // Insert new events
        const insertedEvents = await Event.bulkCreate(eventsData);
        console.log(`✅ Inserted ${insertedEvents.length} events:`);

        insertedEvents.forEach(event => {
            console.log(`   - ${event.name} (${event.date.toDateString()})`);
        });

        console.log('🎵 Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
