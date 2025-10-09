const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const notifications = new Map();

const notifyDeliveryDrivers = async (order) => {
  try {
    console.log(`[NOTIFY] Creating notification for order #${order.id}`);
    
    const deliveryDrivers = await User.findAll({
      where: { 
        role: 'delivery',
        isActive: true
      }
    });

    console.log(`[NOTIFY] Found ${deliveryDrivers.length} active delivery drivers`);

    if (deliveryDrivers.length === 0) {
      console.warn('[NOTIFY] No active delivery drivers found');
      return { success: true, notified_drivers: 0, message: 'No active drivers' };
    }

    const notification = {
      id: Date.now(),
      type: 'new_order',
      order_id: order.id,
      title: 'طلب جديد متاح',
      message: `طلب جديد للتوصيل #${order.id} - ج.م ${order.total}`,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_location: order.address,
      total: parseFloat(order.total),
      delivery_fee: parseFloat(order.delivery_fee || 0),
      restaurants: typeof order.restaurants === 'string' ? JSON.parse(order.restaurants) : (order.restaurants || []),
      created_at: new Date(),
      read: false,
      priority: order.priority || 'normal'
    };

    deliveryDrivers.forEach(driver => {
      if (!notifications.has(driver.id)) {
        notifications.set(driver.id, []);
      }
      
      const driverNotifications = notifications.get(driver.id);
      driverNotifications.unshift(notification);
      
      if (driverNotifications.length > 50) {
        driverNotifications.splice(50);
      }
      
      notifications.set(driver.id, driverNotifications);
      
      console.log(`[NOTIFY] Added notification to driver ${driver.id} (${driver.name})`);
    });

    console.log(`[NOTIFY] Successfully notified ${deliveryDrivers.length} delivery drivers about order #${order.id}`);
    
    return { success: true, notified_drivers: deliveryDrivers.length };
  } catch (error) {
    console.error('[NOTIFY] Error notifying delivery drivers:', error);
    throw error;
  }
};

router.post('/new-order', authenticateToken, async (req, res) => {
  try {
    console.log(`[NOTIFICATIONS API] Received new-order request:`, req.body);
    
    const { order_id, message, type = 'new_order' } = req.body;
    
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب مطلوب'
      });
    }

    const orderIdInt = parseInt(order_id);
    
    let order = await Order.findByPk(orderIdInt);
    
    if (!order) {
      console.log(`[NOTIFICATIONS API] Order ${orderIdInt} not found, waiting 500ms...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      order = await Order.findByPk(orderIdInt);
    }
    
    if (!order) {
      console.error(`[NOTIFICATIONS API] Order ${order_id} still not found after retry`);
      return res.status(200).json({
        success: true,
        message: 'الطلب قيد المعالجة',
        notified_drivers: 0
      });
    }

    console.log(`[NOTIFICATIONS API] Found order ${order_id}, notifying drivers...`);
    
    const result = await notifyDeliveryDrivers(order);
    
    res.json({
      success: true,
      message: 'تم إرسال الإشعار بنجاح للمندوبين',
      notified_drivers: result.notified_drivers
    });
    
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error in new-order endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الإشعار',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

router.get('/:driverId', authenticateToken, async (req, res) => {
  try {
    const driverId = parseInt(req.params.driverId);
    
    if (isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف المندوب غير صحيح'
      });
    }
    
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح لك بالوصول لهذه الإشعارات'
      });
    }
    
    const driverNotifications = notifications.get(driverId) || [];
    
    console.log(`[NOTIFICATIONS API] Retrieved ${driverNotifications.length} notifications for driver ${driverId}`);
    
    res.json({
      success: true,
      notifications: driverNotifications,
      total: driverNotifications.length,
      unread: driverNotifications.filter(n => !n.read).length
    });
    
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الإشعارات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        message: 'هذا الإشعار متاح للمندوبين فقط'
      });
    }
    
    const driverNotifications = notifications.get(req.user.id) || [];
    
    console.log(`[NOTIFICATIONS API] Retrieved ${driverNotifications.length} notifications for current user ${req.user.id}`);
    
    res.json({
      success: true,
      notifications: driverNotifications,
      total: driverNotifications.length,
      unread: driverNotifications.filter(n => !n.read).length
    });
    
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error fetching user notifications:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الإشعارات'
    });
  }
});

router.put('/:driverId/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const driverId = parseInt(req.params.driverId);
    const notificationId = parseInt(req.params.notificationId);
    
    if (isNaN(driverId) || isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'معرفات غير صحيحة'
      });
    }
    
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح لك بتعديل هذا الإشعار'
      });
    }
    
    const driverNotifications = notifications.get(driverId) || [];
    const notification = driverNotifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }
    
    notification.read = true;
    notification.read_at = new Date();
    
    notifications.set(driverId, driverNotifications);
    
    console.log(`[NOTIFICATIONS API] Marked notification ${notificationId} as read for driver ${driverId}`);
    
    res.json({
      success: true,
      message: 'تم تحديث حالة الإشعار'
    });
    
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الإشعار'
    });
  }
});

router.delete('/:driverId/:notificationId', authenticateToken, async (req, res) => {
  try {
    const driverId = parseInt(req.params.driverId);
    const notificationId = parseInt(req.params.notificationId);
    
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح لك بحذف هذا الإشعار'
      });
    }
    
    const driverNotifications = notifications.get(driverId) || [];
    const updatedNotifications = driverNotifications.filter(n => n.id !== notificationId);
    
    if (driverNotifications.length === updatedNotifications.length) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }
    
    notifications.set(driverId, updatedNotifications);
    
    res.json({
      success: true,
      message: 'تم حذف الإشعار'
    });
    
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الإشعار'
    });
  }
});

router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح بالوصول للإحصائيات'
      });
    }
    
    let totalNotifications = 0;
    let totalUnread = 0;
    let driversWithNotifications = 0;
    
    notifications.forEach((driverNotifications, driverId) => {
      if (driverNotifications.length > 0) {
        driversWithNotifications++;
        totalNotifications += driverNotifications.length;
        totalUnread += driverNotifications.filter(n => !n.read).length;
      }
    });
    
    res.json({
      success: true,
      stats: {
        total_notifications: totalNotifications,
        total_unread: totalUnread,
        drivers_with_notifications: driversWithNotifications,
        total_drivers_registered: notifications.size
      }
    });
    
  } catch (error) {
    console.error('[NOTIFICATIONS API] Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الإحصائيات'
    });
  }
});

const cleanupOldNotifications = () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  notifications.forEach((driverNotifications, driverId) => {
    const recentNotifications = driverNotifications.filter(
      n => new Date(n.created_at) > oneWeekAgo
    );
    
    if (recentNotifications.length !== driverNotifications.length) {
      notifications.set(driverId, recentNotifications);
      console.log(`[NOTIFICATIONS] Cleaned up old notifications for driver ${driverId}`);
    }
  });
};

setInterval(cleanupOldNotifications, 60 * 60 * 1000);

module.exports = router;
module.exports.notifications = notifications;