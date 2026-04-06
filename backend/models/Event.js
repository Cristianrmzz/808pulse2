const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    image: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    capacity: {
        type: DataTypes.INTEGER,
        defaultValue: 1000
    },
    ticketsSold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'events',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

// Instance method to get available tickets
Event.prototype.getAvailableTickets = function() {
    return this.capacity - this.ticketsSold;
};

// Instance method to check if tickets are available
Event.prototype.hasAvailableTickets = function(quantity = 1) {
    return this.getAvailableTickets() >= quantity;
};

module.exports = Event;
