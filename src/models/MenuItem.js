const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MenuItem = sequelize.define('MenuItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
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
    field: 'original_price',
    validate: {
      min: 0
    }
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'discount_percentage',
    validate: {
      min: 0,
      max: 100
    }
  },
  has_discount: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'has_discount'
  },
  category: {
    type: DataTypes.ENUM('Main', 'Starter', 'Dessert', 'Drinks'),
    allowNull: false,
    defaultValue: 'Main'
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'image_url'
  },
  prep_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'prep_time',
    comment: 'Preparation time in minutes'
  },
  is_popular: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_popular'
  },
  available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  restaurant_email: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'restaurant_email',
    validate: {
      isEmail: true
    }
  },
  restaurant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'restaurant_id',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'menu_items',
  timestamps: false,  // Disable automatic timestamp handling to avoid column name conflicts
  indexes: [
    {
      fields: ['restaurant_email']
    },
    {
      fields: ['restaurant_id']
    },
    {
      fields: ['category']
    },
    {
      fields: ['available']
    }
  ]
});

module.exports = MenuItem;