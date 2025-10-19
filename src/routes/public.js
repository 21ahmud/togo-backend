// src/routes/public.js
const express = require('express');
const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');

const router = express.Router();

// Get available drivers (public - limited info)
router.get('/drivers', async (req, res) => {
  try {
    console.log('Public request for available drivers');

    const drivers = await User.findAll({
      where: { 
        role: 'driver',
        online: true,
        isActive: true,
        isVerified: true,
        [Op.or]: [
          { forceOffline: { [Op.or]: [false, null] } },
          { force_offline: { [Op.or]: [false, null] } }
        ]
      },
      attributes: [
        'id', 
        'vehicle', 
        'online', 
        'rating'
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log(`Found ${drivers.length} available drivers`);

    const publicDrivers = drivers.map(driver => ({
      id: driver.id,
      vehicle: driver.vehicle,
      online: driver.online,
      rating: driver.rating || 5.0
    }));

    res.json({
      success: true,
      drivers: publicDrivers,
      count: publicDrivers.length
    });

  } catch (error) {
    console.error('Public get drivers error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات السائقين المتاحين',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create ride request (public - no auth required)
router.post('/rides', async (req, res) => {
  try {
    console.log('=== PUBLIC RIDE REQUEST RECEIVED ===');
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

    console.log('Extracted data:', {
      service_type,
      customer_name,
      customer_phone,
      pickup_address: pickup_address?.substring(0, 50),
      dropoff_address: dropoff_address?.substring(0, 50),
      ride_type,
      vehicle_type,
      fare
    });

    // Validate required fields
    if (!customer_name || !customer_phone || !pickup_address || !dropoff_address) {
      console.error('Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة',
        missing: {
          customer_name: !customer_name,
          customer_phone: !customer_phone,
          pickup_address: !pickup_address,
          dropoff_address: !dropoff_address
        }
      });
    }

    // Validate service type specific fields
    if (service_type === 'delivery' && delivery_details) {
      if (!delivery_details.receiverName || !delivery_details.receiverPhone) {
        console.error('Validation failed - missing delivery details');
        return res.status(400).json({
          success: false,
          message: 'بيانات المستلم مطلوبة للتوصيل'
        });
      }
    }

    console.log('Creating ride in database...');

    // Create new ride in database
    const rideData = {
      service_type: service_type || 'ride',
      customer_name,
      customer_phone,
      pickup_address,
      pickup_coordinates: pickup_coordinates || null,
      dropoff_address,
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
      delivery_details: delivery_details || null
    };

    console.log('Ride data to be created:', JSON.stringify(rideData, null, 2));

    const newRide = await Ride.create(rideData);

    console.log('✅ Ride created successfully in database:', {
      id: newRide.id,
      service_type: newRide.service_type,
      customer: newRide.customer_name,
      ride_type: newRide.ride_type,
      status: newRide.status
    });

    res.json({
      success: true,
      message: 'تم إرسال طلبك بنجاح وسيتم التواصل معك قريباً',
      ride: {
        id: newRide.id,
        status: newRide.status,
        created_at: newRide.created_at,
        service_type: newRide.service_type,
        estimated_duration: newRide.estimated_duration,
        estimated_distance: newRide.estimated_distance,
        fare: newRide.fare,
        customer_name: newRide.customer_name,
        pickup_address: newRide.pickup_address,
        dropoff_address: newRide.dropoff_address
      }
    });

  } catch (error) {
    console.error('❌ PUBLIC CREATE RIDE ERROR:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'SequelizeValidationError') {
      console.error('Validation errors:', error.errors?.map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      })));
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: error.errors?.map(e => e.message)
      });
    }

    if (error.name === 'SequelizeDatabaseError') {
      console.error('Database error details:', error.parent?.message || error.original?.message);
      return res.status(500).json({
        success: false,
        message: 'خطأ في قاعدة البيانات',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get ride status (public - by phone number)
router.get('/rides/status/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    console.log('Getting rides for phone:', phone);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف مطلوب'
      });
    }

    const userRides = await Ride.findAll({
      where: {
        customer_phone: phone
      },
      include: [
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'name', 'phone', 'vehicle', 'rating'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    console.log(`Found ${userRides.length} rides for phone ${phone}`);

    res.json({
      success: true,
      rides: userRides,
      count: userRides.length,
      message: userRides.length > 0 ? `تم العثور على ${userRides.length} طلب` : 'لا توجد طلبات مرتبطة بهذا الرقم'
    });

  } catch (error) {
    console.error('Get ride status error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب حالة الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get specific ride by ID (public)
router.get('/rides/:id', async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    
    console.log('Getting ride by ID:', rideId);

    if (isNaN(rideId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    const ride = await Ride.findByPk(rideId, {
      include: [
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'name', 'phone', 'vehicle', 'rating'],
          required: false
        }
      ]
    });

    if (!ride) {
      console.log('Ride not found:', rideId);
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    console.log('Ride found:', ride.id);

    res.json({
      success: true,
      ride
    });

  } catch (error) {
    console.error('Get ride by ID error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب تفاصيل الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test endpoint to verify the route is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Public routes are working',
    timestamp: new Date().toISOString(),
    endpoints: {
      drivers: 'GET /api/public/drivers',
      createRide: 'POST /api/public/rides',
      rideStatus: 'GET /api/public/rides/status/:phone',
      getRide: 'GET /api/public/rides/:id'
    }
  });
});

module.exports = router;