// src/routes/delivery.js - New file for delivery driver status management
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Update delivery driver online/offline status
router.put('/status', authenticateToken, requireRole(['delivery']), async (req, res) => {
  try {
    const { status } = req.body;
    const driverId = req.user.id;

    console.log(`[DELIVERY STATUS] Driver ${driverId} updating status to: ${status}`);

    // Validate status
    if (!status || !['online', 'offline'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة. يجب أن تكون online أو offline'
      });
    }

    // Find and update the delivery driver
    const driver = await User.findByPk(driverId);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }

    if (driver.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        message: 'هذه الخدمة متاحة لمندوبي التوصيل فقط'
      });
    }

    // Update driver status
    const updateData = {
      online: status === 'online',
      lastStatusChange: new Date(),
      lastHeartbeat: status === 'online' ? new Date() : null
    };

    // If going offline, clear heartbeat
    if (status === 'offline') {
      updateData.lastHeartbeat = null;
    }

    await User.update(updateData, {
      where: { id: driverId }
    });

    console.log(`[DELIVERY STATUS] Driver ${driverId} status updated successfully to ${status}`);

    res.json({
      success: true,
      message: status === 'online' ? 'تم تسجيل دخولك بنجاح' : 'تم تسجيل خروجك بنجاح',
      status: status,
      online: status === 'online',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[DELIVERY STATUS] Error updating driver status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة المندوب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Heartbeat endpoint to maintain online status
router.post('/heartbeat', authenticateToken, requireRole(['delivery']), async (req, res) => {
  try {
    const driverId = req.user.id;

    console.log(`[DELIVERY HEARTBEAT] Received heartbeat from driver ${driverId}`);

    // Update last heartbeat timestamp
    const [updatedRowsCount] = await User.update({
      lastHeartbeat: new Date(),
      online: true // Ensure they're marked as online when sending heartbeat
    }, {
      where: { 
        id: driverId,
        role: 'delivery'
      }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث النبضة بنجاح',
      timestamp: new Date(),
      status: 'active'
    });

  } catch (error) {
    console.error('[DELIVERY HEARTBEAT] Error updating heartbeat:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث النبضة',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Get current driver status
router.get('/status', authenticateToken, requireRole(['delivery']), async (req, res) => {
  try {
    const driverId = req.user.id;
    
    const driver = await User.findByPk(driverId, {
      attributes: ['id', 'name', 'online', 'lastHeartbeat', 'lastStatusChange', 'forceOffline']
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }

    res.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        online: driver.online && !driver.forceOffline,
        lastHeartbeat: driver.lastHeartbeat,
        lastStatusChange: driver.lastStatusChange,
        forceOffline: driver.forceOffline
      }
    });

  } catch (error) {
    console.error('[DELIVERY STATUS GET] Error getting driver status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب حالة المندوب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Get all online drivers (admin only)
router.get('/online', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const onlineDrivers = await User.findAll({
      where: {
        role: 'delivery',
        online: true,
        forceOffline: false,
        isActive: true
      },
      attributes: ['id', 'name', 'email', 'phone', 'lastHeartbeat', 'lastStatusChange', 'location'],
      order: [['lastHeartbeat', 'DESC']]
    });

    // Filter drivers with recent heartbeat (last 2 minutes)
    const activeDrivers = onlineDrivers.filter(driver => {
      if (!driver.lastHeartbeat) return false;
      const timeDiff = Date.now() - new Date(driver.lastHeartbeat).getTime();
      return timeDiff < 2 * 60 * 1000; // 2 minutes
    });

    res.json({
      success: true,
      online_drivers: activeDrivers,
      total_online: activeDrivers.length,
      total_registered: onlineDrivers.length
    });

  } catch (error) {
    console.error('[DELIVERY ONLINE] Error getting online drivers:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب المندوبين المتصلين',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Force driver offline (admin only)
router.put('/:driverId/force-offline', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;

    const [updatedRowsCount] = await User.update({
      online: false,
      forceOffline: true,
      lastStatusChange: new Date(),
      offlineReason: reason || 'تم إجبار الخروج من قبل الإدارة'
    }, {
      where: { 
        id: driverId,
        role: 'delivery'
      }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }

    console.log(`[ADMIN ACTION] Driver ${driverId} forced offline by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'تم إجبار المندوب على الخروج بنجاح'
    });

  } catch (error) {
    console.error('[FORCE OFFLINE] Error forcing driver offline:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إجبار المندوب على الخروج',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Remove force offline status (admin only)
router.put('/:driverId/allow-online', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { driverId } = req.params;

    const [updatedRowsCount] = await User.update({
      forceOffline: false,
      offlineReason: null,
      lastStatusChange: new Date()
    }, {
      where: { 
        id: driverId,
        role: 'delivery'
      }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }

    console.log(`[ADMIN ACTION] Driver ${driverId} allowed back online by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'تم السماح للمندوب بالاتصال مرة أخرى'
    });

  } catch (error) {
    console.error('[ALLOW ONLINE] Error allowing driver online:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في السماح للمندوب بالاتصال',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Cleanup stale online statuses (can be called by a cron job)
router.post('/cleanup-stale', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const affectedRows = await User.cleanupStaleOnlineStatus();
    
    res.json({
      success: true,
      message: `تم تنظيف ${affectedRows} حالة اتصال منتهية الصلاحية`,
      affectedRows
    });
  } catch (error) {
    console.error('[CLEANUP STALE] Error cleaning up stale statuses:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تنظيف الحالات المنتهية الصلاحية',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

module.exports = router;