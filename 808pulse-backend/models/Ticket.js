const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { Order } = require('./Order');
const Event = require('./Event');
const crypto = require('crypto');

const Ticket = sequelize.define('Ticket', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticketId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'orders',
            key: 'id'
        }
    },
    eventId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    eventName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    customerName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    customerPhone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    qrToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    qrData: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'used', 'cancelled'),
        defaultValue: 'active'
    },
    usedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'tickets',
    timestamps: true,
    hooks: {
        // Asignar valores requeridos ANTES de validar para evitar notNull violations
        beforeValidate: (ticket) => {
            if (!ticket.ticketId) {
                ticket.ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            }
            if (!ticket.qrToken) {
                ticket.qrToken = crypto.randomBytes(32).toString('hex');
            }
            // Sin expiración por tiempo: el ticket solo se invalida al ser usado o cancelado
        }
    }
});

// Método para verificar si el ticket es válido
Ticket.prototype.isValid = function() {
    return this.status === 'active';
};

// Método para marcar ticket como usado
Ticket.prototype.markAsUsed = async function() {
    this.status = 'used';
    this.usedAt = new Date();
    await this.save();
};

// Definir asociaciones
Ticket.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Ticket.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

module.exports = Ticket;
