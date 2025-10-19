// src/routes/rides.js
const express = require('express');
const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride'); // Add this import
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Test route
router.get('/test', async (req, res) => {
  try {
    const totalRides = await Ride.count();
    res.json({
      success: true,
      message: 'Rides route is working',
      timestamp: new Date().toISOString(),
      totalRides
    });
  } catch (error) {
    res.json({
      success: true,
      message: 'Rides route is working (database not connected)',
      timestamp: new Date().toISOString(),
      totalRides: 0
    });
  }
});

// PUBLIC: Create a new ride request (no auth required)
router.post('/', async (req, res) => {
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
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة'
      });
    }

    // Create new ride in database
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

    console.log('New ride created:', {
      id: newRide.id,
      service_type: newRide.service_type,
      customer: newRide.customer_name,
      ride_type: newRide.ride_type
    });

    res.json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      ride: newRide
    });

  } catch (error) {
  console.error('Create ride error:', error);
  console.error('Error details:', error.message);
  console.error('Error stack:', error.stack);
  res.status(500).json({
    success: false,
    message: 'فشل في إنشاء الطلب',
    error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ في الخادم'
  });
}
});

// Get all rides - Requires authentication
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching rides for user:', req.user.id, 'role:', req.user.role);

    let whereClause = {};
    
    // Filter rides based on user role
    if (req.user.role === 'driver') {
      // Drivers see: their assigned rides + pending rides that match their vehicle
      const driver = await User.findByPk(req.user.id);
      
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'بيانات السائق غير موجودة'
        });
      }

      // Get rides assigned to this driver OR pending rides
      whereClause = {
        [Op.or]: [
          { driver_id: req.user.id },
          { 
            status: 'pending',
            driver_id: null
          }
        ]
      };
    } else if (req.user.role === 'admin') {
      // Admins see all rides - no filter needed
    } else {
      // Regular customers see their own rides
      whereClause = {
        customer_phone: req.user.phone
      };
    }

    const allRides = await Ride.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'name', 'phone', 'vehicle'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    let filteredRides = allRides;

    // Additional filtering for drivers to match vehicle types
    if (req.user.role === 'driver') {
      const driver = await User.findByPk(req.user.id);
      
      filteredRides = allRides.filter(ride => {
        // Include rides assigned to this driver
        if (ride.driver_id === req.user.id) {
          return true;
        }
        
        // Include pending rides that match driver's vehicle
        if (ride.status === 'pending' && !ride.driver_id) {
          return isRideMatchingDriverVehicle(ride, driver.vehicle);
        }
        
        return false;
      });
    }

    console.log(`Returning ${filteredRides.length} rides for user role: ${req.user.role}`);

    res.json({
      success: true,
      rides: filteredRides,
      count: filteredRides.length
    });

  } catch (error) {
    console.error('Get rides error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات'
    });
  }
});

// Update ride status - Requires authentication
router.put('/:id', auth, async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    const updates = req.body;

    console.log('Updating ride:', rideId, 'by user:', req.user.id, 'updates:', updates);

    const ride = await Ride.findByPk(rideId);
    
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Permission checks
    if (req.user.role === 'driver') {
      // Drivers can accept pending rides or update their assigned rides
      if (ride.status === 'pending' && !ride.driver_id && updates.status === 'accepted') {
        // Driver accepting a ride
        const driver = await User.findByPk(req.user.id);
        if (!driver || !isRideMatchingDriverVehicle(ride, driver.vehicle)) {
          return res.status(403).json({
            success: false,
            message: 'هذا الطلب غير متطابق مع نوع مركبتك'
          });
        }
      } else if (ride.driver_id && ride.driver_id !== req.user.id) {
        // Driver trying to update someone else's ride
        return res.status(403).json({
          success: false,
          message: 'لا يمكنك تعديل طلب سائق آخر'
        });
      }
    } else if (req.user.role !== 'admin') {
      // Regular users can't update rides
      return res.status(403).json({
        success: false,
        message: 'غير مُخوَّل لتعديل الطلبات'
      });
    }

    // Update the ride in database
    await ride.update(updates);
    await ride.reload(); // Refresh the instance

    console.log('Ride updated successfully:', {
      id: ride.id,
      status: ride.status,
      driver_id: ride.driver_id
    });

    res.json({
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      ride: ride
    });

  } catch (error) {
    console.error('Update ride error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الطلب'
    });
  }
});

