const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { Op } = require('sequelize');

const notifications = new Map();

// Helper function to safely stringify JSON fields
const safeStringify = (data) => {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return JSON.stringify(data);
  if (data && typeof data === 'object') return JSON.stringify(data);
  return JSON.stringify([]);
};

// Helper function to safely parse JSON fields
const safeParse = (data, defaultValue = []) => {
  if (!data) return defaultValue;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('JSON parse error:', e);
    return defaultValue;
  }
};

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
      restaurants: safeParse(order.restaurants),
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

// ✅ FIXED POST ENDPOINT
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('[ORDER CREATE] =================================');
    console.log('[ORDER CREATE] Starting order creation process');
    console.log('[ORDER CREATE] User from auth:', { 
      id: req.user?.id, 
      role: req.user?.role,
      name: req.user?.name
    });

    if (!req.user || !req.user.id) {
      console.error('[ORDER CREATE] No authenticated user found');
      return res.status(401).json({
        success: false,
        message: 'المصادقة مطلوبة'
      });
    }

    const {
      user_id,
      customer_name,
      customer_phone,
      address,
      items,
      subtotal,
      delivery_fee,
      total,
      payment_method = 'cash',
      type = 'restaurant',
      restaurants,
      restaurant_emails
    } = req.body;

    // Validation
    const validationErrors = [];
    
    if (!customer_name?.trim()) validationErrors.push('اسم العميل مطلوب');
    if (!customer_phone?.trim()) validationErrors.push('رقم هاتف العميل مطلوب');
    if (!address?.trim()) validationErrors.push('عنوان التوصيل مطلوب');
    if (!items || !Array.isArray(items) || items.length === 0) validationErrors.push('عناصر الطلب مطلوبة');
    if (!subtotal || isNaN(subtotal) || subtotal <= 0) validationErrors.push('المجموع الفرعي مطلوب');
    if (!total || isNaN(total) || total <= 0) validationErrors.push('الإجمالي مطلوب');

    if (validationErrors.length > 0) {
      console.error('[ORDER CREATE] Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'بيانات الطلب غير صحيحة',
        errors: validationErrors
      });
    }

    const actualUserId = user_id || req.user.id;

    // ✅ CRITICAL FIX: Manually stringify JSON fields
    const orderData = {
      user_id: parseInt(actualUserId),
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      address: address.trim(),
      customer_location: req.body.customer_location ? safeStringify(req.body.customer_location) : null,
      
      // ✅ STRINGIFY ARRAYS BEFORE SAVING
      items: safeStringify(items),
      restaurants: safeStringify(restaurants || []),
      restaurant_emails: safeStringify(restaurant_emails || []),
      
      subtotal: parseFloat(subtotal),
      delivery_fee: parseFloat(delivery_fee || 0),
      total: parseFloat(total),
      status: 'pending_assignment',
      payment_method,
      type,
      locationAccuracy: req.body.locationAccuracy || null,
      hasAccurateLocation: req.body.hasAccurateLocation || false,
      estimated_delivery_time: parseInt(req.body.estimated_delivery_time || 30),
      priority: req.body.priority || 'normal',
      tax: parseFloat(req.body.tax || 0),
      notes: req.body.notes || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('[ORDER CREATE] Order data types:', {
      items_type: typeof orderData.items,
      restaurants_type: typeof orderData.restaurants,
      items_is_string: typeof orderData.items === 'string',
      restaurants_is_string: typeof orderData.restaurants === 'string'
    });

    // Create order
    let newOrder;
    try {
      newOrder = await Order.create(orderData);
      console.log('[ORDER CREATE] Order created successfully:', {
        id: newOrder.id,
        status: newOrder.status,
        customer_name: newOrder.customer_name,
        total: newOrder.total
      });
    } catch (createError) {
      console.error('[ORDER CREATE] Order creation failed:', createError);
      throw createError;
    }
    
    // Verify order ID
    const orderId = parseInt(newOrder.id);
    if (!orderId || orderId <= 0) {
      throw new Error('معرف الطلب غير صحيح');
    }
    
    // Notify delivery drivers
    try {
      console.log('[ORDER CREATE] Notifying delivery drivers...');
      await notifyDeliveryDrivers(newOrder);
      console.log('[ORDER CREATE] Delivery drivers notified successfully');
    } catch (notifyError) {
      console.warn('[ORDER CREATE] Failed to notify drivers:', notifyError.message);
    }

    // Prepare response - getters will parse JSON back to arrays
    const orderResponse = {
      id: orderId,
      user_id: newOrder.user_id,
      customer_name: newOrder.customer_name,
      customer_phone: newOrder.customer_phone,
      address: newOrder.address,
      customer_location: newOrder.customer_location, // Getter parses JSON
      items: newOrder.items, // Getter parses JSON to array
      restaurants: newOrder.restaurants, // Getter parses JSON to array
      subtotal: parseFloat(newOrder.subtotal),
      delivery_fee: parseFloat(newOrder.delivery_fee),
      total: parseFloat(newOrder.total),
      status: newOrder.status,
      payment_method: newOrder.payment_method,
      type: newOrder.type,
      created_at: newOrder.created_at,
      updated_at: newOrder.updated_at,
      estimated_delivery_time: newOrder.estimated_delivery_time,
      priority: newOrder.priority
    };

    console.log('[ORDER CREATE] SUCCESS - Returning response for order:', orderId);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح وإشعار المندوبين',
      order: orderResponse
    });

  } catch (error) {
    console.error('[ORDER CREATE] FATAL ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء الطلب',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : 'خطأ داخلي في الخادم'
    });
  }
});

