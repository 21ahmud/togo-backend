// migrate-restaurants.js
// Comprehensive script to fix missing columns in restaurants table

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
  console.log('❌ Database file not found. Please update DB_PATHS in the script.');
  console.log('Searched in:');
  DB_PATHS.forEach(path => console.log(`  - ${path}`));
  process.exit(1);
}

console.log('🔍 Found database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Expected columns based on your Sequelize models
const expectedColumns = [
  { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
  { name: 'name', type: 'TEXT NOT NULL' },
  { name: 'owner', type: 'TEXT NOT NULL' },
  { name: 'email', type: 'TEXT NOT NULL UNIQUE' },
  { name: 'phone', type: 'TEXT' },
  { name: 'license_number', type: 'TEXT UNIQUE' },
  { name: 'status', type: 'TEXT DEFAULT "pending"' },
  { name: 'image_url', type: 'TEXT' },
  { name: 'description', type: 'TEXT' },
  { name: 'cuisine_type', type: 'TEXT' },
  { name: 'delivery_fee', type: 'DECIMAL(10,2) DEFAULT 0' },
  { name: 'restaurant_location', type: 'TEXT' },
  { name: 'rating', type: 'DECIMAL(3,2) DEFAULT 5.0' },
  { name: 'user_id', type: 'INTEGER' },
  { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
];

async function checkAndAddColumns() {
  return new Promise((resolve, reject) => {
    // First, check if restaurants table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='restaurants'", async (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        console.log('❌ restaurants table does not exist. Creating table...');
        await createRestaurantsTable();
        resolve();
        return;
      }

      console.log('✅ restaurants table exists');
      
      // Get current table structure
      db.all("PRAGMA table_info(restaurants)", async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('📋 Current restaurants table columns:');
        const existingColumns = rows.map(row => {
          console.log(`  - ${row.name} (${row.type})`);
          return row.name;
        });
        
        // Find missing columns
        const missingColumns = expectedColumns.filter(expected => 
          !existingColumns.includes(expected.name) && expected.name !== 'id'
        );
        
        if (missingColumns.length === 0) {
          console.log('✅ All required columns exist');
          resolve();
          return;
        }
        
        console.log(`\n🔧 Found ${missingColumns.length} missing columns:`);
        missingColumns.forEach(col => console.log(`  - ${col.name}`));
        
        // Add missing columns one by one
        let addedCount = 0;
        for (const column of missingColumns) {
          try {
            await addColumn(column);
            addedCount++;
          } catch (error) {
            console.error(`❌ Failed to add column ${column.name}:`, error.message);
          }
        }
        
        console.log(`\n✅ Added ${addedCount}/${missingColumns.length} missing columns`);
        
        // Update existing records with default values
        await updateExistingRecords(missingColumns);
        
        resolve();
      });
    });
  });
}

function createRestaurantsTable() {
  return new Promise((resolve, reject) => {
    const createTableSQL = `
      CREATE TABLE restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        license_number TEXT UNIQUE,
        status TEXT DEFAULT 'pending',
        image_url TEXT,
        description TEXT,
        cuisine_type TEXT,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        restaurant_location TEXT,
        rating DECIMAL(3,2) DEFAULT 5.0,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.run(createTableSQL, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('✅ Created restaurants table successfully');
        resolve();
      }
    });
  });
}

function addColumn(column) {
  return new Promise((resolve, reject) => {
    const sql = `ALTER TABLE restaurants ADD COLUMN ${column.name} ${column.type}`;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`✅ Added column: ${column.name}`);
        resolve();
      }
    });
  });
}

async function updateExistingRecords(addedColumns) {
  return new Promise((resolve, reject) => {
    // First, check if there are any existing records
    db.get("SELECT COUNT(*) as count FROM restaurants", async (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (result.count === 0) {
        console.log('ℹ️  No existing records to update');
        resolve();
        return;
      }
      
      console.log(`🔄 Updating ${result.count} existing records with default values...`);
      
      const updates = [];
      for (const column of addedColumns) {
        switch (column.name) {
          case 'license_number':
            updates.push("UPDATE restaurants SET license_number = 'LICENSE-' || id || '-TEMP' WHERE license_number IS NULL");
            break;
          case 'cuisine_type':
            updates.push("UPDATE restaurants SET cuisine_type = 'مصري' WHERE cuisine_type IS NULL");
            break;
          case 'delivery_fee':
            updates.push("UPDATE restaurants SET delivery_fee = 0 WHERE delivery_fee IS NULL");
            break;
          case 'rating':
            updates.push("UPDATE restaurants SET rating = 5.0 WHERE rating IS NULL");
            break;
          case 'status':
            updates.push("UPDATE restaurants SET status = 'pending' WHERE status IS NULL");
            break;
          case 'restaurant_location':
            updates.push("UPDATE restaurants SET restaurant_location = '{\"lat\": 31.1342, \"lng\": 29.9055, \"address\": \"Alexandria, Egypt\"}' WHERE restaurant_location IS NULL");
            break;
        }
      }
      
      // Execute all updates
      let updateCount = 0;
      for (const updateSQL of updates) {
        try {
          await new Promise((resolveUpdate, rejectUpdate) => {
            db.run(updateSQL, (err) => {
              if (err) {
                console.log(`⚠️  Warning: ${err.message}`);
                resolveUpdate(); // Continue even if update fails
              } else {
                updateCount++;
                resolveUpdate();
              }
            });
          });
        } catch (error) {
          console.log(`⚠️  Warning: Failed to update records - ${error.message}`);
        }
      }
      
      if (updateCount > 0) {
        console.log(`✅ Updated existing records with default values`);
      }
      resolve();
    });
  });
}

// Main execution
async function main() {
  try {
    await checkAndAddColumns();
    
    // Final verification
    console.log('\n🔍 Final verification...');
    db.all("PRAGMA table_info(restaurants)", (err, rows) => {
      if (err) {
        console.error('❌ Error during verification:', err);
      } else {
        console.log('\n📋 Final restaurants table structure:');
        rows.forEach(row => {
          console.log(`  ✓ ${row.name} (${row.type})`);
        });
        
        // Test query to ensure everything works
        db.get("SELECT COUNT(*) as count FROM restaurants", (err, result) => {
          if (err) {
            console.error('❌ Test query failed:', err.message);
          } else {
            console.log(`\n📊 Total restaurants in database: ${result.count}`);
            console.log('\n🎉 Database migration completed successfully!');
            console.log('You can now restart your application.');
          }
          
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err.message);
            } else {
              console.log('✅ Database connection closed');
            }
            process.exit(0);
          });
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

// Run the migration
main();