// src/routes/drivers.js - Complete Enhanced Version with Driver Profile Access

const express = require('express');
const { Op } = require('sequelize');
const User = require('../models/User');
const { auth, requireRole, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Test route (no auth required)
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Drivers route is working',
    timestamp: new Date().toISOString()
  });
});

// Driver Profile Endpoint - Allow drivers to access their own profile
router.get('/profile', auth, async (req, res) => {
  try {
    console.log('Driver profile request from user:', req.user.id, 'role:', req.user.role);
    
    // Only allow drivers to access this endpoint
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'هذا المورد مخصص للسائقين فقط',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Find the driver user
    const driver = await User.findByPk(req.user.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على ملف السائق'
      });
    }

    console.log('Driver profile found:', driver.name);

    // Return driver profile with all needed fields
    res.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        vehicle: driver.vehicle,
        license: driver.license,
        rating: driver.rating || 5.0,
        total_rides: driver.totalRides || driver.total_deliveries || 0,
        online: driver.online || false,
        force_offline: driver.forceOffline || driver.force_offline || false,
        location: driver.location || { lat: 30.0444, lng: 31.2357 },
        created_at: driver.createdAt,
        updated_at: driver.updatedAt,
        totalEarnings: driver.totalEarnings || driver.total_earnings || 0,
        totalDeliveries: driver.totalDeliveries || driver.total_deliveries || 0,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching driver profile:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// Driver Status Update - Allow drivers to update their own status OR admins to update any driver
router.put('/:id/status', auth, async (req, res) => {
  try {
    const driverId = req.params.id;
    const { online, last_login, forceOffline } = req.body;

    console.log('Status update request for driver:', driverId, 'by user:', req.user.id, 'role:', req.user.role);

    // Allow drivers to update their own status, or admins to update any driver
    if (req.user.role !== 'admin' && req.user.id.toString() !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'يمكنك تحديث حالتك فقط أو يجب أن تكون مديراً'
      });
    }

    const driver = await User.findOne({
      where: { 
        id: driverId,
        role: 'driver'
      }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'السائق غير موجود'
      });
    }

    // Prepare update data
    const updateData = {};
    
    if (typeof online === 'boolean') {
      updateData.online = online;
    }
    
    if (last_login) {
      updateData.lastLogin = new Date(last_login);
    }

    // Only admins can set forceOffline
    if (req.user.role === 'admin' && typeof forceOffline === 'boolean') {
      updateData.forceOffline = forceOffline;
      updateData.force_offline = forceOffline; // Support both field names
      // If forcing offline, also set online to false
      if (forceOffline) {
        updateData.online = false;
      }
    }

    // Update driver status
    await driver.update(updateData);

    console.log('Driver status updated:', updateData);

    res.json({
      success: true,
      message: 'تم تحديث الحالة بنجاح',
      driver: {
        id: driver.id,
        online: driver.online,
        forceOffline: driver.forceOffline,
        lastLogin: driver.lastLogin
      }
    });

  } catch (error) {
    console.error('Error updating driver status:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الحالة'
    });
  }
});

// Driver Location Update - Allow drivers to update their own location
router.put('/:id/location', auth, async (req, res) => {
  try {
    const driverId = req.params.id;
    const { latitude, longitude, last_location_update } = req.body;

    console.log('Location update request for driver:', driverId, 'by user:', req.user.id);

    // Allow drivers to update their own location, or admins to update any driver
    if (req.user.role !== 'admin' && req.user.id.toString() !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'يمكنك تحديث موقعك فقط'
      });
    }

    const driver = await User.findOne({
      where: { 
        id: driverId,
        role: 'driver'
      }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'السائق غير موجود'
      });
    }

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'إحداثيات الموقع غير صحيحة'
      });
    }

    // Update location
    const newLocation = { lat: latitude, lng: longitude };
    await driver.update({
      location: newLocation,
      last_location_update: last_location_update || new Date()
    });

    console.log('Driver location updated:', newLocation);

    res.json({
      success: true,
      message: 'تم تحديث الموقع بنجاح',
      location: newLocation
    });

  } catch (error) {
    console.error('Error updating driver location:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الموقع'
    });
  }
});

