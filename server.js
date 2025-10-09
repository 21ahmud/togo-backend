const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const sequelize = require('./src/config/database');
const authRoutes = require('./src/routes/auth');
const usersRoutes = require('./src/routes/users');
const driversRoutes = require('./src/routes/drivers');
const ridesRoutes = require('./src/routes/rides');
const publicRoutes = require('./src/routes/public');
const deliveriesRoutes = require('./src/routes/deliveries');
const deliveryRoutes = require('./src/routes/delivery'); // ADD THIS LINE
const ordersRoutes = require('./src/routes/orders');
const favoritesRoutes = require('./src/routes/favorites');
const pharmaciesRoutes = require('./src/routes/pharmacies');
const restaurantsRoutes = require('./src/routes/restaurants');
const menuItemsRoutes = require('./src/routes/menuItems');
const prescriptionsRoutes = require('./src/routes/prescriptions');
const notificationsRoutes = require('./src/routes/notifications');

// Import models
const User = require('./src/models/User');
const Order = require('./src/models/Order');
const Pharmacy = require('./src/models/Pharmacy');
const Restaurant = require('./src/models/Restaurant');
const MenuItem = require('./src/models/MenuItem');
const Prescription = require('./src/models/Prescription');
const Ride = require('./src/models/Ride');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
}));

const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174', 
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(200);
  }
  next();
});

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({
  limit: '10mb',
  extended: true
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

app.use('/uploads', express.static(uploadsDir));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/delivery', deliveryRoutes); // ADD THIS LINE
app.use('/api/orders', ordersRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/pharmacies', pharmaciesRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/menu-items', menuItemsRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin/pharmacies', pharmaciesRoutes);
app.use('/api/admin/restaurants', restaurantsRoutes);

// Health check endpoints
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    const userCount = await User.count();
    const orderCount = await Order.count().catch(() => 0);
    const rideCount = await Ride.count().catch(() => 0);
    
    res.json({
      status: 'OK',
      message: 'الخادم يعمل بشكل طبيعي',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        dialect: sequelize.getDialect(),
        userCount,
        orderCount,
        rideCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'مشكلة في الاتصال بقاعدة البيانات',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/api/debug/db-status', async (req, res) => {
  try {
    const userCount = await User.count();
    let restaurantCount = 0;
    let pharmacyCount = 0;
    let menuItemCount = 0;
    let orderCount = 0;
    let prescriptionCount = 0;
    let rideCount = 0;
    
    try {
      restaurantCount = await Restaurant.count();
    } catch (e) {
      console.warn('Restaurant model not available');
    }
    
    try {
      pharmacyCount = await Pharmacy.count();
    } catch (e) {
      console.warn('Pharmacy model not available');
    }

    try {
      menuItemCount = await MenuItem.count();
    } catch (e) {
      console.warn('MenuItem model not available');
    }

    try {
      orderCount = await Order.count();
    } catch (e) {
      console.warn('Order model not available');
    }

    try {
      prescriptionCount = await Prescription.count();
    } catch (e) {
      console.warn('Prescription model not available');
    }

    try {
      rideCount = await Ride.count();
    } catch (e) {
      console.warn('Ride model not available');
    }

    const recentUsers = await User.findAll({ 
      limit: 5, 
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'role', 'createdAt']
    });
    
    let dbFileInfo = null;
    if (sequelize.getDialect() === 'sqlite' && sequelize.config.storage) {
      const dbPath = sequelize.config.storage;
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        dbFileInfo = {
          path: dbPath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      }
    }
    
    res.json({
      success: true,
      database: {
        connected: true,
        dialect: sequelize.getDialect(),
        userCount,
        restaurantCount,
        pharmacyCount,
        menuItemCount,
        orderCount,
        prescriptionCount,
        rideCount,
        recentUsers,
        file: dbFileInfo
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      database: {
        connected: false
      }
    });
  }
});

app.get('/debug/create-test-user', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }
  
  try {
    const existingUser = await User.findOne({ 
      where: { email: 'test@togo.com' } 
    });
    
    if (existingUser) {
      return res.json({
        success: true,
        message: 'Test user already exists',
        user: {
          email: existingUser.email,
          role: existingUser.role,
          id: existingUser.id
        }
      });
    }
    
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@togo.com',
      phone: '01234567890',
      password: 'password123',
      role: 'customer',
      isVerified: true,
      isActive: true
    });
    
    res.json({
      success: true,
      message: 'Test user created successfully',
      user: {
        email: testUser.email,
        role: testUser.role,
        id: testUser.id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create test user',
      error: error.message
    });
  }
});

