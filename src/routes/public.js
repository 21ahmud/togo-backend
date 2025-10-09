// src/routes/public.js
const express = require('express');
const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride'); // Import Ride model instead of rideStorage

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
        // Fixed Sequelize syntax - using Op.or and proper column references
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
      ], // Only return safe, public information
      order: [['createdAt', 'DESC']]
    });

    console.log(`Found ${drivers.length} available drivers`);

    // Return minimal driver info for public consumption
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
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات السائقين المتاحين'
    });
  }
});

// Create ride request (public - no auth required) - NOW USING DATABASE
router.post('/rides', async (req, res) => {
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

    console.log('Public ride request:', {
      service_type,
      customer_name,
      ride_type,
      pickup_address
    });

    // Validate required fields
    if (!customer_name || !customer_phone || !pickup_address || !dropoff_address) {
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة'
      });
    }

    // Validate service type specific fields
    if (service_type === 'delivery' && delivery_details) {
      if (!delivery_details.receiverName || !delivery_details.receiverPhone) {
        return res.status(400).json({
          success: false,
          message: 'بيانات المستلم مطلوبة للتوصيل'
        });
      }
    }

    // Create new ride in DATABASE (not memory)
    const newRide = await Ride.create({
      service_type: service_type || 'ride',
      customer_name,
      customer_phone,
      pickup_address,
      pickup_coordinates,
      dropoff_address,
      dropoff_coordinates,
      ride_type,
      vehicle_type,
      payment_method: payment_method || 'cash',
      estimated_distance,
      estimated_duration,
      fare: parseFloat(fare) || 0,
      status: 'pending',
      driver_id: null,
      driver_name: null,
      driver_phone: null,
      delivery_details
    });

    console.log('Public ride created successfully in database:', {
      id: newRide.id,
      service_type: newRide.service_type,
      customer: newRide.customer_name,
      ride_type: newRide.ride_type
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
        fare: newRide.fare
      }
    });

  } catch (error) {
    console.error('Public create ride error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get ride status (public - by phone number) - NOW USING DATABASE
router.get('/rides/status/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف مطلوب'
      });
    }

    // Get rides from DATABASE and filter by phone
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

    res.json({
      success: true,
      rides: userRides,
      message: userRides.length > 0 ? `تم العثور على ${userRides.length} طلب` : 'لا توجد طلبات مرتبطة بهذا الرقم'
    });

  } catch (error) {
    console.error('Get ride status error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب حالة الطلب'
    });
  }
});

// Get specific ride by ID (public)
router.get('/rides/:id', async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    
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
    console.error('Get ride by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب تفاصيل الطلب'
    });
  }
});

module.exports = router;