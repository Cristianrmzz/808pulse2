const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orderId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
        defaultValue: 'pending'
    },
    customerName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    customerPhone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    customerEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    paymentMethod: {
        type: DataTypes.ENUM('whatsapp', 'transfer', 'cash'),
        defaultValue: 'whatsapp'
    }
}, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

const OrderItem = sequelize.define('OrderItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Order,
            key: 'id'
        }
    },
    eventId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    eventName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1
        }
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    attendees: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'order_items',
    timestamps: true
});

// Define associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

module.exports = { Order, OrderItem };
