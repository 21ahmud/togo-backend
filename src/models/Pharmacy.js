// src/models/Pharmacy.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pharmacy = sequelize.define('Pharmacy', {
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
  owner: {
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
    validate: {
      notEmpty: true,
      len: [10, 20]
    }
  },
  license_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [5, 50]
    }
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['active', 'pending', 'suspended']]
    }
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  pharmacy_location: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('pharmacy_location');
      return value ? JSON.parse(value) : null;
    },
    set(value) {
      this.setDataValue('pharmacy_location', value ? JSON.stringify(value) : null);
    }
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
  total_orders: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  online: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  }
}, {
  tableName: 'pharmacies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  
  hooks: {
    beforeCreate: async (pharmacy) => {
      if (pharmacy.email) pharmacy.email = pharmacy.email.toLowerCase().trim();
      if (pharmacy.name) pharmacy.name = pharmacy.name.trim();
      if (pharmacy.owner) pharmacy.owner = pharmacy.owner.trim();
      if (pharmacy.phone) pharmacy.phone = pharmacy.phone.trim();
      if (pharmacy.license_number) pharmacy.license_number = pharmacy.license_number.trim();
    },
    
    beforeUpdate: async (pharmacy) => {
      if (pharmacy.changed('email')) pharmacy.email = pharmacy.email.toLowerCase().trim();
      if (pharmacy.changed('name')) pharmacy.name = pharmacy.name.trim();
      if (pharmacy.changed('owner')) pharmacy.owner = pharmacy.owner.trim();
      if (pharmacy.changed('phone')) pharmacy.phone = pharmacy.phone.trim();
      if (pharmacy.changed('license_number')) pharmacy.license_number = pharmacy.license_number.trim();
    }
  }
});

// Define associations
Pharmacy.associate = (models) => {
  Pharmacy.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  });
};

module.exports = Pharmacy;