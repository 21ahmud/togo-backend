// src/models/Prescription.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pharmacyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'pharmacy_id'
  },
  pharmacyName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'pharmacy_name'
  },
  pharmacyEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'pharmacy_email'
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'customer_name'
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'customer_phone'
  },
  customerAddress: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'customer_address'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imageBase64: {
    type: DataTypes.TEXT('long'), // For large base64 images
    allowNull: true,
    field: 'image_base64'
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'completed'),
    defaultValue: 'pending'
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'prescription'
  },
  userLocation: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_location',
    get() {
      const value = this.getDataValue('userLocation');
      return value ? JSON.parse(value) : null;
    },
    set(value) {
      this.setDataValue('userLocation', value ? JSON.stringify(value) : null);
    }
  },
  distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  estimatedDeliveryFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'estimated_delivery_fee'
  },
  deliveryFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'delivery_fee'
  },
  pharmacyLocation: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'pharmacy_location',
    get() {
      const value = this.getDataValue('pharmacyLocation');
      return value ? JSON.parse(value) : null;
    },
    set(value) {
      this.setDataValue('pharmacyLocation', value ? JSON.stringify(value) : null);
    }
  },
  productPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'product_price'
  },
  proposedPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'proposed_price'
  },
  estimatedDeliveryTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'estimated_delivery_time'
  },
  pharmacyNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'pharmacy_notes'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'prescriptions',
  timestamps: true,
  underscored: false,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

module.exports = Prescription;