// Create test delivery user endpoint
app.get('/debug/create-delivery-user', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }
  
  try {
    const existingUser = await User.findOne({ 
      where: { email: 'delivery@togo.com' } 
    });
    
    if (existingUser) {
      return res.json({
        success: true,
        message: 'Test delivery user already exists',
        user: {
          email: existingUser.email,
          role: existingUser.role,
          id: existingUser.id
        }
      });
    }
    
    const deliveryUser = await User.create({
      name: 'Test Delivery Driver',
      email: 'delivery@togo.com',
      phone: '01234567891',
      password: 'password123',
      role: 'delivery',
      isVerified: true,
      isActive: true,
      license: 'DL123456',
      vehicle: { type: 'motorcycle', model: 'Honda CG 125' },
      rating: 4.8,
      total_deliveries: 45,
      total_earnings: 1250.50,
      online: false,
      forceOffline: false
    });
    
    res.json({
      success: true,
      message: 'Test delivery user created successfully',
      user: {
        email: deliveryUser.email,
        role: deliveryUser.role,
        id: deliveryUser.id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create test delivery user',
      error: error.message
    });
  }
});

// Create test driver user endpoint
app.get('/debug/create-driver-user', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }
  
  try {
    const existingUser = await User.findOne({ 
      where: { email: 'driver@togo.com' } 
    });
    
    if (existingUser) {
      return res.json({
        success: true,
        message: 'Test driver user already exists',
        user: {
          email: existingUser.email,
          role: existingUser.role,
          id: existingUser.id
        }
      });
    }
    
    const driverUser = await User.create({
      name: 'Test Driver',
      email: 'driver@togo.com',
      phone: '01234567893',
      password: 'password123',
      role: 'driver',
      isVerified: true,
      isActive: true,
      license: 'DR123456',
      vehicle: 'سيارة عادية',
      rating: 4.7,
      totalRides: 28,
      totalEarnings: 850.25,
      online: false
    });
    
    res.json({
      success: true,
      message: 'Test driver user created successfully',
      user: {
        email: driverUser.email,
        role: driverUser.role,
        id: driverUser.id,
        vehicle: driverUser.vehicle
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create test driver user',
      error: error.message
    });
  }
});

