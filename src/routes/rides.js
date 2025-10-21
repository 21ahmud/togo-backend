// src/routes/rides.js - COMPLETE FIX FOR DRIVER DASHBOARD
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
      totalRides: 0,
      error: error.message
    });
  }
});

// Get all rides - COMPLETELY REWRITTEN FOR BETTER ERROR HANDLING
router.get('/', auth, async (req, res) => {
  try {
    console.log('========================================');
    console.log('📋 FETCHING RIDES');
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    console.log('User Phone:', req.user.phone);
    console.log('========================================');

    let whereClause = {};
    
    if (req.user.role === 'driver') {
      // Fetch all rides first, then filter in JavaScript to avoid SQL dialect issues
      const allDriverRides = await Ride.findAll({
        order: [['created_at', 'DESC']],
        raw: true
      });
      
      console.log(`🚗 Total rides in database: ${allDriverRides.length}`);
      
      // Filter: rides assigned to this driver OR pending rides with no driver
      const filteredRides = allDriverRides.filter(ride => {
        const isAssignedToDriver = ride.driver_id === req.user.id;
        const isPendingUnassigned = ride.status === 'pending' && (!ride.driver_id || ride.driver_id === null);
        return isAssignedToDriver || isPendingUnassigned;
      });
      
      console.log(`✅ Filtered to ${filteredRides.length} rides for driver ${req.user.id}`);
      console.log('  - Assigned rides:', filteredRides.filter(r => r.driver_id === req.user.id).length);
      console.log('  - Available rides:', filteredRides.filter(r => r.status === 'pending' && !r.driver_id).length);
      
      // Process driver info
      const ridesWithDriverInfo = [];
      for (const ride of filteredRides) {
        let rideWithDriver = { ...ride };
        
        if (ride.driver_id) {
          try {
            const driver = await User.findByPk(ride.driver_id, {
              attributes: ['id', 'name', 'phone', 'vehicle'],
              raw: true
            });
            
            if (driver) {
              rideWithDriver.driver = driver;
            }
          } catch (err) {
            console.error(`❌ Error fetching driver for ride ${ride.id}:`, err.message);
          }
        }
        
        ridesWithDriverInfo.push(rideWithDriver);
      }

      console.log('========================================');
      console.log(`✅ RETURNING ${ridesWithDriverInfo.length} RIDES`);
      console.log('========================================\n');

      return res.json({
        success: true,
        rides: ridesWithDriverInfo,
        count: ridesWithDriverInfo.length
      });
    } else if (req.user.role === 'admin') {
      // Admins see all rides
      console.log('👑 Admin query - fetching all rides');
    } else {
      // Regular customers see their own rides
      whereClause = {
        customer_phone: req.user.phone
      };
      console.log('👤 Customer query - phone:', req.user.phone);
    }

    console.log('Final whereClause:', JSON.stringify(whereClause, null, 2));

    // Fetch rides WITHOUT associations
    const allRides = await Ride.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      raw: true
    });

    console.log(`✅ Found ${allRides.length} rides in database`);

    if (allRides.length > 0) {
      console.log('Sample ride:', JSON.stringify(allRides[0], null, 2));
    }

    // Manually fetch driver details if assigned
    const ridesWithDriverInfo = [];
    
    for (const ride of allRides) {
      let rideWithDriver = { ...ride };
      
      if (ride.driver_id) {
        try {
          const driver = await User.findByPk(ride.driver_id, {
            attributes: ['id', 'name', 'phone', 'vehicle'],
            raw: true
          });
          
          if (driver) {
            rideWithDriver.driver = driver;
            console.log(`✅ Fetched driver info for ride ${ride.id}:`, driver.name);
          }
        } catch (err) {
          console.error(`❌ Error fetching driver for ride ${ride.id}:`, err.message);
        }
      }
      
      ridesWithDriverInfo.push(rideWithDriver);
    }

    console.log('========================================');
    console.log(`✅ RETURNING ${ridesWithDriverInfo.length} RIDES`);
    console.log('========================================\n');

    res.json({
      success: true,
      rides: ridesWithDriverInfo,
      count: ridesWithDriverInfo.length
    });

  } catch (error) {
    console.log('========================================');
    console.error('❌ GET RIDES ERROR');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.log('========================================\n');
    
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات',
      error: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

// Update ride status - Requires authentication
router.put('/:id', auth, async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    const updates = req.body;

    console.log('========================================');
    console.log('🔄 UPDATING RIDE');
    console.log('Ride ID:', rideId);
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    console.log('Updates:', JSON.stringify(updates, null, 2));
    console.log('========================================');

    const ride = await Ride.findByPk(rideId);
    
    if (!ride) {
      console.log('❌ Ride not found');
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    console.log('Current ride status:', ride.status);
    console.log('Current driver_id:', ride.driver_id);

    // Permission checks
    if (req.user.role === 'driver') {
      // Drivers can accept pending rides or update their assigned rides
      if (ride.status === 'pending' && !ride.driver_id && updates.status === 'accepted') {
        // Driver accepting a ride
        const driver = await User.findByPk(req.user.id);
        if (!driver) {
          console.log('❌ Driver profile not found');
          return res.status(403).json({
            success: false,
            message: 'بيانات السائق غير موجودة'
          });
        }
        
        console.log('✅ Driver accepting ride:', driver.name);
        
        // Add driver info to updates
        updates.driver_id = req.user.id;
        updates.driver_name = driver.name;
        updates.driver_phone = driver.phone;
        updates.accepted_at = new Date();
      } else if (ride.driver_id && ride.driver_id !== req.user.id) {
        // Driver trying to update someone else's ride
        console.log('❌ Permission denied - different driver');
        return res.status(403).json({
          success: false,
          message: 'لا يمكنك تعديل طلب سائق آخر'
        });
      }
    } else if (req.user.role !== 'admin') {
      // Regular users can't update rides
      console.log('❌ Permission denied - not admin or driver');
      return res.status(403).json({
        success: false,
        message: 'غير مُخوَّل لتعديل الطلبات'
      });
    }

    // Update the ride
    await ride.update(updates);
    await ride.reload();

    console.log('✅ Ride updated successfully');
    console.log('New status:', ride.status);
    console.log('New driver_id:', ride.driver_id);
    console.log('========================================\n');

    res.json({
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      ride: ride
    });

  } catch (error) {
    console.error('❌ Update ride error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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