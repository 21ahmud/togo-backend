
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

let sequelize;

if (isProduction) {
  
  sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'togo_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    logging: false,
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
} else {
  
  const projectRoot = path.resolve(__dirname, '../..');
  const dataDir = path.join(projectRoot, 'data');
  
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const dbPath = path.join(dataDir, 'togo_development.sqlite');
  
  console.log('Database will be stored at:', dbPath);
  
  
  try {
    if (fs.existsSync(dbPath)) {
      console.log('Database file already exists');
    } else {
      console.log('Database file will be created');
    }
  } catch (error) {
    console.error('Error checking database path:', error);
  }
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: console.log, 
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    }
  });
}



module.exports = sequelize;