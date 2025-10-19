// src/models/User.js - SQLite Compatible Version with Order Integration
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
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
      len: [2, 100]
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [10, 20]
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [6, 255]
    }
  },
  role: {
    type: DataTypes.STRING, // Changed from ENUM to STRING for SQLite compatibility
    allowNull: false,
    defaultValue: 'customer',
    validate: {
      isIn: [['customer', 'restaurant', 'pharmacy', 'driver', 'delivery', 'admin']]
    }
  },
  
  // Status fields
  isVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  online: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  forceOffline: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  
  // Business specific fields
  restaurantName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pharmacyName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cuisineType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Driver/Delivery fields for order integration
  license: {
    type: DataTypes.STRING,
    allowNull: true
  },
  vehicle: {
    type: DataTypes.TEXT, // SQLite doesn't have JSON type, use TEXT
    allowNull: true,
    get() {
      const value = this.getDataValue('vehicle');
      return value ? JSON.parse(value) : null;
    },
    set(value) {
      this.setDataValue('vehicle', value ? JSON.stringify(value) : null);
    }
  },
  location: {
    type: DataTypes.TEXT, // SQLite doesn't have JSON type, use TEXT
    allowNull: true,
    defaultValue: JSON.stringify({ lat: 30.0444, lng: 31.2357 }),
    get() {
      const value = this.getDataValue('location');
      return value ? JSON.parse(value) : { lat: 30.0444, lng: 31.2357 };
    },
    set(value) {
      this.setDataValue('location', JSON.stringify(value));
    }
  },
  
  // Statistics for delivery integration
  totalRides: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  totalDeliveries: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  totalOrders: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  totalEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    defaultValue: 5.0,
    validate: {
      min: 0,
      max: 5
    }
  },
  
  // Order integration fields
  total_deliveries: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  total_earnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  force_offline: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  
  // Common fields
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  freezeTableName: true,
  timestamps: true, // This will create createdAt and updatedAt automatically
  
  // Model hooks
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
      
      // Clean up string fields
      if (user.email) user.email = user.email.toLowerCase().trim();
      if (user.name) user.name = user.name.trim();
      if (user.phone) user.phone = user.phone.trim();
    },
    
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  },
  
  // Default scope excludes password
  defaultScope: {
    attributes: { exclude: ['password'] }
  },
  
  // Scopes
  scopes: {
    withPassword: {
      attributes: { include: ['password'] }
    }
  }
});

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// Override toJSON to exclude sensitive data
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;