// Get ride by ID - Requires authentication
router.get('/:id', auth, async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    const ride = await Ride.findByPk(rideId, {
      include: [
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'name', 'phone', 'vehicle'],
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

    // Permission checks
    let canAccess = false;
    
    if (req.user.role === 'admin') {
      canAccess = true;
    } else if (req.user.role === 'driver') {
      canAccess = ride.driver_id === req.user.id || 
                  (ride.status === 'pending' && !ride.driver_id);
    } else {
      canAccess = ride.customer_phone === req.user.phone;
    }

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'غير مُخوَّل للوصول لهذا الطلب'
      });
    }

    res.json({
      success: true,
      ride
    });

  } catch (error) {
    console.error('Get ride error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب تفاصيل الطلب'
    });
  }
});

// Delete ride - Admin only
router.delete('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    const ride = await Ride.findByPk(rideId);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    await ride.destroy();

    res.json({
      success: true,
      message: 'تم حذف الطلب بنجاح'
    });

  } catch (error) {
    console.error('Delete ride error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الطلب'
    });
  }
});

// Helper function to match ride with driver vehicle
function isRideMatchingDriverVehicle(ride, driverVehicle) {
  if (!driverVehicle || !ride.ride_type) return false;
  
  const vehicleTypeMapping = {
    'سكوتر': ['scooter', 'bike', 'سكوتر', 'دراجة'],
    'scooter': ['scooter', 'bike', 'سكوتر', 'دراجة'],
    'دراجة': ['scooter', 'bike', 'سكوتر', 'دراجة'],
    'bike': ['scooter', 'bike', 'سكوتر', 'دراجة'],
    'موتوسيكل': ['scooter', 'bike', 'سكوتر', 'دراجة'],
    'دراجة نارية': ['scooter', 'bike', 'سكوتر', 'دراجة', 'دراجة نارية'],
    'سيارة عادية': ['standard', 'car', 'car_delivery', 'سيارة عادية', 'عادية'],
    'car': ['standard', 'car', 'car_delivery', 'سيارة عادية', 'عادية'],
    'عادية': ['standard', 'car', 'car_delivery', 'سيارة عادية', 'عادية'],
    'سيارة متميزة': ['premium', 'luxury_car', 'سيارة متميزة', 'متميزة', 'فاخرة'],
    'luxury': ['premium', 'luxury_car', 'سيارة متميزة', 'متميزة', 'فاخرة'],
    'متميزة': ['premium', 'luxury_car', 'سيارة متميزة', 'متميزة', 'فاخرة'],
    'فاخرة': ['premium', 'luxury_car', 'سيارة متميزة', 'متميزة', 'فاخرة'],
    'شاحنة': ['truck', 'شاحنة', 'نقل'],
    'truck': ['truck', 'شاحنة', 'نقل'],
    'شاحنة صغيرة': ['truck', 'شاحنة', 'نقل', 'شاحنة صغيرة'],
    'نقل': ['truck', 'شاحنة', 'نقل']
  };

  const driverVehicleLower = driverVehicle.toLowerCase();
  const rideType = ride.ride_type.toLowerCase();
  const vehicleType = ride.vehicle_type?.toLowerCase() || '';
  
  const driverVehicleTypes = vehicleTypeMapping[driverVehicle] || 
                            vehicleTypeMapping[driverVehicleLower] || 
                            [driverVehicleLower];
  
  const rideTypes = [rideType, vehicleType];
  
  return driverVehicleTypes.some(driverType => 
    rideTypes.some(rType => 
      driverType.includes(rType) || rType.includes(driverType) ||
      driverType === rType
    )
  );
}

// Get rides statistics - Admin only
router.get('/stats/overview', auth, requireRole(['admin']), async (req, res) => {
  try {
    const totalRides = await Ride.count();
    const pendingRides = await Ride.count({ where: { status: 'pending' } });
    const activeRides = await Ride.count({ 
      where: { 
        status: {
          [Op.in]: ['accepted', 'in_progress']
        }
      }
    });
    const completedRides = await Ride.count({ where: { status: 'completed' } });
    const cancelledRides = await Ride.count({ where: { status: 'cancelled' } });
    
    const completedRidesWithFare = await Ride.findAll({
      where: { status: 'completed' },
      attributes: ['fare']
    });
    
    const totalRevenue = completedRidesWithFare.reduce((sum, ride) => {
      return sum + (parseFloat(ride.fare) || 0);
    }, 0);

    const rideTypeCounts = await Ride.findAll({
      attributes: [
        'service_type',
        [sequelize.fn('COUNT', sequelize.col('service_type')), 'count']
      ],
      group: ['service_type']
    });

    const rideTypes = {};
    rideTypeCounts.forEach(item => {
      rideTypes[item.service_type] = parseInt(item.getDataValue('count'));
    });

    res.json({
      success: true,
      stats: {
        totalRides,
        pendingRides,
        activeRides,
        completedRides,
        cancelledRides,
        totalRevenue: totalRevenue.toFixed(2),
        rideTypes
      }
    });

  } catch (error) {
    console.error('Get rides stats error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب إحصائيات الطلبات'
    });
  }
});

module.exports = router;