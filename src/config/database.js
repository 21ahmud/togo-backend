const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
let sequelize;

if (isProduction) {
  // ✅ Use Neon PostgreSQL connection in production
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });

  console.log('✅ Connected to Neon PostgreSQL (Production)');
} else {
  // 🧱 Local SQLite for development
  const projectRoot = path.resolve(__dirname, '../..');
  const dataDir = path.join(projectRoot, 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'togo_development.sqlite');
  console.log('🗄️  Local SQLite DB path:', dbPath);

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: console.log,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },
  });

  console.log('✅ Connected to SQLite (Development)');
}

module.exports = sequelize;
