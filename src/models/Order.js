// src/models/Order.js - Fixed Order Model with Proper ID Generation
const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
    // Add explicit validation to ensure ID is always set
    validate: {
      notNull: {
        msg: 'Order ID cannot be null'
      }
    }
  },
  
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    validate: {
      isInt: true,
      min: 1
    }
  },
  
  customer_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  
  customer_phone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [8, 20],
    }
  },
  
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [5, 1000]
    }
  },
  
  customer_location: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('customer_location');
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error('Error parsing customer_location JSON:', e);
        return null;
      }
    },
    set(value) {
      if (value === null || value === undefined) {
        this.setDataValue('customer_location', null);
      } else {
        this.setDataValue('customer_location', JSON.stringify(value));
      }
    }
  },
  
  items: {
  type: DataTypes.TEXT,
  allowNull: false,
  validate: {
    notEmpty: true
  },
  get() {
    const value = this.getDataValue('items');
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error parsing items JSON:', e);
      return [];
    }
  },
    set(value) {
      if (Array.isArray(value)) {
        this.setDataValue('items', JSON.stringify(value));
      } else {
        this.setDataValue('items', JSON.stringify([]));
      }
    }
  },
  
  restaurants: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    get() {
      const value = this.getDataValue('restaurants');
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parsing restaurants JSON:', e);
        return [];
      }
    },
    set(value) {
      if (Array.isArray(value)) {
        this.setDataValue('restaurants', JSON.stringify(value));
      } else {
        this.setDataValue('restaurants', JSON.stringify([]));
      }
    }
  },
  
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0
    },
    get() {
      const value = this.getDataValue('subtotal');
      return parseFloat(value) || 0;
    }
  },
  
  delivery_fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      isDecimal: true,
      min: 0
    },
    get() {
      const value = this.getDataValue('delivery_fee');
      return parseFloat(value) || 0;
    }
  },
  
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0
    },
    get() {
      const value = this.getDataValue('total');
      return parseFloat(value) || 0;
    }
  },
  
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending_assignment',
    validate: {
      isIn: [['pending_assignment', 'assigned', 'in_progress', 'delivered', 'cancelled']]
    }
  },
  
  payment_method: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'cash',
    validate: {
      isIn: [['cash', 'vodafone_cash', 'instapay', 'credit_card']]
    }
  },
  
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'restaurant',
    validate: {
      isIn: [['restaurant', 'prescription_order', 'pharmacy']]
    }
  },
  
  assigned_to: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  
  assigned_delivery_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  assigned_delivery_phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  accepted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  estimated_delivery_time: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    validate: {
      isInt: true,
      min: 5,
      max: 120
    }
  },
  
  priority: {
    type: DataTypes.STRING,
    defaultValue: 'normal',
    validate: {
      isIn: [['low', 'normal', 'high', 'urgent']]
    }
  },
  
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      isDecimal: true,
      min: 0
    },
    get() {
      const value = this.getDataValue('tax');
      return parseFloat(value) || 0;
    }
  },
  
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  restaurant_emails: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('restaurant_emails');
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parsing restaurant_emails JSON:', e);
        return [];
      }
    },
    set(value) {
      if (Array.isArray(value)) {
        this.setDataValue('restaurant_emails', JSON.stringify(value));
      } else {
        this.setDataValue('restaurant_emails', JSON.stringify([]));
      }
    }
  },
  
  locationAccuracy: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    get() {
      const value = this.getDataValue('locationAccuracy');
      return value ? parseFloat(value) : null;
    }
  },
  
  hasAccurateLocation: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  
  // Additional fields for better tracking
  cancelled_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  cancelled_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  
  delivery_instructions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  
  review: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['assigned_to']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['type']
    }
  ],
  hooks: {
    beforeCreate: (order, options) => {
      // Ensure status is valid for new orders
      if (!order.status || !['pending_assignment', 'assigned'].includes(order.status)) {
        order.status = 'pending_assignment';
      }
      
      console.log('Order before create hook - ID:', order.id);
    },
    
    afterCreate: (order, options) => {
      console.log('Order after create hook - ID:', order.id, 'Type:', typeof order.id);
      
      // Validate that the order was created with a valid ID
      if (!order.id || order.id === null || order.id === undefined) {
        console.error('CRITICAL: Order created without valid ID!', {
          orderId: order.id,
          orderData: order.toJSON()
        });
        throw new Error('Order creation failed: No valid ID assigned');
      }
    }
  }
});

// Export the model
module.exports = Order;