// src/models/User.js - PostgreSQL Production Version
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
      type: DataTypes.STRING, // Keep as STRING for PostgreSQL compatibility
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
    
    // Driver/Delivery fields
    license: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vehicle: {
      type: DataTypes.JSONB, // PostgreSQL native JSON
      allowNull: true
    },
    location: {
      type: DataTypes.JSONB, // PostgreSQL native JSON
      allowNull: true,
      defaultValue: { lat: 30.0444, lng: 31.2357 }
    },
    
    // Statistics (consolidated - removed duplicates)
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
  }, 
  {
    tableName: 'users',
    freezeTableName: true,
    timestamps: true,
    
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
  }
);

// CRITICAL: Define instance methods BEFORE exporting
User.prototype.comparePassword = async function(candidatePassword) {
  try {
    if (!this.password) {
      console.error('Password field not loaded. Use User.scope("withPassword").findOne()');
      return false;
    }
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

// Static method to find user with password for authentication
User.findByEmailWithPassword = async function(email) {
  return await User.scope('withPassword').findOne({
    where: { email: email.toLowerCase().trim() }
  });
};

// Static method to find user by phone with password
User.findByPhoneWithPassword = async function(phone) {
  return await User.scope('withPassword').findOne({
    where: { phone: phone.trim() }
  });
};

// Export the model AFTER all methods are defined
module.exports = User;