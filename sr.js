const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const sequelize = require('./src/middleware/config/database');
const authRoutes = require('./src/routes/auth');
const driversRoutes = require('./src/routes/drivers');
const deliveriesRoutes = require('./src/routes/deliveries');
const ordersRoutes = require('./src/routes/orders');
const favoritesRoutes = require('./src/routes/favorites');
const pharmaciesRoutes = require('./src/routes/pharmacies');
const restaurantsRoutes = require('./src/routes/restaurants');
const adminRestaurantsRoutes = require('./src/routes/admin/restaurants');

const User = require('./src/models/User');
const Pharmacy = require('./src/models/Pharmacy');
const Restaurant = require('./src/models/Restaurant');

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

const uploadsDir = path.join(__dirname, 'uploads');
if (!require('fs').existsSync(uploadsDir)) {
  require('fs').mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/pharmacies', pharmaciesRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/admin/pharmacies', pharmaciesRoutes);
app.use('/api/admin/restaurants', adminRestaurantsRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'مرحباً بك في خادم Togo API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      drivers: '/api/drivers',
      deliveries: '/api/deliveries',
      orders: '/api/orders',
      favorites: '/api/favorites',
      pharmacies: '/api/pharmacies',
      restaurants: '/api/restaurants',
      admin_pharmacies: '/api/admin/pharmacies',
      admin_restaurants: '/api/admin/restaurants'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'الخادم يعمل بشكل طبيعي',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected'
  });
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

    console.log('🔗 Setting up model associations...');
    try {
      User.hasOne(Pharmacy, { 
        foreignKey: 'userId', 
        as: 'pharmacy',
        onDelete: 'SET NULL' 
      });
      
      Pharmacy.belongsTo(User, { 
        foreignKey: 'userId', 
        as: 'user',
        onDelete: 'SET NULL' 
      });

      User.hasOne(Restaurant, {
        foreignKey: 'user_id',
        as: 'restaurant',
        onDelete: 'SET NULL'
      });

      Restaurant.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'SET NULL'
      });
      
      console.log('✅ Model associations set up successfully');
    } catch (associationError) {
      console.warn('⚠️  Model association setup failed:', associationError.message);
    }

    console.log('🔄 Syncing database...');
    
    // For SQLite, disable foreign key constraints during sync if needed
    if (sequelize.getDialect() === 'sqlite') {
      console.log('🔧 Temporarily disabling foreign key constraints for SQLite...');
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    }

    const syncOptions = {
      force: false,
      alter: process.env.NODE_ENV === 'development'
    };

    try {
      await sequelize.sync(syncOptions);
      console.log('✅ Database synchronized successfully');
    } catch (syncError) {
      console.error('❌ Database sync error:', syncError.message);
      
      // If sync fails due to foreign key constraints, try dropping and recreating
      if (syncError.name === 'SequelizeForeignKeyConstraintError') {
        console.log('🔄 Attempting to recreate database schema...');
        
        // Drop all tables in correct order (children first)
        try {
          await Restaurant.drop({ cascade: true });
          await Pharmacy.drop({ cascade: true });
          await User.drop({ cascade: true });
          
          // Recreate with force
          await sequelize.sync({ force: true });
          console.log('✅ Database recreated successfully');
        } catch (recreateError) {
          console.error('❌ Failed to recreate database:', recreateError.message);
          throw recreateError;
        }
      } else {
        throw syncError;
      }
    }

    // Re-enable foreign key constraints for SQLite
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
      console.log('🔧 Re-enabled foreign key constraints for SQLite');
    }

    try {
      const userCount = await User.count();
      const pharmacyCount = await Pharmacy.count();
      const restaurantCount = await Restaurant.count();
      console.log(`📊 Current users in database: ${userCount}`);
      console.log(`📊 Current pharmacies in database: ${pharmacyCount}`);
      console.log(`📊 Current restaurants in database: ${restaurantCount}`);
    } catch (modelError) {
      console.warn('⚠️  Model test failed:', modelError.message);
    }

    const server = app.listen(PORT, () => {
      console.log('🎉 Server started successfully!');
      console.log(`🌍 Server running on: http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth`);
      console.log(`👤 Drivers endpoint: http://localhost:${PORT}/api/drivers`);
      console.log(`🚚 Deliveries endpoint: http://localhost:${PORT}/api/deliveries`);
      console.log(`📦 Orders endpoint: http://localhost:${PORT}/api/orders`);
      console.log(`⭐ Favorites endpoint: http://localhost:${PORT}/api/favorites`);
      console.log(`💊 Pharmacies endpoint: http://localhost:${PORT}/api/pharmacies`);
      console.log(`🍽️ Restaurants endpoint: http://localhost:${PORT}/api/restaurants`);
      console.log(`🔧 Admin Pharmacies endpoint: http://localhost:${PORT}/api/admin/pharmacies`);
      console.log(`🔧 Admin Restaurants endpoint: http://localhost:${PORT}/api/admin/restaurants`);
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
      console.error('   - Or run: rm -f database.sqlite (if using SQLite)');
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error('💡 Foreign key constraint error. Try:');
      console.error('   - Delete the database.sqlite file');
      console.error('   - Or set FORCE_RECREATE_DB=true in your .env');
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