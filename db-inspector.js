// db-inspector.js
// This script helps you inspect your current database structure

const sequelize = require('./config/database'); // Adjust path based on your structure

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting database structure...\n');
    
    const queryInterface = sequelize.getQueryInterface();
    
    // Get all tables
    const tables = await queryInterface.showAllTables();
    console.log('📋 Available tables:', tables);
    console.log('');
    
    // Inspect restaurants table specifically
    if (tables.includes('restaurants')) {
      console.log('🍽️  RESTAURANTS TABLE STRUCTURE:');
      console.log('================================');
      
      const restaurantsStructure = await queryInterface.describeTable('restaurants');
      
      Object.entries(restaurantsStructure).forEach(([columnName, columnInfo]) => {
        console.log(`📝 ${columnName}:`);
        console.log(`   Type: ${columnInfo.type}`);
        console.log(`   Null: ${columnInfo.allowNull}`);
        console.log(`   Default: ${columnInfo.defaultValue}`);
        console.log(`   Primary: ${columnInfo.primaryKey || false}`);
        console.log(`   Unique: ${columnInfo.unique || false}`);
        console.log('');
      });
      
      // Count records
      const [results] = await sequelize.query('SELECT COUNT(*) as count FROM restaurants');
      console.log(`📊 Total restaurants: ${results[0].count}`);
      
      // Show sample data if any exists
      if (results[0].count > 0) {
        console.log('\n📋 Sample data (first 3 records):');
        const [sampleData] = await sequelize.query('SELECT * FROM restaurants LIMIT 3');
        console.table(sampleData);
      }
    } else {
      console.log('❌ restaurants table not found');
    }
    
    // Check users table too
    if (tables.includes('users')) {
      console.log('\n👥 USERS TABLE STRUCTURE:');
      console.log('========================');
      
      const usersStructure = await queryInterface.describeTable('users');
      console.log('Columns:', Object.keys(usersStructure));
      
      const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
      console.log(`📊 Total users: ${userCount[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Error inspecting database:', error);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  inspectDatabase()
    .then(() => {
      console.log('\n✅ Database inspection completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database inspection failed:', error);
      process.exit(1);
    });
}

module.exports = inspectDatabase;