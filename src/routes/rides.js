// src/routes/rides.js - POSTGRESQL OPTIMIZED VERSION
const express = require('express');
const sequelize = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Test route
router.get('/test', async (req, res) => {
  try {
    const [results] = await sequelize.query('SELECT COUNT(*) as total FROM rides');
    const totalRides = results[0]?.total || 0;
    
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

// Get all rides - POSTGRESQL OPTIMIZED WITH PROPER ERROR HANDLING
router.get('/', auth, async (req, res) => {
  try {
    console.log('========================================');
    console.log('📋 FETCHING RIDES');
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    console.log('User Phone:', req.user.phone);
    console.log('========================================');

    let query;
    let replacements = {};
    
    if (req.user.role === 'driver') {
      // Drivers see: their assigned rides + pending rides with no driver
      // PostgreSQL-specific: Use COALESCE for NULL handling
      query = `
        SELECT * FROM rides 
        WHERE driver_id = $1 
           OR (status = 'pending' AND driver_id IS NULL)
        ORDER BY created_at DESC
      `;
      replacements = [req.user.id];
      
      console.log('🚗 Driver query with ID:', req.user.id);
    } else if (req.user.role === 'admin') {
      // Admins see all rides
      query = `SELECT * FROM rides ORDER BY created_at DESC`;
      replacements = [];
      console.log('👑 Admin query - fetching all rides');
    } else {
      // Regular customers see their own rides
      query = `
        SELECT * FROM rides 
        WHERE customer_phone = $1 
        ORDER BY created_at DESC
      `;
      replacements = [req.user.phone];
      console.log('👤 Customer query - phone:', req.user.phone);
    }

    console.log('Executing PostgreSQL query...');
    console.log('Query:', query);
    console.log('Replacements:', replacements);

    // Use bind parameters for PostgreSQL
    const rides = await sequelize.query(query, {
      bind: replacements,
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`✅ Found ${rides.length} rides`);

    if (rides.length > 0) {
      console.log('Sample ride:', JSON.stringify(rides[0], null, 2));
    }

    // Manually fetch driver details if assigned
    const ridesWithDriverInfo = [];
    
    for (const ride of rides) {
      let rideWithDriver = { ...ride };
      
      if (ride.driver_id) {
        try {
          const [driver] = await sequelize.query(
            'SELECT id, name, phone, vehicle FROM users WHERE id = $1',
            {
              bind: [ride.driver_id],
              type: sequelize.QueryTypes.SELECT
            }
          );
          
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

// Update ride status - POSTGRESQL OPTIMIZED
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

    // Fetch current ride
    const [ride] = await sequelize.query(
      'SELECT * FROM rides WHERE id = $1',
      {
        bind: [rideId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
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
      if (ride.status === 'pending' && !ride.driver_id && updates.status === 'accepted') {
        // Driver accepting a ride - fetch driver info
        const [driver] = await sequelize.query(
          'SELECT id, name, phone, vehicle FROM users WHERE id = $1',
          {
            bind: [req.user.id],
            type: sequelize.QueryTypes.SELECT
          }
        );
        
        if (!driver) {
          console.log('❌ Driver profile not found');
          return res.status(403).json({
            success: false,
            message: 'بيانات السائق غير موجودة'
          });
        }
        
        console.log('✅ Driver accepting ride:', driver.name);
        
        updates.driver_id = req.user.id;
        updates.driver_name = driver.name;
        updates.driver_phone = driver.phone;
        updates.accepted_at = new Date().toISOString();
      } else if (ride.driver_id && ride.driver_id !== req.user.id) {
        console.log('❌ Permission denied - different driver');
        return res.status(403).json({
          success: false,
          message: 'لا يمكنك تعديل طلب سائق آخر'
        });
      }
    } else if (req.user.role !== 'admin') {
      console.log('❌ Permission denied - not admin or driver');
      return res.status(403).json({
        success: false,
        message: 'غير مُخوَّل لتعديل الطلبات'
      });
    }

    // Build update query dynamically using PostgreSQL placeholders
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    Object.keys(updates).forEach(key => {
      updateFields.push(`${key} = $${paramIndex}`);
      updateValues.push(updates[key]);
      paramIndex++;
    });
    
    // Always update updated_at
    updateFields.push(`updated_at = $${paramIndex}`);
    updateValues.push(new Date().toISOString());
    paramIndex++;
    
    // Add ride ID at the end
    updateValues.push(rideId);

    const updateQuery = `
      UPDATE rides 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('Update query:', updateQuery);
    console.log('Update values:', updateValues);

    const [updatedRide] = await sequelize.query(updateQuery, {
      bind: updateValues,
      type: sequelize.QueryTypes.UPDATE
    });

    console.log('✅ Ride updated successfully');
    console.log('New status:', updatedRide?.status || 'unknown');
    console.log('========================================\n');

    res.json({
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      ride: updatedRide || ride
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

// Get ride by ID - POSTGRESQL OPTIMIZED
router.get('/:id', auth, async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    
    const [ride] = await sequelize.query(
      'SELECT * FROM rides WHERE id = $1',
      {
        bind: [rideId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Fetch driver info if assigned
    if (ride.driver_id) {
      try {
        const [driver] = await sequelize.query(
          'SELECT id, name, phone, vehicle FROM users WHERE id = $1',
          {
            bind: [ride.driver_id],
            type: sequelize.QueryTypes.SELECT
          }
        );
        
        if (driver) {
          ride.driver = driver;
        }
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
    
    const [ride] = await sequelize.query(
      'SELECT * FROM rides WHERE id = $1',
      {
        bind: [rideId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    await sequelize.query(
      'DELETE FROM rides WHERE id = $1',
      {
        bind: [rideId],
        type: sequelize.QueryTypes.DELETE
      }
    );

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

// Get rides statistics - Admin only - POSTGRESQL OPTIMIZED
router.get('/stats/overview', auth, requireRole(['admin']), async (req, res) => {
  try {
    const [[totalResult]] = await sequelize.query(
      'SELECT COUNT(*) as total FROM rides',
      { type: sequelize.QueryTypes.SELECT }
    );
    const totalRides = parseInt(totalResult?.total) || 0;

    const [[pendingResult]] = await sequelize.query(
      "SELECT COUNT(*) as total FROM rides WHERE status = 'pending'",
      { type: sequelize.QueryTypes.SELECT }
    );
    const pendingRides = parseInt(pendingResult?.total) || 0;

    const [[activeResult]] = await sequelize.query(
      "SELECT COUNT(*) as total FROM rides WHERE status IN ('accepted', 'in_progress')",
      { type: sequelize.QueryTypes.SELECT }
    );
    const activeRides = parseInt(activeResult?.total) || 0;

    const [[completedResult]] = await sequelize.query(
      "SELECT COUNT(*) as total FROM rides WHERE status = 'completed'",
      { type: sequelize.QueryTypes.SELECT }
    );
    const completedRides = parseInt(completedResult?.total) || 0;

    const [[cancelledResult]] = await sequelize.query(
      "SELECT COUNT(*) as total FROM rides WHERE status = 'cancelled'",
      { type: sequelize.QueryTypes.SELECT }
    );
    const cancelledRides = parseInt(cancelledResult?.total) || 0;

    const revenueResults = await sequelize.query(
      "SELECT fare FROM rides WHERE status = 'completed'",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const totalRevenue = revenueResults.reduce((sum, ride) => {
      return sum + (parseFloat(ride.fare) || 0);
    }, 0);

    const rideTypeResults = await sequelize.query(
      'SELECT service_type, COUNT(*) as count FROM rides GROUP BY service_type',
      { type: sequelize.QueryTypes.SELECT }
    );

    const rideTypes = {};
    rideTypeResults.forEach(item => {
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