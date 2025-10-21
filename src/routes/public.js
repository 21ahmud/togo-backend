// src/routes/public.js - PostgreSQL Compatible (Final)
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');

// Import models safely
let User, Ride;
try {
  User = require('../models/User');
  Ride = require('../models/Ride');
  console.log(`🗄️  Public routes loaded - DB: ${sequelize.getDialect()}`);
} catch (error) {
  console.error('Error loading models in public routes:', error.message);
}

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Public routes working',
    database: sequelize.getDialect(),
    timestamp: new Date().toISOString()
  });
});

// Get available drivers
router.get('/drivers', async (req, res) => {
  try {
    if (!User) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable'
      });
    }

    const drivers = await User.findAll({
      where: {
        role: 'driver',
        online: true,
        forceOffline: false,
        isActive: true
      },
      attributes: ['id', 'name', 'phone', 'vehicle', 'rating', 'location']
    });

    res.json({
      success: true,
      drivers: drivers || [],
      count: drivers.length
    });

  } catch (error) {
    console.error('❌ Get drivers error:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب السائقين'
    });
  }
});

// Create ride - SEQUELIZE ORM ONLY
router.post('/rides', async (req, res) => {
  console.log('\n' + '='.repeat(50));
  console.log('🚗 NEW RIDE REQUEST');
  console.log('='.repeat(50));
  console.log('📅 Time:', new Date().toISOString());
  console.log('🗄️  Database:', sequelize.getDialect());
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  
  try {
    if (!Ride) {
      console.error('❌ Ride model not available');
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable'
      });
    }

    const {
      service_type,
      customer_name,
      customer_phone,
      pickup_address,
      pickup_coordinates,
      dropoff_address,
      dropoff_coordinates,
      ride_type,
      vehicle_type,
      payment_method,
      estimated_distance,
      estimated_duration,
      fare,
      delivery_details
    } = req.body;

    // Validate
    if (!customer_name || !customer_phone || !pickup_address || !dropoff_address) {
      console.error('❌ Validation failed');
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة'
      });
    }

    console.log('✅ Validation passed');
    console.log('📝 Creating with Sequelize ORM...');

    // USE SEQUELIZE CREATE - NOT RAW SQL!
    const newRide = await Ride.create({
      service_type: service_type || 'ride',
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      pickup_address: pickup_address.trim(),
      pickup_coordinates: pickup_coordinates || null,
      dropoff_address: dropoff_address.trim(),
      dropoff_coordinates: dropoff_coordinates || null,
      ride_type: ride_type || 'standard',
      vehicle_type: vehicle_type || 'car',
      payment_method: payment_method || 'cash',
      estimated_distance: estimated_distance || null,
      estimated_duration: estimated_duration || null,
      fare: parseFloat(fare) || 0,
      status: 'pending',
      driver_id: null,
      driver_name: null,
      driver_phone: null,
      delivery_details: delivery_details || null,
      ride_started: false,
      ride_completed: false
    });

    console.log('='.repeat(50));
    console.log('✅ RIDE CREATED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log('🆔 ID:', newRide.id);
    console.log('👤 Customer:', newRide.customer_name);
    console.log('🚗 Type:', newRide.ride_type);
    console.log('💰 Fare:', newRide.fare, 'EGP');
    console.log('='.repeat(50) + '\n');

    res.json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      ride: {
        id: newRide.id,
        service_type: newRide.service_type,
        customer_name: newRide.customer_name,
        customer_phone: newRide.customer_phone,
        pickup_address: newRide.pickup_address,
        dropoff_address: newRide.dropoff_address,
        ride_type: newRide.ride_type,
        vehicle_type: newRide.vehicle_type,
        fare: newRide.fare,
        status: newRide.status,
        created_at: newRide.created_at || newRide.createdAt
      }
    });

  } catch (error) {
    console.log('='.repeat(50));
    console.error('❌ RIDE CREATION FAILED');
    console.log('='.repeat(50));
    console.error('Type:', error.name);
    console.error('Message:', error.message);
    
    if (error.original) {
      console.error('Original Error:', error.original);
      console.error('Original SQL:', error.sql);
    }
    
    if (error.errors) {
      console.error('Validation errors:');
      error.errors.forEach(e => console.error(`  - ${e.path}: ${e.message}`));
    }
    
    console.error('Full Error Object:', JSON.stringify(error, null, 2));
    console.error('Stack:', error.stack);
    console.log('='.repeat(50) + '\n');

    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى.',
      ...(process.env.NODE_ENV !== 'production' && {
        error: error.message,
        type: error.name,
        details: error.original?.message
      })
    });
  }
});

// Get all rides
router.get('/rides', async (req, res) => {
  try {
    if (!Ride) {
      return res.status(503).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    const rides = await Ride.findAll({
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      rides: rides || [],
      count: rides.length
    });

  } catch (error) {
    console.error('❌ Get rides error:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات'
    });
  }
});

// Get ride by ID
router.get('/rides/:id', async (req, res) => {
  try {
    if (!Ride) {
      return res.status(503).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    const ride = await Ride.findByPk(parseInt(req.params.id));

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    res.json({
      success: true,
      ride
    });

  } catch (error) {
    console.error('❌ Get ride error:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب تفاصيل الطلب'
    });
  }
});

module.exports = router;