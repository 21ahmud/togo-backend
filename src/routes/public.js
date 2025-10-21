// src/routes/public.js - UNIVERSAL VERSION (SQLite + PostgreSQL)
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');

// Import models
const User = require('../models/User');
const Ride = require('../models/Ride');

// Detect database dialect
const isPostgres = sequelize.getDialect() === 'postgres';
const isSQLite = sequelize.getDialect() === 'sqlite';

console.log(`🗄️  Database dialect: ${sequelize.getDialect()}`);

// Test route
router.get('/test', (req, res) => {
  console.log('✅ Public test route accessed');
  res.json({
    success: true,
    message: 'Public routes working',
    database: sequelize.getDialect(),
    timestamp: new Date().toISOString()
  });
});

// Get available drivers (public - no auth)
router.get('/drivers', async (req, res) => {
  try {
    console.log('📍 Public request for available drivers');
    
    const drivers = await User.findAll({
      where: {
        role: 'driver',
        online: true,
        forceOffline: false,
        isActive: true
      },
      attributes: ['id', 'name', 'phone', 'vehicle', 'rating', 'location']
    });

    console.log(`✅ Found ${drivers.length} available drivers`);

    res.json({
      success: true,
      drivers: drivers,
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

// Create ride using Sequelize ORM (works with both databases)
router.post('/rides', async (req, res) => {
  console.log('\n========================================');
  console.log('🚗 NEW RIDE REQUEST RECEIVED');
  console.log('========================================');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🗄️  Database:', sequelize.getDialect());
  console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
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

    // Validate required fields
    if (!customer_name || !customer_phone || !pickup_address || !dropoff_address) {
      console.error('❌ Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة'
      });
    }

    console.log('✅ Validation passed');
    console.log('📝 Creating ride using Sequelize ORM...');

    // Use Sequelize ORM - works with both SQLite and PostgreSQL
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
      estimated_distance: estimated_distance || '0 km',
      estimated_duration: estimated_duration || '0 min',
      fare: parseFloat(fare) || 0,
      status: 'pending',
      driver_id: null,
      driver_name: null,
      driver_phone: null,
      delivery_details: delivery_details || null,
      ride_started: false,
      ride_completed: false
    });

    console.log('========================================');
    console.log('✅ RIDE CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('🆔 Ride ID:', newRide.id);
    console.log('👤 Customer:', newRide.customer_name);
    console.log('📞 Phone:', newRide.customer_phone);
    console.log('🚀 Service Type:', newRide.service_type);
    console.log('🚗 Ride Type:', newRide.ride_type);
    console.log('🚙 Vehicle Type:', newRide.vehicle_type);
    console.log('💰 Fare:', newRide.fare);
    console.log('📍 Status:', newRide.status);
    console.log('========================================\n');

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
        created_at: newRide.created_at
      }
    });

  } catch (error) {
    console.log('========================================');
    console.error('❌ RIDE CREATION FAILED');
    console.log('========================================');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    
    if (error.original) {
      console.error('Original Error:', error.original.message || error.original);
      console.error('SQL State:', error.original.code);
    }
    
    if (error.sql) {
      console.error('Failed SQL:', error.sql);
    }
    
    if (error.errors && error.errors.length > 0) {
      console.error('Validation Errors:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path}: ${err.message}`);
      });
    }
    
    console.error('Stack Trace:', error.stack);
    console.log('========================================\n');

    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى.',
      ...(process.env.NODE_ENV !== 'production' && {
        error: error.message,
        errorType: error.name,
        details: error.errors?.map(e => ({ field: e.path, message: e.message }))
      })
    });
  }
});

// Get all rides (public - for testing)
router.get('/rides', async (req, res) => {
  try {
    console.log('📋 Fetching all rides...');
    
    const rides = await Ride.findAll({
      attributes: [
        'id', 'service_type', 'customer_name', 'customer_phone',
        'pickup_address', 'dropoff_address', 'ride_type', 'vehicle_type',
        'fare', 'status', 'created_at', 'updated_at'
      ],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    console.log(`✅ Retrieved ${rides.length} rides`);

    res.json({
      success: true,
      rides: rides,
      count: rides.length
    });

  } catch (error) {
    console.error('❌ Get rides error:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات',
      error: error.message
    });
  }
});

// Get ride by ID (public - for tracking)
router.get('/rides/:id', async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    
    const ride = await Ride.findByPk(rideId);

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
      message: 'فشل في جلب تفاصيل الطلب',
      error: error.message
    });
  }
});

module.exports = router;