// ✅ FIXED PUT ENDPOINT
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    console.log(`[ORDER UPDATE] Updating order ${orderId}`);
    
    if (!orderId || isNaN(orderId) || parseInt(orderId) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    const orderIdInt = parseInt(orderId);
    
    const existingOrder = await Order.findByPk(orderIdInt);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Build update data
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    // ✅ Stringify arrays if they're being updated
    if (req.body.items && Array.isArray(req.body.items)) {
      updateData.items = safeStringify(req.body.items);
    }
    if (req.body.restaurants && Array.isArray(req.body.restaurants)) {
      updateData.restaurants = safeStringify(req.body.restaurants);
    }
    if (req.body.restaurant_emails && Array.isArray(req.body.restaurant_emails)) {
      updateData.restaurant_emails = safeStringify(req.body.restaurant_emails);
    }
    if (req.body.customer_location && typeof req.body.customer_location === 'object') {
      updateData.customer_location = safeStringify(req.body.customer_location);
    }

    // Update order
    await Order.update(updateData, {
      where: { id: orderIdInt }
    });

    const updatedOrder = await Order.findByPk(orderIdInt);
    
    res.json({
      success: true,
      order: {
        id: parseInt(updatedOrder.id),
        user_id: updatedOrder.user_id,
        customer_name: updatedOrder.customer_name,
        customer_phone: updatedOrder.customer_phone,
        address: updatedOrder.address,
        customer_location: updatedOrder.customer_location,
        items: updatedOrder.items,
        restaurants: updatedOrder.restaurants,
        subtotal: parseFloat(updatedOrder.subtotal),
        delivery_fee: parseFloat(updatedOrder.delivery_fee),
        total: parseFloat(updatedOrder.total),
        status: updatedOrder.status,
        payment_method: updatedOrder.payment_method,
        type: updatedOrder.type,
        assigned_to: updatedOrder.assigned_to,
        created_at: updatedOrder.created_at,
        updated_at: updatedOrder.updated_at
      },
      message: 'تم تحديث الطلب بنجاح'
    });
  } catch (error) {
    console.error('[ORDER UPDATE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// GET all orders (existing endpoint - should work fine)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, assigned_to, limit = 50, offset = 0 } = req.query;
    
    let whereClause = {};
    
    if (req.user.role === 'user' || req.user.role === 'customer') {
      whereClause.user_id = req.user.id;
    }
    
    if (status) {
      whereClause.status = Array.isArray(status) ? { [Op.in]: status } : status;
    }
    
    if (assigned_to) {
      whereClause.assigned_to = parseInt(assigned_to);
    }

    const orders = await Order.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const transformedOrders = orders.map(order => ({
      id: parseInt(order.id),
      user_id: order.user_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      address: order.address,
      customer_location: order.customer_location,
      items: order.items, // Getter handles parsing
      restaurants: order.restaurants, // Getter handles parsing
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      total: parseFloat(order.total),
      status: order.status,
      payment_method: order.payment_method,
      type: order.type,
      assigned_to: order.assigned_to,
      created_at: order.created_at,
      updated_at: order.updated_at
    }));
    
    res.json({
      success: true,
      orders: transformedOrders,
      total: transformedOrders.length
    });
  } catch (error) {
    console.error('[ORDER FETCH] Error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// GET single order
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    const order = await Order.findByPk(parseInt(orderId));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    res.json({
      success: true,
      order: {
        id: parseInt(order.id),
        user_id: order.user_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.address,
        customer_location: order.customer_location,
        items: order.items,
        restaurants: order.restaurants,
        subtotal: parseFloat(order.subtotal),
        delivery_fee: parseFloat(order.delivery_fee),
        total: parseFloat(order.total),
        status: order.status,
        payment_method: order.payment_method,
        type: order.type,
        created_at: order.created_at,
        updated_at: order.updated_at
      }
    });
  } catch (error) {
    console.error('[ORDER GET] Error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

module.exports = router;