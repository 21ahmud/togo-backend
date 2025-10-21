// src/routes/rides.js - FIXED FOR DRIVER DASHBOARD
const express = require('express');
const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');
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

// Get all rides - Requires authentication - FIXED VERSION
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching rides for user:', req.user.id, 'role:', req.user.role);

    let whereClause = {};
    
    if (req.user.role === 'driver') {
      // Drivers see: their assigned rides + pending rides
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
      // Admins see all rides
    } else {
      // Regular customers see their own rides
      whereClause = {
        customer_phone: req.user.phone
      };
    }

    // Fetch rides WITHOUT associations to avoid errors
    const allRides = await Ride.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      raw: true // Return plain objects, no associations
    });

    // If driver is assigned, manually fetch driver details
    const ridesWithDriverInfo = await Promise.all(
      allRides.map(async (ride) => {
        if (ride.driver_id) {
          try {
            const driver = await User.findByPk(ride.driver_id, {
              attributes: ['id', 'name', 'phone', 'vehicle'],
              raw: true
            });
            return {
              ...ride,
              driver: driver || null
            };
          } catch (err) {
            console.error('Error fetching driver for ride:', ride.id, err);
            return ride;
          }
        }
        return ride;
      })
    );

    console.log(`Returning ${ridesWithDriverInfo.length} rides for user role: ${req.user.role}`);

    res.json({
      success: true,
      rides: ridesWithDriverInfo,
      count: ridesWithDriverInfo.length
    });

  } catch (error) {
    console.error('Get rides error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message,
        stack: error.stack
      })
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
        if (!driver) {
          return res.status(403).json({
            success: false,
            message: 'بيانات السائق غير موجودة'
          });
        }
        // Add driver info to updates
        updates.driver_id = req.user.id;
        updates.driver_name = driver.name;
        updates.driver_phone = driver.phone;
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

    // Update the ride
    await ride.update(updates);
    await ride.reload();

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
    const ride = await Ride.findByPk(rideId, { raw: true });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Fetch driver info if assigned
    if (ride.driver_id) {
      try {
        const driver = await User.findByPk(ride.driver_id, {
          attributes: ['id', 'name', 'phone', 'vehicle'],
          raw: true
        });
        ride.driver = driver;
      } catch (err) {
        console.error('Error fetching driver:', err);
      }
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
      attributes: ['fare'],
      raw: true
    });
    
    const totalRevenue = completedRidesWithFare.reduce((sum, ride) => {
      return sum + (parseFloat(ride.fare) || 0);
    }, 0);

    const sequelize = require('../config/database');
    const rideTypeCounts = await Ride.findAll({
      attributes: [
        'service_type',
        [sequelize.fn('COUNT', sequelize.col('service_type')), 'count']
      ],
      group: ['service_type'],
      raw: true
    });

    const rideTypes = {};
    rideTypeCounts.forEach(item => {
      rideTypes[item.service_type] = parseInt(item.count);
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