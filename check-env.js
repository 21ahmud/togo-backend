// check-env.js - Run this to debug your environment variables
const path = require('path');
const fs = require('fs');

console.log('\n=== Environment Variables Checker ===\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

console.log('1. .env File Location Check:');
console.log(`   Expected path: ${envPath}`);
console.log(`   File exists: ${envExists ? '✅ YES' : '❌ NO'}`);

if (envExists) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n').filter(line => 
    line.trim() && !line.startsWith('#')
  );
  console.log(`   Variables found: ${lines.length}`);
}

console.log('\n2. Current Directory:');
console.log(`   ${process.cwd()}`);

console.log('\n3. Loading .env file...');
require('dotenv').config();

console.log('\n4. Database Environment Variables:');
const dbVars = {
  'NODE_ENV': process.env.NODE_ENV,
  'DB_HOST': process.env.DB_HOST,
  'DB_PORT': process.env.DB_PORT,
  'DB_NAME': process.env.DB_NAME,
  'DB_USER': process.env.DB_USER,
  'DB_PASS': process.env.DB_PASS ? '***SET***' : '❌ NOT SET'
};

Object.entries(dbVars).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  console.log(`   ${status} ${key}: ${value || 'NOT SET'}`);
});

console.log('\n5. Expected Neon Configuration:');
console.log('   DB_HOST should be: ep-snowy-bonus-agres97p-pooler.c-2.eu-central-1.aws.neon.tech');
console.log('   DB_NAME should be: neondb');
console.log('   DB_USER should be: neondb_owner');

console.log('\n6. Recommendations:');
if (!envExists) {
  console.log('   ❌ .env file not found! Create it in the project root');
}
if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') {
  console.log('   ❌ DB_HOST not set or set to localhost');
  console.log('      Change it to your Neon host');
}
if (!process.env.DB_PASS) {
  console.log('   ❌ DB_PASS is not set!');
}
if (process.env.NODE_ENV !== 'production') {
  console.log('   ⚠️  NODE_ENV is not "production"');
  console.log('      Set it to "production" to use PostgreSQL');
}

console.log('\n=====================================\n');