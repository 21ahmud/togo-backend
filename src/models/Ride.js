// src/models/Ride.js - FINAL CORRECTED VERSION
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ride = sequelize.define('Ride', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  service_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'ride',
    validate: {
      isIn: [['ride', 'delivery']]
    }
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customer_phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  pickup_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  pickup_coordinates: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dropoff_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dropoff_coordinates: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ride_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'standard'
  },
  vehicle_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'cash',
    validate: {
      isIn: [['cash', 'card', 'wallet']]
    }
  },
  estimated_distance: {
    type: DataTypes.STRING,
    allowNull: true
  },
  estimated_duration: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fare: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'accepted', 'in_progress', 'completed', 'cancelled']]
    }
  },
  driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  driver_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  driver_phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  delivery_details: {
    type: sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON,  // ✅ FIXED!
    allowNull: true,
    defaultValue: null
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
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ride_started: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ride_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'rides',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (ride) => {
      const now = new Date();
      ride.created_at = now;
      ride.updated_at = now;
    },
    beforeUpdate: (ride) => {
      ride.updated_at = new Date();
    }
  },
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['driver_id']
    },
    {
      fields: ['customer_phone']
    },
    {
      fields: ['service_type']
    },
    {
      fields: ['created_at']
    }
  ]
});

Ride.prototype.acceptByDriver = async function(driver) {
  this.status = 'accepted';
  this.driver_id = driver.id;
  this.driver_name = driver.name;
  this.driver_phone = driver.phone;
  this.accepted_at = new Date();
  return await this.save();
};

Ride.prototype.startRide = async function() {
  this.status = 'in_progress';
  this.ride_started = true;
  this.started_at = new Date();
  return await this.save();
};

Ride.prototype.completeRide = async function() {
  this.status = 'completed';
  this.ride_completed = true;
  this.completed_at = new Date();
  return await this.save();
};

Ride.prototype.cancelRide = async function() {
  this.status = 'cancelled';
  this.cancelled_at = new Date();
  return await this.save();
};

module.exports = Ride;