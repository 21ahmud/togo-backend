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
    type: DataTypes.JSON,
    allowNull: true
  },
  dropoff_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dropoff_coordinates: {
    type: DataTypes.JSON,
    allowNull: true
  },
  ride_type: {
    type: DataTypes.STRING,
    allowNull: true
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
    }
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
    type: DataTypes.JSON,
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