// models/index.js - Central Model Management with Corrected Associations
const sequelize = require('../config/database');

// Helper function to safely import models
const safeImport = (modelName) => {
  try {
    const model = require(`./${modelName}`);
    if (!model) {
      console.warn(`⚠️  ${modelName} model not properly exported`);
      return null;
    }
    console.log(`✅ ${modelName} model loaded successfully`);
    return model;
  } catch (error) {
    console.warn(`⚠️  Could not load ${modelName} model:`, error.message);
    return null;
  }
};

// Import all models safely
const User = safeImport('User');
const Restaurant = safeImport('Restaurant');
const MenuItem = safeImport('MenuItem');
const Pharmacy = safeImport('Pharmacy');
const Prescription = safeImport('Prescription');
const Order = safeImport('Order');
const Ride = safeImport('Ride');

// Store models in an object
const models = {
  User,
  Restaurant,
  MenuItem,
  Pharmacy,
  Prescription,
  Order,
  Ride,
  sequelize
};

// Setup Model Associations - CORRECTED based on actual foreign keys
const setupAssociations = () => {
  console.log('🔗 Setting up model associations...');

  try {
    // ====================================
    // USER ASSOCIATIONS
    // ====================================
    
    // User - Order associations (as customer)
    if (User && Order) {
      User.hasMany(Order, { 
        foreignKey: 'user_id', 
        as: 'orders',
        onDelete: 'CASCADE'
      });
      Order.belongsTo(User, { 
        foreignKey: 'user_id', 
        as: 'customer' 
      });
      
      // User - Order associations (as assigned driver)
      User.hasMany(Order, { 
        foreignKey: 'assigned_to', 
        as: 'assignedOrders',
        onDelete: 'SET NULL'
      });
      Order.belongsTo(User, { 
        foreignKey: 'assigned_to', 
        as: 'assignedDriver' 
      });
      
      // User - Order associations (cancelled by)
      User.hasMany(Order, { 
        foreignKey: 'cancelled_by', 
        as: 'cancelledOrders',
        onDelete: 'SET NULL'
      });
      Order.belongsTo(User, { 
        foreignKey: 'cancelled_by', 
        as: 'cancelledByUser' 
      });
      
      console.log('  ✓ User-Order associations');
    }

    // User - Ride associations
    if (User && Ride) {
      User.hasMany(Ride, { 
        foreignKey: 'driver_id', 
        as: 'driverRides',
        onDelete: 'SET NULL'
      });
      Ride.belongsTo(User, { 
        foreignKey: 'driver_id', 
        as: 'driver' 
      });
      console.log('  ✓ User-Ride associations');
    }

    // User - Restaurant associations
    if (User && Restaurant) {
      User.hasOne(Restaurant, { 
        foreignKey: 'user_id', 
        as: 'restaurant',
        onDelete: 'CASCADE'
      });
      Restaurant.belongsTo(User, { 
        foreignKey: 'user_id', 
        as: 'owner' 
      });
      console.log('  ✓ User-Restaurant associations');
    }

    // User - Pharmacy associations
    if (User && Pharmacy) {
      User.hasOne(Pharmacy, { 
        foreignKey: 'userId', 
        as: 'pharmacy',
        onDelete: 'CASCADE'
      });
      Pharmacy.belongsTo(User, { 
        foreignKey: 'userId', 
        as: 'owner' 
      });
      console.log('  ✓ User-Pharmacy associations');
    }

    // ====================================
    // RESTAURANT ASSOCIATIONS
    // ====================================
    
    // Restaurant - MenuItem associations
    if (Restaurant && MenuItem) {
      Restaurant.hasMany(MenuItem, { 
        foreignKey: 'restaurant_id', 
        as: 'menuItems',
        onDelete: 'CASCADE'
      });
      MenuItem.belongsTo(Restaurant, { 
        foreignKey: 'restaurant_id', 
        as: 'restaurant' 
      });
      console.log('  ✓ Restaurant-MenuItem associations');
    }

    // ====================================
    // PHARMACY ASSOCIATIONS
    // ====================================
    
    // Pharmacy - Prescription associations
    if (Pharmacy && Prescription) {
      Pharmacy.hasMany(Prescription, { 
        foreignKey: 'pharmacyId', 
        as: 'prescriptions',
        onDelete: 'CASCADE'
      });
      Prescription.belongsTo(Pharmacy, { 
        foreignKey: 'pharmacyId', 
        as: 'pharmacy' 
      });
      console.log('  ✓ Pharmacy-Prescription associations');
    }

    console.log('✅ Model associations set up successfully');
  } catch (error) {
    console.error('❌ Error setting up associations:', error.message);
    console.error(error.stack);
    throw error;
  }
};

// Initialize database and models
const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database...');
    
    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Setup associations before syncing
    setupAssociations();
    
    // Sync all models with database
    // Use alter: false in production to prevent destructive changes
    const syncOptions = {
      alter: process.env.NODE_ENV === 'development',
      force: false
    };
    
    if (syncOptions.alter) {
      console.log('⚠️  Running in development mode with alter: true');
    }
    
    await sequelize.sync(syncOptions);
    
    console.log('✅ Database synchronized successfully');
    
    // Log model counts
    const counts = {};
    
    if (User) counts.users = await User.count().catch(() => 0);
    if (Restaurant) counts.restaurants = await Restaurant.count().catch(() => 0);
    if (Pharmacy) counts.pharmacies = await Pharmacy.count().catch(() => 0);
    if (Order) counts.orders = await Order.count().catch(() => 0);
    if (Ride) counts.rides = await Ride.count().catch(() => 0);
    if (Prescription) counts.prescriptions = await Prescription.count().catch(() => 0);
    if (MenuItem) counts.menuItems = await MenuItem.count().catch(() => 0);
    
    console.log('📊 Database Status:');
    Object.entries(counts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    console.error(error.stack);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};

// Export models and utilities
module.exports = {
  // Models
  User: User || {},
  Restaurant: Restaurant || {},
  MenuItem: MenuItem || {},
  Pharmacy: Pharmacy || {},
  Prescription: Prescription || {},
  Order: Order || {},
  Ride: Ride || {},
  
  // Sequelize instance
  sequelize,
  
  // Utility functions
  setupAssociations,
  initializeDatabase,
  testConnection,
  closeConnection,
  
  // Export Sequelize library for operators
  Sequelize: require('sequelize')
};