// simple-test-db.js - Simple database test
const sequelize = require('./src/middleware/config/database');
const User = require('./src/models/User');

async function testDB() {
  try {
    console.log('Testing database connection...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('Connection successful');
    
    // Sync database
    await sequelize.sync();
    console.log('Database synced');
    
    // Count users
    const userCount = await User.count();
    console.log(`Current users: ${userCount}`);
    
    // Check if test user already exists
    let foundUser = await User.findOne({ where: { email: 'test@example.com' } });
    if (foundUser) {
      console.log('Test user already exists:', foundUser.email);
      console.log('This means database persistence is working!');
    } else {
      // Try to create a test user
      const testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        password: 'test123',
        role: 'customer',
        isVerified: true,
        isActive: true
      });
      
      console.log('User created:', testUser.email);
      console.log('Now restart the server and run this test again to check persistence.');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.log('User already exists - this is good for persistence testing!');
    }
  } finally {
    await sequelize.close();
  }
}

testDB();