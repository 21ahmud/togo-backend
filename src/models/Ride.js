// src/models/Ride.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ride = sequelize.define('Ride', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Service type: 'ride' or 'delivery'
  service_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'ride',
    validate: {
      isIn: [['ride', 'delivery']]
    }
  },
  // Customer information (always required - no userId needed for public bookings)
  customer_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customer_phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Pickup location
  pickup_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  pickup_coordinates: {
    type: DataTypes.STRING, // Changed from JSON to STRING to store "lat, lng"
    allowNull: true
  },
  // Dropoff location
  dropoff_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dropoff_coordinates: {
    type: DataTypes.STRING, // Changed from JSON to STRING to store "lat, lng"
    allowNull: true
  },
  // Vehicle and ride type
  ride_type: {
    type: DataTypes.STRING, // 'scooter', 'standard', 'premium'
    allowNull: false,
    defaultValue: 'standard'
  },
  vehicle_type: {
    type: DataTypes.STRING, // 'scooter', 'car', 'luxury_car', etc.
    allowNull: true
  },
  // Payment
  payment_method: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'cash',
    validate: {
      isIn: [['cash', 'card', 'wallet']]
    }
  },
  // Estimates
  estimated_distance: {
    type: DataTypes.STRING, // "5.2 كم"
    allowNull: true
  },
  estimated_duration: {
    type: DataTypes.STRING, // "15 دقيقة"
    allowNull: true
  },
  fare: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  // Status tracking
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'accepted', 'in_progress', 'completed', 'cancelled']]
    }
  },
  // Driver assignment (nullable until driver accepts)
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
  // Delivery-specific details (for service_type='delivery')
  delivery_details: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
    // Expected structure:
    // {
    //   senderName: string,
    //   senderPhone: string,
    //   receiverName: string,
    //   receiverPhone: string,
    //   packageDescription: string,
    //   packageValue: string,
    //   specialInstructions: string
    // }
  },
  // Timestamps for different stages
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
  // Additional tracking flags
  ride_started: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ride_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Optional: Rating after completion
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  // Optional: Customer notes
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

// Instance methods
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