// Create test pharmacy user endpoint
app.get('/debug/create-pharmacy-user', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }
  
  try {
    const existingUser = await User.findOne({ 
      where: { email: 'pharmacy@togo.com' } 
    });
    
    if (existingUser) {
      return res.json({
        success: true,
        message: 'Test pharmacy user already exists',
        user: {
          email: existingUser.email,
          role: existingUser.role,
          id: existingUser.id
        }
      });
    }
    
    const pharmacyUser = await User.create({
      name: 'صيدلية الشفاء',
      email: 'pharmacy@togo.com',
      phone: '01234567892',
      password: 'password123',
      role: 'pharmacy',
      isVerified: true,
      isActive: true,
      license_number: 'PH123456',
      status: 'active'
    });
    
    res.json({
      success: true,
      message: 'Test pharmacy user created successfully',
      user: {
        email: pharmacyUser.email,
        role: pharmacyUser.role,
        id: pharmacyUser.id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create test pharmacy user',
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'مرحباً بك في خادم Togo API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      'db-status': '/api/debug/db-status',
      auth: '/api/auth',
      users: '/api/users',
      drivers: '/api/drivers',
      rides: '/api/rides',
      deliveries: '/api/deliveries',
      delivery: '/api/delivery', // ADD THIS LINE
      orders: '/api/orders',
      favorites: '/api/favorites',
      pharmacies: '/api/pharmacies',
      restaurants: '/api/restaurants',
      'menu-items': '/api/menu-items',
      prescriptions: '/api/prescriptions',
      notifications: '/api/notifications',
      admin_pharmacies: '/api/admin/pharmacies',
      admin_restaurants: '/api/admin/restaurants'
    }
  });
});

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    const userCount = await User.count();
    const orderCount = await Order.count().catch(() => 0);
    const rideCount = await Ride.count().catch(() => 0);
    
    res.json({
      status: 'OK',
      message: 'الخادم يعمل بشكل طبيعي',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        dialect: sequelize.getDialect(),
        userCount,
        orderCount,
        rideCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'مشكلة في الاتصال بقاعدة البيانات',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'المسار غير موجود',
    requestedUrl: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('خطأ في الخادم:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'بيانات غير صحيحة',
      errors: err.errors?.map(e => e.message) || [err.message]
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'رمز التحقق غير صحيح'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'رمز التحقق منتهي الصلاحية'
    });
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'حدث خطأ في الخادم'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('🚀 Starting Togo API Server...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Port:', PORT);

    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    
    if (sequelize.getDialect() === 'sqlite') {
      console.log('Database file path:', sequelize.config.storage);
      
      if (sequelize.config.storage) {
        const dbDir = path.dirname(sequelize.config.storage);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
          console.log('Created database directory:', dbDir);
        }
      }
    }

    console.log('🔗 Setting up model associations...');
    try {
      // User - Pharmacy associations
      User.hasOne(Pharmacy, { 
        foreignKey: 'userId', 
        as: 'pharmacy',
        onDelete: 'CASCADE'
      });
      
      Pharmacy.belongsTo(User, { 
        foreignKey: 'userId', 
        as: 'user',
        onDelete: 'CASCADE'
      });

      // User - Restaurant associations
      User.hasOne(Restaurant, {
        foreignKey: 'user_id',
        as: 'restaurant',
        onDelete: 'CASCADE'
      });

      Restaurant.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE'
      });

      // User - MenuItem associations
      User.hasMany(MenuItem, {
        foreignKey: 'restaurant_id',
        as: 'menuItems',
        onDelete: 'CASCADE'
      });

      MenuItem.belongsTo(User, {
        foreignKey: 'restaurant_id',
        as: 'restaurant',
        onDelete: 'CASCADE'
      });

      // User - Order associations
      User.hasMany(Order, { 
        foreignKey: 'user_id', 
        as: 'orders',
        onDelete: 'CASCADE'
      });

      Order.belongsTo(User, { 
        foreignKey: 'user_id', 
        as: 'customer',
        onDelete: 'CASCADE'
      });

      User.hasMany(Order, { 
        foreignKey: 'assigned_to', 
        as: 'delivery_orders',
        onDelete: 'SET NULL'
      });

      Order.belongsTo(User, { 
        foreignKey: 'assigned_to', 
        as: 'delivery_driver',
        onDelete: 'SET NULL'
      });

      // User - Prescription associations
      User.hasMany(Prescription, { 
        foreignKey: 'pharmacyId', 
        as: 'prescriptions',
        onDelete: 'CASCADE'
      });

      Prescription.belongsTo(User, { 
        foreignKey: 'pharmacyId', 
        as: 'pharmacy',
        onDelete: 'CASCADE'
      });

      // RIDE ASSOCIATIONS
      User.hasMany(Ride, { 
        foreignKey: 'driver_id', 
        as: 'driver_rides',
        onDelete: 'SET NULL'
      });

      Ride.belongsTo(User, { 
        foreignKey: 'driver_id', 
        as: 'driver',
        onDelete: 'SET NULL'
      });
      
      console.log('✅ Model associations set up successfully');
    } catch (associationError) {
      console.warn('⚠️  Model association setup failed:', associationError.message);
    }

    console.log('🔄 Syncing database...');
    
    const syncOptions = {
      force: false,
      alter: false,
    };

    try {
      await sequelize.sync(syncOptions);
      console.log('✅ Database synchronized successfully');
      
      if (sequelize.getDialect() === 'sqlite' && sequelize.config.storage) {
        if (fs.existsSync(sequelize.config.storage)) {
          const stats = fs.statSync(sequelize.config.storage);
          console.log(`📁 Database file size: ${stats.size} bytes`);
          console.log(`📁 Database file path: ${sequelize.config.storage}`);
        } else {
          console.warn('⚠️  Database file does not exist after sync!');
        }
      }
      
    } catch (syncError) {
      console.error('❌ Database sync error:', syncError.message);
      throw syncError;
    }

    try {
      const userCount = await User.count();
      let pharmacyCount = 0;
      let restaurantCount = 0;
      let menuItemCount = 0;
      let orderCount = 0;
      let prescriptionCount = 0;
      let rideCount = 0;
      
      try {
        pharmacyCount = await Pharmacy.count();
      } catch (e) {
        console.warn('Pharmacy model not available');
      }
      
      try {
        restaurantCount = await Restaurant.count();
      } catch (e) {
        console.warn('Restaurant model not available');
      }

      try {
        menuItemCount = await MenuItem.count();
      } catch (e) {
        console.warn('MenuItem model not available');
      }

      try {
        orderCount = await Order.count();
      } catch (e) {
        console.warn('Order model not available');
      }

      try {
        prescriptionCount = await Prescription.count();
      } catch (e) {
        console.warn('Prescription model not available');
      }

      try {
        rideCount = await Ride.count();
      } catch (e) {
        console.warn('Ride model not available');
      }
      
      console.log(`📊 Current users in database: ${userCount}`);
      console.log(`📊 Current pharmacies in database: ${pharmacyCount}`);
      console.log(`📊 Current restaurants in database: ${restaurantCount}`);
      console.log(`📊 Current menu items in database: ${menuItemCount}`);
      console.log(`📊 Current orders in database: ${orderCount}`);
      console.log(`📊 Current prescriptions in database: ${prescriptionCount}`);
      console.log(`📊 Current rides in database: ${rideCount}`);
      
      if (userCount > 0) {
        const recentUsers = await User.findAll({ 
          limit: 3, 
          order: [['createdAt', 'DESC']],
          attributes: ['id', 'name', 'email', 'role', 'createdAt']
        });
        console.log('Recent users:', recentUsers.map(u => ({ 
          id: u.id, 
          email: u.email, 
          role: u.role 
        })));
      }
      
    } catch (modelError) {
      console.warn('⚠️  Model count failed:', modelError.message);
    }

    const server = app.listen(PORT, () => {
      console.log('🎉 Server started successfully!');
      console.log(`🌍 Server running on: http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 DB Status: http://localhost:${PORT}/api/debug/db-status`);
      console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth`);
      console.log(`👥 Users endpoint: http://localhost:${PORT}/api/users`);
      console.log(`📦 Orders endpoint: http://localhost:${PORT}/api/orders`);
      console.log(`🚗 Rides endpoint: http://localhost:${PORT}/api/rides`);
      console.log(`🚚 Deliveries endpoint: http://localhost:${PORT}/api/deliveries`);
      console.log(`📱 Delivery Status endpoint: http://localhost:${PORT}/api/delivery`); // ADD THIS LINE
      console.log(`🔔 Notifications endpoint: http://localhost:${PORT}/api/notifications`);
      console.log(`🍽️  Restaurants endpoint: http://localhost:${PORT}/api/restaurants`);
      console.log(`🍕 Menu Items endpoint: http://localhost:${PORT}/api/menu-items`);
      console.log(`💊 Prescriptions endpoint: http://localhost:${PORT}/api/prescriptions`);
      console.log(`🧪 Test driver user: http://localhost:${PORT}/debug/create-driver-user`);
      console.log(`🧪 Test pharmacy user: http://localhost:${PORT}/debug/create-pharmacy-user`);
      console.log(`🧪 Test delivery user: http://localhost:${PORT}/debug/create-delivery-user`);
      
      if (sequelize.getDialect() === 'sqlite' && sequelize.config.storage) {
        console.log(`🗄️  Database file: ${sequelize.config.storage}`);
      }
      
      console.log('📝 Ready to accept requests...');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please try a different port.`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server closed');
        
        try {
          await sequelize.close();
          console.log('🗄️  Database connection closed');
        } catch (error) {
          console.error('❌ Error closing database:', error);
        }
        
        console.log('👋 Graceful shutdown completed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    if (error.name === 'SequelizeConnectionError') {
      console.error('💡 Database connection failed. Please check:');
      console.error('   - Database server is running');
      console.error('   - Database credentials in .env file');
      console.error('   - Database exists and is accessible');
    }
    
    if (error.name === 'SequelizeDatabaseError') {
      console.error('💡 Database error. This might help:');
      console.error('   - Delete the database file and let it recreate');
      console.error('   - Check file permissions');
    }
    
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();