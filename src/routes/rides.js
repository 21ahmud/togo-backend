// src/routes/rides.js - ULTRA-SIMPLE VERSION THAT WILL WORK
const express = require('express');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Test route
router.get('/test', async (req, res) => {
  try {
    const [results] = await sequelize.query('SELECT COUNT(*) as count FROM rides');
    res.json({
      success: true,
      message: 'Rides route is working',
      timestamp: new Date().toISOString(),
      totalRides: results[0].count
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

// Get all rides - ULTRA SIMPLE RAW SQL VERSION
router.get('/', auth, async (req, res) => {
  try {
    console.log('=== FETCHING RIDES ===');
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    console.log('User Phone:', req.user.phone);

    let query = '';
    let replacements = {};

    if (req.user.role === 'driver') {
      // Drivers see: their assigned rides + all pending rides
      query = `
        SELECT * FROM rides 
        WHERE driver_id = :userId 
        OR (status = 'pending' AND driver_id IS NULL)
        ORDER BY created_at DESC
      `;
      replacements = { userId: req.user.id };
    } else if (req.user.role === 'admin') {
      // Admins see all rides
      query = `
        SELECT * FROM rides 
        ORDER BY created_at DESC
      `;
    } else {
      // Customers see their own rides
      query = `
        SELECT * FROM rides 
        WHERE customer_phone = :phone
        ORDER BY created_at DESC
      `;
      replacements = { phone: req.user.phone };
    }

    console.log('Executing query:', query);
    console.log('With replacements:', replacements);

    const [rides] = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`Found ${rides ? rides.length : 0} rides`);

    // If no rides found, return empty array
    const ridesArray = Array.isArray(rides) ? rides : (rides ? [rides] : []);

    res.json({
      success: true,
      rides: ridesArray,
      count: ridesArray.length
    });

  } catch (error) {
    console.error('=== ERROR FETCHING RIDES ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message,
        errorType: error.name
      })
    });
  }
});

// Update ride - RAW SQL VERSION
router.put('/:id', auth, async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    const updates = req.body;

    console.log('=== UPDATING RIDE ===');
    console.log('Ride ID:', rideId);
    console.log('User ID:', req.user.id);
    console.log('Updates:', updates);

    // First, get the ride
    const [ride] = await sequelize.query(
      'SELECT * FROM rides WHERE id = :id',
      {
        replacements: { id: rideId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Check permissions
    if (req.user.role === 'driver') {
      if (ride.status === 'pending' && !ride.driver_id && updates.status === 'accepted') {
        // Driver accepting a ride - get driver info
        const [driver] = await sequelize.query(
          'SELECT id, name, phone FROM users WHERE id = :id',
          {
            replacements: { id: req.user.id },
            type: sequelize.QueryTypes.SELECT
          }
        );

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
        updates.accepted_at = new Date().toISOString();
      } else if (ride.driver_id && ride.driver_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'لا يمكنك تعديل طلب سائق آخر'
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مُخوَّل لتعديل الطلبات'
      });
    }

    // Build UPDATE query dynamically
    const updateFields = [];
    const replacements = { id: rideId };
    
    Object.keys(updates).forEach((key, index) => {
      updateFields.push(`${key} = :${key}`);
      replacements[key] = updates[key];
    });

    // Always update updated_at
    updateFields.push('updated_at = :updated_at');
    replacements.updated_at = new Date().toISOString();

    const updateQuery = `
      UPDATE rides 
      SET ${updateFields.join(', ')}
      WHERE id = :id
    `;

    console.log('Update query:', updateQuery);
    console.log('Replacements:', replacements);

    await sequelize.query(updateQuery, {
      replacements,
      type: sequelize.QueryTypes.UPDATE
    });

    // Fetch updated ride
    const [updatedRide] = await sequelize.query(
      'SELECT * FROM rides WHERE id = :id',
      {
        replacements: { id: rideId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    console.log('Ride updated successfully');

    res.json({
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      ride: updatedRide
    });

  } catch (error) {
    console.error('=== ERROR UPDATING RIDE ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الطلب'
    });
  }
});

// Get ride by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const rideId = parseInt(req.params.id);
    
    const [ride] = await sequelize.query(
      'SELECT * FROM rides WHERE id = :id',
      {
        replacements: { id: rideId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Check permissions
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
      'SELECT * FROM rides WHERE id = :id',
      {
        replacements: { id: rideId },
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
      'DELETE FROM rides WHERE id = :id',
      {
        replacements: { id: rideId },
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

module.exports = router;