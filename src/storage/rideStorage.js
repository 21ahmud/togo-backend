const fs = require('fs');
const path = require('path');

// File path for persistent storage
const RIDES_FILE_PATH = path.join(__dirname, '../data/rides.json');

let rides = [];
let rideIdCounter = 1;

// Load rides from file on startup
const loadRidesFromFile = () => {
  try {
    if (fs.existsSync(RIDES_FILE_PATH)) {
      const data = fs.readFileSync(RIDES_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      rides = parsed.rides || [];
      rideIdCounter = parsed.nextId || 1;
      console.log(`Loaded ${rides.length} rides from file`);
    } else {
      console.log('No rides file found, starting with empty data');
    }
  } catch (error) {
    console.error('Error loading rides from file:', error);
    rides = [];
    rideIdCounter = 1;
  }
};

// Save rides to file
const saveRidesToFile = () => {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(RIDES_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const data = {
      rides: rides,
      nextId: rideIdCounter,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(RIDES_FILE_PATH, JSON.stringify(data, null, 2));
    console.log(`Saved ${rides.length} rides to file`);
  } catch (error) {
    console.error('Error saving rides to file:', error);
  }
};

// Load rides on module initialization
loadRidesFromFile();

const rideStorage = {
  // Get all rides
  getRides: () => rides,
  
  // Add a new ride
  addRide: (rideData) => {
    const newRide = {
      ...rideData,
      id: rideIdCounter++,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    rides.push(newRide);
    saveRidesToFile(); // Persist to file
    console.log('Ride added to storage:', { id: newRide.id, service_type: newRide.service_type, customer: newRide.customer_name });
    return newRide;
  },
  
  // Update an existing ride
  updateRide: (id, updates) => {
    const index = rides.findIndex(r => r.id === id);
    if (index !== -1) {
      rides[index] = { 
        ...rides[index], 
        ...updates, 
        updated_at: new Date().toISOString() 
      };
      saveRidesToFile(); // Persist to file
      console.log('Ride updated in storage:', { id: rides[index].id, status: rides[index].status });
      return rides[index];
    }
    return null;
  },
  
  // Get ride by ID
  getRideById: (id) => rides.find(r => r.id === id),
  
  // Delete a ride
  deleteRide: (id) => {
    const index = rides.findIndex(r => r.id === id);
    if (index !== -1) {
      const deletedRide = rides.splice(index, 1)[0];
      saveRidesToFile(); // Persist to file
      console.log('Ride deleted from storage:', { id: deletedRide.id });
      return deletedRide;
    }
    return null;
  },
  
  // Get rides count
  getCount: () => rides.length,
  
  // Clear all rides (for testing)
  clearAll: () => {
    rides = [];
    rideIdCounter = 1;
    saveRidesToFile(); // Persist to file
    console.log('All rides cleared from storage');
  },

  // Manual save (for backup purposes)
  save: () => {
    saveRidesToFile();
  },

  // Reload from file
  reload: () => {
    loadRidesFromFile();
  }
};

module.exports = rideStorage;