// src/routes/public.js - FINAL WORKING VERSION
const express = require('express');
const router = express.Router();
const { QueryTypes } = require('sequelize');
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

// Create ride using RAW SQL (bypasses Sequelize associations)
router.post('/rides', async (req, res) => {
  console.log('\n========================================');
  console.log('🚗 NEW RIDE REQUEST RECEIVED');
  console.log('========================================');
  console.log('📅 Timestamp:', new Date().toISOString());
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
    console.log('📝 Preparing SQL insert...');

    // Use RAW SQL to completely bypass Sequelize ORM
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
                pickup_address, dropoff_address, fare, status, created_at;
    `;

    const values = [
      service_type || 'ride',                    // $1
      customer_name.trim(),                       // $2
      customer_phone.trim(),                      // $3
      pickup_address.trim(),                      // $4
      pickup_coordinates || null,                 // $5
      dropoff_address.trim(),                     // $6
      dropoff_coordinates || null,                // $7
      ride_type || 'standard',                    // $8
      vehicle_type || 'car',                      // $9
      payment_method || 'cash',                   // $10
      estimated_distance || '0 km',               // $11
      estimated_duration || '0 min',              // $12
      parseFloat(fare) || 0,                      // $13
      'pending',                                  // $14 - status
      null,                                       // $15 - driver_id
      null,                                       // $16 - driver_name
      null,                                       // $17 - driver_phone
      delivery_details ? JSON.stringify(delivery_details) : null, // $18
      false,                                      // $19 - ride_started
      false                                       // $20 - ride_completed
    ];

    console.log('🔧 SQL Query prepared');
    console.log('📊 Values:', values.map((v, i) => `$${i+1}: ${v}`).join(', '));

    // Execute the raw SQL query
    const results = await sequelize.query(query, {
      bind: values,
      type: QueryTypes.SELECT
    });

    const newRide = results[0];
    
    console.log('========================================');
    console.log('✅ RIDE CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('🆔 Ride ID:', newRide.id);
    console.log('👤 Customer:', newRide.customer_name);
    console.log('📞 Phone:', newRide.customer_phone);
    console.log('🚀 Service Type:', newRide.service_type);
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
      console.error('Original Error:', error.original.message);
      console.error('SQL State:', error.original.code);
    }
    
    if (error.sql) {
      console.error('Failed SQL:', error.sql);
    }
    
    console.error('Stack Trace:', error.stack);
    console.log('========================================\n');

    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى.',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message,
        errorType: error.name
      })
    });
  }
});

// Get all rides (public - for testing)
router.get('/rides', async (req, res) => {
  try {
    console.log('📋 Fetching all rides...');
    
    const query = `
      SELECT id, service_type, customer_name, customer_phone,
             pickup_address, dropoff_address, fare, status,
             created_at, updated_at
      FROM rides
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const rides = await sequelize.query(query, {
      type: QueryTypes.SELECT
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
      message: 'فشل في جلب الطلبات'
    });
  }
});

module.exports = router;