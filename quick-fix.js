// quick-fix.js
// Simple script to add the missing license_number column

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Adjust this path to match your database file location
const dbPath = path.join(__dirname, 'data', 'togo_development.sqlite');

console.log('🔍 Looking for database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// Check current table structure
db.all("PRAGMA table_info(restaurants)", (err, rows) => {
  if (err) {
    console.error('❌ Error checking table structure:', err);
    return;
  }
  
  console.log('📋 Current restaurants table columns:');
  rows.forEach(row => {
    console.log(`  - ${row.name} (${row.type})`);
  });
  
  // Check if license_number column exists
  const hasLicenseNumber = rows.some(row => row.name === 'license_number');
  
  if (hasLicenseNumber) {
    console.log('✅ license_number column already exists');
    db.close();
    return;
  }
  
  console.log('➕ Adding license_number column...');
  
  // Add the missing column
  db.run("ALTER TABLE restaurants ADD COLUMN license_number TEXT", (err) => {
    if (err) {
      console.error('❌ Error adding column:', err.message);
    } else {
      console.log('✅ license_number column added successfully');
      
      // Optional: Add some default values to existing records
      db.run("UPDATE restaurants SET license_number = 'LICENSE-' || id || '-TEMP' WHERE license_number IS NULL", (err) => {
        if (err) {
          console.error('❌ Error updating existing records:', err.message);
        } else {
          console.log('✅ Updated existing records with placeholder license numbers');
        }
        
        db.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err.message);
          } else {
            console.log('🎉 Database fix completed successfully!');
          }
        });
      });
    }
  });
});