// src/config/database.js
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let sequelize;

// Production (PostgreSQL) configuration
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  console.log('🐘 Configuring PostgreSQL for production...');
  
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    }
  });
  
  console.log('✅ Connected to PostgreSQL (Production)');
} 
// Alternative production config using separate variables
else if (process.env.NODE_ENV === 'production') {
  console.log('🐘 Configuring PostgreSQL with separate credentials...');
  
  sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'togo_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    }
  });
  
  console.log('✅ Connected to PostgreSQL (Production)');
}
// Development (SQLite) configuration
else {
  const projectRoot = path.resolve(__dirname, '../..');
  const dataDir = path.join(projectRoot, 'data');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory:', dataDir);
  }
  
  const dbPath = path.join(dataDir, 'togo_development.sqlite');
  console.log('🗄️  Local SQLite DB path:', dbPath);
  
  // Check if database file exists
  try {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`📊 Database file size: ${stats.size} bytes`);
    } else {
      console.log('📝 Database file will be created');
    }
  } catch (error) {
    console.error('⚠️  Error checking database path:', error);
  }
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false, // Change to console.log for debugging
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
  
  console.log('✅ Connected to SQLite (Development)');
}

// Test connection function
sequelize.testConnection = async function() {
  try {
    await this.authenticate();
    console.log('✅ Database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    return false;
  }
};

module.exports = sequelize;