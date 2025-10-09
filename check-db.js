// check-database.js
// Simple script to verify database structure

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuration - adjust these paths to match your setup
const DB_PATHS = [
  path.join(__dirname, 'data', 'togo_development.sqlite'),
  path.join(__dirname, 'database.sqlite'),
  path.join(__dirname, 'togo.sqlite'),
  path.join(__dirname, '..', 'data', 'togo_development.sqlite')
];

// Find the database file
let dbPath = null;
for (const testPath of DB_PATHS) {
  if (fs.existsSync(testPath)) {
    dbPath = testPath;
    break;
  }
}

if (!dbPath) {
  console.log('Database file not found. Please update DB_PATHS in the script.');
  console.log('Searched in:');
  DB_PATHS.forEach(path => console.log(`  - ${path}`));
  process.exit(1);
}

console.log('Found database at:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database (read-only)');
});

// Required columns for restaurants table
const requiredColumns = [
  'id', 'name', 'owner', 'email', 'phone', 'license_number', 
  'status', 'image_url', 'description', 'cuisine_type', 
  'delivery_fee', 'restaurant_location', 'rating', 'user_id',
  'created_at', 'updated_at'
];

// Check if restaurants table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='restaurants'", (err, row) => {
  if (err) {
    console.error('Error checking for restaurants table:', err);
    db.close();
    return;
  }
  
  if (!row) {
    console.log('RESTAURANTS TABLE DOES NOT EXIST');
    console.log('Please run the migration script first.');
    db.close();
    return;
  }
  
  console.log('Restaurants table exists');
  
  // Check table structure
  db.all("PRAGMA table_info(restaurants)", (err, rows) => {
    if (err) {
      console.error('Error getting table info:', err);
      db.close();
      return;
    }
    
    console.log('\nRESTAURANTS TABLE STRUCTURE:');
    console.log('============================');
    
    const existingColumns = [];
    rows.forEach(row => {
      existingColumns.push(row.name);
      console.log(`${row.name}:`);
      console.log(`   Type: ${row.type}`);
      console.log(`   Not Null: ${row.notnull ? 'Yes' : 'No'}`);
      console.log(`   Default: ${row.dflt_value || 'None'}`);
      console.log(`   Primary Key: ${row.pk ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Check for missing required columns
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    console.log('COLUMN CHECK RESULTS:');
    console.log('====================');
    
    if (missingColumns.length === 0) {
      console.log('ALL REQUIRED COLUMNS EXIST');
    } else {
      console.log(`MISSING COLUMNS (${missingColumns.length}):`);
      missingColumns.forEach(col => console.log(`  - ${col}`));
    }
    
    // Specifically check for cuisine_type (the main issue)
    const hasCuisineType = existingColumns.includes('cuisine_type');
    console.log(`\ncuisine_type column exists: ${hasCuisineType ? 'YES' : 'NO'}`);
    
    if (!hasCuisineType) {
      console.log('\nERROR: cuisine_type column is missing!');
      console.log('This is causing your API errors.');
      console.log('Please run the migration script to fix this.');
    }
    
    // Count records
    db.get("SELECT COUNT(*) as count FROM restaurants", (err, result) => {
      if (err) {
        console.error('Error counting records:', err);
      } else {
        console.log(`\nTotal restaurants: ${result.count}`);
        
        // Show sample data if any exists
        if (result.count > 0) {
          console.log('\nSample data (first 3 records):');
          db.all("SELECT * FROM restaurants LIMIT 3", (err, sampleData) => {
            if (err) {
              console.error('Error getting sample data:', err);
            } else {
              sampleData.forEach((row, index) => {
                console.log(`\nRecord ${index + 1}:`);
                Object.keys(row).forEach(key => {
                  console.log(`  ${key}: ${row[key]}`);
                });
              });
            }
            
            // Test the problematic query
            console.log('\nTesting the problematic query...');
            db.all("SELECT id, name, cuisine_type FROM restaurants LIMIT 1", (err, testResult) => {
              if (err) {
                console.log('QUERY FAILED:', err.message);
                console.log('This confirms the cuisine_type column issue.');
              } else {
                console.log('QUERY SUCCEEDED:', testResult);
                console.log('Database should work with your API now.');
              }
              
              db.close();
            });
          });
        } else {
          console.log('No data in restaurants table.');
          
          // Test the problematic query even with no data
          console.log('\nTesting the problematic query...');
          db.all("SELECT id, name, cuisine_type FROM restaurants LIMIT 1", (err, testResult) => {
            if (err) {
              console.log('QUERY FAILED:', err.message);
              console.log('This confirms the cuisine_type column issue.');
            } else {
              console.log('QUERY SUCCEEDED (empty result expected)');
              console.log('Database structure should work with your API now.');
            }
            
            db.close();
          });
        }
      }
    });
  });
});