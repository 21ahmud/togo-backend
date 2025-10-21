// src/routes/public.js - COMPLETE FIX with Enhanced Logging
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');

// Import models directly - avoid association issues
const User = require('../models/User');
const Ride = require('../models/Ride');

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Public routes working',
    timestamp: new Date().toISOString()
  });
});

// Get available drivers (public - no auth)
router.get('/drivers', async (req, res) => {
  try {
    console.log('Public request for available drivers');
    
    const drivers = await User.findAll({
      where: {
        role: 'driver',
        online: true,
        forceOffline: false,
        isActive: true
      },
      attributes: ['id', 'name', 'phone', 'vehicle', 'rating', 'location']
    });

    console.log(`Found ${drivers.length} available drivers`);

    res.json({
      success: true,
      drivers: drivers,
      count: drivers.length
    });

  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب السائقين',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create ride (public - no auth) - FIXED VERSION
router.post('/rides', async (req, res) => {
  try {
    console.log('=== PUBLIC RIDE REQUEST START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

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
      console.error('Missing required fields:', {
        customer_name: !!customer_name,
        customer_phone: !!customer_phone,
        pickup_address: !!pickup_address,
        dropoff_address: !!dropoff_address
      });
      
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة'
      });
    }

    // Prepare ride data - EXPLICIT FIELDS ONLY
    const rideData = {
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
    };

    console.log('Prepared ride data:', JSON.stringify(rideData, null, 2));

    // Method 1: Try using Sequelize create with explicit fields
    try {
      console.log('Attempting Sequelize create...');
      
      const newRide = await Ride.create(rideData, {
        fields: [
          'service_type', 'customer_name', 'customer_phone',
          'pickup_address', 'pickup_coordinates',
          'dropoff_address', 'dropoff_coordinates',
          'ride_type', 'vehicle_type', 'payment_method',
          'estimated_distance', 'estimated_duration', 'fare',
          'status', 'driver_id', 'driver_name', 'driver_phone',
          'delivery_details', 'ride_started', 'ride_completed'
        ],
        returning: true
      });

      console.log('✅ Ride created successfully with Sequelize:', newRide.id);

      return res.json({
        success: true,
        message: 'تم إنشاء الطلب بنجاح',
        ride: {
          id: newRide.id,
          service_type: newRide.service_type,
          customer_name: newRide.customer_name,
          pickup_address: newRide.pickup_address,
          dropoff_address: newRide.dropoff_address,
          fare: newRide.fare,
          status: newRide.status
        }
      });

    } catch (sequelizeError) {
      console.error('❌ Sequelize create failed:', sequelizeError.message);
      console.error('SQL Error:', sequelizeError.sql);
      
      // Method 2: Fallback to raw SQL
      console.log('Attempting raw SQL insert...');
      
      const query = `
        INSERT INTO rides (
          service_type, customer_name, customer_phone,
          pickup_address, pickup_coordinates,
          dropoff_address, dropoff_coordinates,
          ride_type, vehicle_type, payment_method,
          estimated_distance, estimated_duration, fare,
          status, driver_id, driver_name, driver_phone,
          delivery_details, ride_started, ride_completed,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          NOW(), NOW()
        )
        RETURNING id, service_type, customer_name, customer_phone, 
                  pickup_address, dropoff_address, fare, status;
      `;

      const values = [
        rideData.service_type,
        rideData.customer_name,
        rideData.customer_phone,
        rideData.pickup_address,
        rideData.pickup_coordinates,
        rideData.dropoff_address,
        rideData.dropoff_coordinates,
        rideData.ride_type,
        rideData.vehicle_type,
        rideData.payment_method,
        rideData.estimated_distance,
        rideData.estimated_duration,
        rideData.fare,
        rideData.status,
        rideData.driver_id,
        rideData.driver_name,
        rideData.driver_phone,
        rideData.delivery_details ? JSON.stringify(rideData.delivery_details) : null,
        rideData.ride_started,
        rideData.ride_completed
      ];

      console.log('Raw SQL values:', values);

      const [results] = await sequelize.query(query, {
        bind: values,
        type: sequelize.QueryTypes.INSERT
      });

      const newRide = results[0];
      console.log('✅ Ride created successfully with raw SQL:', newRide.id);

      return res.json({
        success: true,
        message: 'تم إنشاء الطلب بنجاح',
        ride: newRide
      });
    }

  } catch (error) {
    console.error('=== PUBLIC RIDE REQUEST ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.parent) {
      console.error('Parent error:', error.parent);
    }
    
    if (error.sql) {
      console.error('SQL:', error.sql);
    }

    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى.',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message,
        sql: error.sql
      })
    });
  }
});

// Get all rides (public - for testing)
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
    console.error('Get rides error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات'
    });
  }
});

module.exports = router;