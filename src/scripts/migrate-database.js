// scripts/migrate-database.js
const { QueryInterface, DataTypes } = require('sequelize');
const sequelize = require('../src/config/database');

async function migrateDatabase() {
  console.log('🔄 Starting database migration...');
  
  try {
    // Get the query interface
    const queryInterface = sequelize.getQueryInterface();
    
    // Check if users table exists
    const tables = await queryInterface.showAllTables();
    console.log('Existing tables:', tables);
    
    if (tables.includes('users')) {
      console.log('📋 Users table exists, checking columns...');
      
      // Get table description
      const tableInfo = await queryInterface.describeTable('users');
      console.log('Current table structure:', Object.keys(tableInfo));
      
      // Add missing columns one by one with proper handling
      const columnsToAdd = [
        {
          name: 'createdAt',
          definition: {
            type: DataTypes.DATE,
            allowNull: true, // Allow null initially
            defaultValue: DataTypes.NOW
          }
        },
        {
          name: 'updatedAt',
          definition: {
            type: DataTypes.DATE,
            allowNull: true, // Allow null initially
            defaultValue: DataTypes.NOW
          }
        },
        {
          name: 'isVerified',
          definition: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          }
        },
        {
          name: 'isActive',
          definition: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
          }
        },
        {
          name: 'lastLogin',
          definition: {
            type: DataTypes.DATE,
            allowNull: true
          }
        }
      ];
      
      for (const column of columnsToAdd) {
        if (!tableInfo[column.name]) {
          console.log(`➕ Adding column: ${column.name}`);
          try {
            await queryInterface.addColumn('users', column.name, column.definition);
            console.log(`✅ Added column: ${column.name}`);
          } catch (error) {
            console.log(`⚠️  Column ${column.name} might already exist or error:`, error.message);
          }
        }
      }
      
      // Update existing rows with default values for timestamp columns
      if (!tableInfo.createdAt) {
        console.log('🔄 Updating existing rows with default timestamps...');
        await sequelize.query(`
          UPDATE users 
          SET createdAt = datetime('now'), updatedAt = datetime('now')
          WHERE createdAt IS NULL OR updatedAt IS NULL
        `);
      }
      
      console.log('✅ Migration completed successfully');
      
    } else {
      console.log('📋 Users table does not exist, it will be created by Sequelize sync');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

module.exports = migrateDatabase;