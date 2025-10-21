const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MenuItem = sequelize.define('MenuItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  original_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  has_discount: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Main',
    validate: {
      isIn: [['Main', 'Starter', 'Dessert', 'Drinks']]
    }
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  prep_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Preparation time in minutes'
  },
  is_popular: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  restaurant_email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  restaurant_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'menu_items',
  timestamps: true,  // ✅ Changed to true since Neon has createdAt/updatedAt
  underscored: false, // ✅ Changed to false since Neon uses camelCase (createdAt, updatedAt)
  createdAt: 'createdAt',  // ✅ Explicitly map to camelCase
  updatedAt: 'updatedAt',  // ✅ Explicitly map to camelCase
  indexes: [
    { fields: ['restaurant_email'] },
    { fields: ['restaurant_id'] },
    { fields: ['category'] },
    { fields: ['available'] },
    { fields: ['is_popular'] }
  ]
});

module.exports = MenuItem;