// src/routes/public.js - FIXED VERSION WITH BETTER LOGGING
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

// Create ride - FIXED VERSION
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

    console.log('📋 Received ride data:', {
      service_type,
      customer_name,
      customer_phone,
      ride_type,
      vehicle_type,
      payment_method,
      fare
    });

    // Validate required fields
    if (!customer_name || !customer_phone || !pickup_address || !dropoff_address) {
      console.error('❌ Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة'
      });
    }

    console.log('✅ Validation passed');

    // Handle coordinates
    let pickupCoordValue = null;
    let dropoffCoordValue = null;

    if (pickup_coordinates) {
      if (typeof pickup_coordinates === 'object') {
        pickupCoordValue = JSON.stringify(pickup_coordinates);
      } else if (typeof pickup_coordinates === 'string') {
        pickupCoordValue = pickup_coordinates;
      }
    }

    if (dropoff_coordinates) {
      if (typeof dropoff_coordinates === 'object') {
        dropoffCoordValue = JSON.stringify(dropoff_coordinates);
      } else if (typeof dropoff_coordinates === 'string') {
        dropoffCoordValue = dropoff_coordinates;
      }
    }

    console.log('📍 Coordinates processed');
    console.log('  Pickup:', pickupCoordValue);
    console.log('  Dropoff:', dropoffCoordValue);

    // IMPORTANT: Make sure ride_type and vehicle_type are stored correctly
    const finalRideType = ride_type || 'standard';
    const finalVehicleType = vehicle_type || 'car';

    console.log('🚙 Vehicle info:', {
      ride_type: finalRideType,
      vehicle_type: finalVehicleType
    });

    // Create ride using RAW SQL
    const query = `
      INSERT INTO rides (
        service_type, customer_name, customer_phone,
        pickup_address, pickup_coordinates,
        dropoff_address, dropoff_coordinates,
        ride_type, vehicle_type, payment_method,
        estimated_distance, estimated_duration, fare,
        status, ride_started, ride_completed,
        delivery_details,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `;

    const deliveryDetailsJson = delivery_details ? JSON.stringify(delivery_details) : null;

    const values = [
      service_type || 'ride',
      customer_name.trim(),
      customer_phone.trim(),
      pickup_address.trim(),
      pickupCoordValue,
      dropoff_address.trim(),
      dropoffCoordValue,
      finalRideType,
      finalVehicleType,
      payment_method || 'cash',
      estimated_distance || '0 km',
      estimated_duration || '0 min',
      parseFloat(fare) || 0,
      'pending',
      false,
      false,
      deliveryDetailsJson,
      new Date(),
      new Date()
    ];

    console.log('💾 Inserting ride with values:', values);

    const [result] = await sequelize.query(query, {
      bind: values,
      type: sequelize.QueryTypes.INSERT
    });

    const newRide = result[0];
    
    console.log('========================================');
    console.log('✅ RIDE CREATED SUCCESSFULLY');
    console.log('🆔 Ride ID:', newRide.id);
    console.log('🚙 Ride Type:', newRide.ride_type);
    console.log('🚗 Vehicle Type:', newRide.vehicle_type);
    console.log('📊 Status:', newRide.status);
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