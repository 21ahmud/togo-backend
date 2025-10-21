// src/models/Ride.js - CORRECTED FOR UUID
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ride = sequelize.define('Ride', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  service_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'ride'
  },
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  customer_phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  pickup_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  pickup_coordinates: {
    type: DataTypes.TEXT, // Stores as "lat, lng"
    allowNull: true
  },
  dropoff_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dropoff_coordinates: {
    type: DataTypes.TEXT, // Stores as "lat, lng"
    allowNull: true
  },
  ride_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  vehicle_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'cash'
  },
  estimated_distance: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  estimated_duration: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  fare: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'pending'
  },
  // CRITICAL: Changed to UUID to match users table
  driver_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  driver_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  driver_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  delivery_details: {
    type: DataTypes.JSONB,
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
  ride_started: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ride_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'rides',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Ride;