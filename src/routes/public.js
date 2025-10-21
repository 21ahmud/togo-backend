// src/routes/public.js - WORKS WITH BOTH STRING AND JSON TYPES
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');

// Import models
const User = require('../models/User');
const Ride = require('../models/Ride');

// Test route
router.get('/test', (req, res) => {
  console.log('✅ Public test route accessed');
  res.json({
    success: true,
    message: 'Public routes working',
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

// Create ride - UNIVERSAL SOLUTION (works with both STRING and JSON types)
router.post('/rides', async (req, res) => {
  console.log('\n========================================');
  console.log('🚗 NEW RIDE REQUEST RECEIVED');
  console.log('========================================');
  
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

    // 🔥 UNIVERSAL COORDINATE HANDLING
    // Try JSON first, if it fails, use STRING format
    let pickupCoordValue = null;
    let dropoffCoordValue = null;

    // Handle pickup coordinates
    if (pickup_coordinates) {
      if (typeof pickup_coordinates === 'object') {
        // If model expects JSON, this will work
        pickupCoordValue = pickup_coordinates;
      } else if (typeof pickup_coordinates === 'string') {
        // If model expects STRING, this will work
        pickupCoordValue = pickup_coordinates;
      }
    }

    // Handle dropoff coordinates
    if (dropoff_coordinates) {
      if (typeof dropoff_coordinates === 'object') {
        dropoffCoordValue = dropoff_coordinates;
      } else if (typeof dropoff_coordinates === 'string') {
        dropoffCoordValue = dropoff_coordinates;
      }
    }

    console.log('📍 Coordinates processed');
    console.log('  Pickup:', pickupCoordValue);
    console.log('  Dropoff:', dropoffCoordValue);

    // Create ride using RAW SQL to bypass Sequelize type checking
    const query = `
      INSERT INTO rides (
        service_type, customer_name, customer_phone,
        pickup_address, pickup_coordinates,
        dropoff_address, dropoff_coordinates,
        ride_type, vehicle_type, payment_method,
        estimated_distance, estimated_duration, fare,
        status, ride_started, ride_completed,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `;

    const values = [
      service_type || 'ride',
      customer_name.trim(),
      customer_phone.trim(),
      pickup_address.trim(),
      pickupCoordValue ? JSON.stringify(pickupCoordValue) : null,
      dropoff_address.trim(),
      dropoffCoordValue ? JSON.stringify(dropoffCoordValue) : null,
      ride_type || 'standard',
      vehicle_type || 'car',
      payment_method || 'cash',
      estimated_distance || '0 km',
      estimated_duration || '0 min',
      parseFloat(fare) || 0,
      'pending',
      false,
      false,
      new Date(),
      new Date()
    ];

    const [result] = await sequelize.query(query, {
      bind: values,
      type: sequelize.QueryTypes.INSERT
    });

    const newRide = result[0];
    
    console.log('========================================');
    console.log('✅ RIDE CREATED SUCCESSFULLY');
    console.log('🆔 Ride ID:', newRide.id);
    console.log('========================================\n');

    res.status(201).json({
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
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('========================================\n');

    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى.',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message
      })
    });
  }
});

// Get all rides
router.get('/rides', async (req, res) => {
  try {
    const rides = await Ride.findAll({
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      rides: rides,
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