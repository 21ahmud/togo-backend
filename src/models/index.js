// models/index.js - Central Model Management with Safe Loading
const sequelize = require('../config/database');

// Helper function to safely import models
const safeImport = (modelName) => {
  try {
    const model = require(`./${modelName}`);
    if (!model || !model.prototype) {
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

// Setup Model Associations
const setupAssociations = () => {
  console.log('🔗 Setting up model associations...');

  try {
    // User - Order associations
    if (User && Order) {
      User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
      User.hasMany(Order, { foreignKey: 'driverId', as: 'driverOrders' });
      Order.belongsTo(User, { foreignKey: 'userId', as: 'customer' });
      Order.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });
      console.log('  ✓ User-Order associations');
    }

    // User - Ride associations
    if (User && Ride) {
      User.hasMany(Ride, { foreignKey: 'userId', as: 'rides' });
      User.hasMany(Ride, { foreignKey: 'driverId', as: 'driverRides' });
      Ride.belongsTo(User, { foreignKey: 'userId', as: 'customer' });
      Ride.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });
      console.log('  ✓ User-Ride associations');
    }

    // User - Restaurant associations
    if (User && Restaurant) {
      User.hasOne(Restaurant, { foreignKey: 'userId', as: 'restaurant' });
      Restaurant.belongsTo(User, { foreignKey: 'userId', as: 'restaurantOwner' });
      console.log('  ✓ User-Restaurant associations');
    }

    // Restaurant - MenuItem associations
    if (Restaurant && MenuItem) {
      Restaurant.hasMany(MenuItem, { foreignKey: 'restaurantId', as: 'menuItems' });
      MenuItem.belongsTo(Restaurant, { foreignKey: 'restaurantId', as: 'restaurant' });
      console.log('  ✓ Restaurant-MenuItem associations');
    }

    // Restaurant - Order associations
    if (Restaurant && Order) {
      Restaurant.hasMany(Order, { foreignKey: 'restaurantId', as: 'orders' });
      Order.belongsTo(Restaurant, { foreignKey: 'restaurantId', as: 'restaurant' });
      console.log('  ✓ Restaurant-Order associations');
    }

    // User - Pharmacy associations
    if (User && Pharmacy) {
      User.hasOne(Pharmacy, { foreignKey: 'userId', as: 'pharmacy' });
      Pharmacy.belongsTo(User, { foreignKey: 'userId', as: 'pharmacyOwner' });
      console.log('  ✓ User-Pharmacy associations');
    }

    // Pharmacy - Prescription associations
    if (Pharmacy && Prescription) {
      Pharmacy.hasMany(Prescription, { foreignKey: 'pharmacyId', as: 'prescriptions' });
      Prescription.belongsTo(Pharmacy, { foreignKey: 'pharmacyId', as: 'pharmacy' });
      console.log('  ✓ Pharmacy-Prescription associations');
    }

    // User - Prescription associations
    if (User && Prescription) {
      User.hasMany(Prescription, { foreignKey: 'userId', as: 'userPrescriptions' });
      Prescription.belongsTo(User, { foreignKey: 'userId', as: 'customer' });
      console.log('  ✓ User-Prescription associations');
    }

    // Pharmacy - Order associations
    if (Pharmacy && Order) {
      Pharmacy.hasMany(Order, { foreignKey: 'pharmacyId', as: 'pharmacyOrders' });
      Order.belongsTo(Pharmacy, { foreignKey: 'pharmacyId', as: 'pharmacy' });
      console.log('  ✓ Pharmacy-Order associations');
    }

    console.log('✅ Model associations set up successfully');
  } catch (error) {
    console.error('❌ Error setting up associations:', error.message);
    throw error;
  }
};

// Initialize database and models
const initializeDatabase = async () => {
  try {
    console.log('🔄 Syncing database...');
    
    // Setup associations before syncing
    setupAssociations();
    
    // Sync all models with database
    // Use alter: false in production to prevent destructive changes
    const syncOptions = {
      alter: process.env.NODE_ENV !== 'production',
      force: false
    };
    
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
    throw error;
  }
};

// Export models and utilities - NO DELIVERY MODEL
module.exports = {
  User: User || {},
  Restaurant: Restaurant || {},
  MenuItem: MenuItem || {},
  Pharmacy: Pharmacy || {},
  Prescription: Prescription || {},
  Order: Order || {},
  Ride: Ride || {},
  sequelize,
  setupAssociations,
  initializeDatabase
};