// Get all drivers - Admin only
router.get('/', auth, requireRole(['admin']), async (req, res) => {
  try {
    console.log(`Fetching drivers for admin user: ${req.user.id}`);

    const drivers = await User.findAll({
      where: { 
        role: 'driver'
      },
      order: [['createdAt', 'DESC']]
    });

    console.log(`Found ${drivers.length} drivers`);

    res.json({
      success: true,
      drivers: drivers.map(driver => ({
        ...driver.toJSON(),
        // Ensure compatibility with frontend expectations
        totalRides: driver.totalRides || driver.total_deliveries || 0,
        totalEarnings: driver.totalEarnings || driver.total_earnings || 0,
        forceOffline: driver.forceOffline || driver.force_offline || false
      })),
      count: drivers.length
    });

  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات السائقين',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get specific driver by ID - Admin only
router.get('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await User.findOne({
      where: { 
        id, 
        role: 'driver' 
      }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'السائق غير موجود'
      });
    }

    res.json({
      success: true,
      driver: {
        ...driver.toJSON(),
        totalRides: driver.totalRides || driver.total_deliveries || 0,
        totalEarnings: driver.totalEarnings || driver.total_earnings || 0,
        forceOffline: driver.forceOffline || driver.force_offline || false
      }
    });

  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات السائق',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update driver information - Admin only
router.put('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, license, vehicle } = req.body;

    console.log(`Admin ${req.user.id} updating driver ${id}:`, { name, email, phone, license, vehicle });

    // Find the driver first
    const driver = await User.findOne({
      where: { 
        id, 
        role: 'driver' 
      }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'السائق غير موجود'
      });
    }

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'الاسم والبريد الإلكتروني والهاتف مطلوبة'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني غير صحيح'
      });
    }

    // Validate phone length
    if (phone.trim().length < 11) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف يجب أن يكون 11 رقم على الأقل'
      });
    }

    // Check for email/phone conflicts with other users
    const existingUser = await User.findOne({
      where: {
        id: { [Op.ne]: id }, // Exclude current driver
        [Op.or]: [
          { email: email.toLowerCase().trim() },
          { phone: phone.trim() }
        ]
      }
    });

    if (existingUser) {
      const conflictField = existingUser.email === email.toLowerCase().trim() 
        ? 'البريد الإلكتروني' 
        : 'رقم الهاتف';
      return res.status(400).json({
        success: false,
        message: `${conflictField} مستخدم بالفعل`
      });
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim()
    };

    // Add optional fields if provided
    if (license) updateData.license = license.trim();
    if (vehicle) updateData.vehicle = vehicle;

    // Update the driver
    await driver.update(updateData);

    console.log(`Driver ${id} updated successfully`);

    res.json({
      success: true,
      message: 'تم تحديث بيانات السائق بنجاح',
      driver: {
        ...driver.toJSON(),
        totalRides: driver.totalRides || driver.total_deliveries || 0,
        totalEarnings: driver.totalEarnings || driver.total_earnings || 0,
        forceOffline: driver.forceOffline || driver.force_offline || false
      }
    });

  } catch (error) {
    console.error('Update driver error:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: error.errors.map(err => err.message)
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path;
      const message = field === 'email' 
        ? 'البريد الإلكتروني مستخدم بالفعل'
        : field === 'phone'
        ? 'رقم الهاتف مستخدم بالفعل'
        : 'البيانات مستخدمة بالفعل';
      
      return res.status(400).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'فشل في تحديث بيانات السائق',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update driver status (online/offline/forceOffline) - Admin only version
router.patch('/:id/status', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { online, forceOffline } = req.body;

    console.log(`Admin ${req.user.id} updating driver ${id} status:`, { online, forceOffline });

    const driver = await User.findOne({
      where: { 
        id, 
        role: 'driver' 
      }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'السائق غير موجود'
      });
    }

    // Prepare status update
    const statusUpdate = {};
    
    if (typeof online === 'boolean') {
      statusUpdate.online = online;
    }
    
    if (typeof forceOffline === 'boolean') {
      statusUpdate.forceOffline = forceOffline;
      statusUpdate.force_offline = forceOffline; // Support both field names
      // If forcing offline, also set online to false
      if (forceOffline) {
        statusUpdate.online = false;
      }
    }

    if (Object.keys(statusUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد بيانات حالة للتحديث'
      });
    }

    await driver.update(statusUpdate);

    console.log(`Driver ${id} status updated:`, statusUpdate);

    res.json({
      success: true,
      message: 'تم تحديث حالة السائق بنجاح',
      driver: {
        ...driver.toJSON(),
        totalRides: driver.totalRides || driver.total_deliveries || 0,
        totalEarnings: driver.totalEarnings || driver.total_earnings || 0,
        forceOffline: driver.forceOffline || driver.force_offline || false
      }
    });

  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة السائق',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete driver - Admin only
router.delete('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Admin ${req.user.id} attempting to delete driver ${id}`);

    const driver = await User.findOne({
      where: { 
        id, 
        role: 'driver' 
      }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'السائق غير موجود'
      });
    }

    // Store driver info for logging
    const driverInfo = { name: driver.name, email: driver.email };

    await driver.destroy();

    console.log(`Driver deleted:`, driverInfo);

    res.json({
      success: true,
      message: 'تم حذف السائق بنجاح'
    });

  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف السائق',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get online drivers - Admin only
router.get('/online/list', auth, requireRole(['admin']), async (req, res) => {
  try {
    const onlineDrivers = await User.findAll({
      where: { 
        role: 'driver',
        online: true,
        [Op.or]: [
          { forceOffline: false },
          { forceOffline: { [Op.is]: null } },
          { force_offline: false },
          { force_offline: { [Op.is]: null } }
        ]
      },
      order: [['lastLogin', 'DESC']]
    });

    res.json({
      success: true,
      drivers: onlineDrivers.map(driver => ({
        ...driver.toJSON(),
        totalRides: driver.totalRides || driver.total_deliveries || 0,
        totalEarnings: driver.totalEarnings || driver.total_earnings || 0,
        forceOffline: driver.forceOffline || driver.force_offline || false
      })),
      count: onlineDrivers.length
    });

  } catch (error) {
    console.error('Get online drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب السائقين المتصلين',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Driver statistics - Admin only
router.get('/stats/overview', auth, requireRole(['admin']), async (req, res) => {
  try {
    const stats = await User.findAndCountAll({
      where: { role: 'driver' },
      attributes: [
        'id', 
        'online', 
        'forceOffline',
        'force_offline',
        'totalRides', 
        'total_deliveries',
        'totalEarnings',
        'total_earnings',
        'rating',
        'createdAt'
      ]
    });

    const totalDrivers = stats.count;
    const onlineDrivers = stats.rows.filter(d => 
      d.online && !(d.forceOffline || d.force_offline)
    ).length;
    const offlineDrivers = stats.rows.filter(d => 
      !d.online || d.forceOffline || d.force_offline
    ).length;
    const forcedOfflineDrivers = stats.rows.filter(d => 
      d.forceOffline || d.force_offline
    ).length;
    
    const totalEarnings = stats.rows.reduce((sum, driver) => 
      sum + (parseFloat(driver.totalEarnings || driver.total_earnings) || 0), 0
    );
    
    const totalRides = stats.rows.reduce((sum, driver) => 
      sum + (parseInt(driver.totalRides || driver.total_deliveries) || 0), 0
    );

    const averageRating = stats.rows.reduce((sum, driver) => 
      sum + (parseFloat(driver.rating) || 5.0), 0
    ) / (totalDrivers || 1);

    res.json({
      success: true,
      stats: {
        totalDrivers,
        onlineDrivers,
        offlineDrivers,
        forcedOfflineDrivers,
        totalEarnings: totalEarnings.toFixed(2),
        totalRides,
        averageRating: averageRating.toFixed(2)
      }
    });

  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب إحصائيات السائقين',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;