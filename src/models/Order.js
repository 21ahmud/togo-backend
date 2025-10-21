// models/Order.js - Fixed Order Model WITHOUT setters
const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
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
    // ✅ Only getter, no setter
    get() {
      const value = this.getDataValue('customer_location');
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error('Error parsing customer_location JSON:', e);
        return null;
      }
    }
  },
  
  // ✅ CRITICAL: Remove setters for items, restaurants, restaurant_emails
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
    }
    // ✅ NO SETTER - we stringify manually in the route
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
    }
    // ✅ NO SETTER - we stringify manually in the route
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
    }
    // ✅ NO SETTER - we stringify manually in the route
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
      if (!order.status || !['pending_assignment', 'assigned'].includes(order.status)) {
        order.status = 'pending_assignment';
      }
      console.log('[ORDER MODEL] Before create - data types:', {
        items: typeof order.getDataValue('items'),
        restaurants: typeof order.getDataValue('restaurants'),
        restaurant_emails: typeof order.getDataValue('restaurant_emails')
      });
    },
    
    afterCreate: (order, options) => {
      console.log('[ORDER MODEL] After create - Order ID:', order.id);
      if (!order.id || order.id === null || order.id === undefined) {
        console.error('[ORDER MODEL] CRITICAL: Order created without valid ID!');
        throw new Error('Order creation failed: No valid ID assigned');
      }
    }
  }
});

module.exports = Order;