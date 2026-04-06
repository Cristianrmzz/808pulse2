const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AdminUser = sequelize.define('AdminUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'superadmin'),
    allowNull: false,
    defaultValue: 'admin',
  }
}, {
  tableName: 'admin_users',
  timestamps: true,
});

module.exports = AdminUser;
