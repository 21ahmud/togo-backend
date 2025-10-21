// routes/orders.js - Complete Fixed Version
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { Op } = require('sequelize');

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
      return;
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
      restaurants: order.restaurants ? (typeof order.restaurants === 'string' ? JSON.parse(order.restaurants) : order.restaurants) : [],
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
    
  } catch (error) {
    console.error('[NOTIFY] Error notifying delivery drivers:', error);
    throw error;
  }
};

// Debug endpoints
router.get('/debug/all-orders-detailed', async (req, res) => {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  
  try {
    console.log('[DEBUG DETAILED] Fetching ALL orders from database...');
    
    const allOrders = await Order.findAll({
      order: [['created_at', 'DESC']],
      limit: 50,
      raw: true
    });
    
    console.log(`[DEBUG DETAILED] Found ${allOrders.length} total orders in database`);
    
    const analysis = {
      total_count: allOrders.length,
      status_breakdown: {},
      user_id_breakdown: {},
      recent_orders: allOrders.slice(0, 10).map(order => ({
        id: order.id,
        user_id: order.user_id,
        customer_name: order.customer_name,
        status: order.status,
        assigned_to: order.assigned_to,
        total: order.total,
        created_at: order.created_at,
        type: order.type
      })),
      pending_orders: allOrders.filter(o => o.status === 'pending_assignment').map(order => ({
        id: order.id,
        user_id: order.user_id,
        customer_name: order.customer_name,
        status: order.status,
        assigned_to: order.assigned_to,
        total: order.total,
        created_at: order.created_at
      })),
      all_statuses: [...new Set(allOrders.map(o => o.status))],
      null_or_invalid_ids: allOrders.filter(o => !o.id || o.id === null || o.id === undefined || o.id === 'null').length
    };
    
    allOrders.forEach(order => {
      analysis.status_breakdown[order.status] = (analysis.status_breakdown[order.status] || 0) + 1;
      analysis.user_id_breakdown[order.user_id] = (analysis.user_id_breakdown[order.user_id] || 0) + 1;
    });
    
    res.json({
      success: true,
      analysis,
      raw_sample: allOrders.slice(0, 3),
      message: `Found ${allOrders.length} orders total, ${analysis.pending_orders.length} pending`
    });
  } catch (error) {
    console.error('[DEBUG DETAILED] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Debug endpoint failed'
    });
  }
});

router.post('/debug/create-test-order', authenticateToken, async (req, res) => {
  try {
    console.log('[DEBUG] Creating test order for user:', req.user.id);
    
    const testOrder = await Order.create({
      user_id: req.user.id,
      customer_name: 'Test Customer',
      customer_phone: '01234567890',
      address: 'Test Address, Test City',
      items: JSON.stringify([{
        id: 1,
        name: 'Test Item',
        price: 50,
        quantity: 1
      }]),
      restaurants: JSON.stringify([{
        id: 1,
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      }]),
      subtotal: 50,
      delivery_fee: 15,
      total: 65,
      status: 'pending_assignment',
      payment_method: 'cash',
      type: 'restaurant',
      restaurant_emails: JSON.stringify(['test@restaurant.com']),
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log('[DEBUG] Test order created:', {
      id: testOrder.id,
      status: testOrder.status,
      user_id: testOrder.user_id
    });

    const verifyOrder = await Order.findByPk(testOrder.id);
    
    try {
      await notifyDeliveryDrivers(testOrder);
      console.log('[DEBUG] Drivers notified for test order');
    } catch (notifyError) {
      console.warn('[DEBUG] Failed to notify drivers:', notifyError.message);
    }
    
    res.json({
      success: true,
      message: 'Test order created successfully',
      order: {
        id: testOrder.id,
        status: testOrder.status,
        total: testOrder.total,
        user_id: testOrder.user_id,
        verified: !!verifyOrder
      }
    });
  } catch (error) {
    console.error('[DEBUG] Test order creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/debug/all-orders', async (req, res) => {
  try {
    console.log('[DEBUG] Fetching all recent orders...');
    
    const orders = await Order.findAll({
      order: [['created_at', 'DESC']],
      limit: 20,
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'role'],
          required: false
        },
        {
          model: User,
          as: 'delivery_driver',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        }
      ]
    });
    
    console.log(`[DEBUG] Found ${orders.length} orders in database`);
    
    const orderSummary = orders.map(o => ({
      id: o.id,
      status: o.status,
      customer_name: o.customer_name,
      total: parseFloat(o.total),
      created_at: o.created_at,
      assigned_to: o.assigned_to,
      customer_info: o.customer ? {
        id: o.customer.id,
        name: o.customer.name,
        role: o.customer.role
      } : null,
      delivery_info: o.delivery_driver ? {
        id: o.delivery_driver.id,
        name: o.delivery_driver.name
      } : null,
      has_restaurants: !!o.restaurants,
      restaurants_count: o.restaurants ? 
        (typeof o.restaurants === 'string' ? JSON.parse(o.restaurants).length : 0) : 0
    }));
    
    const statusCounts = {
      pending_assignment: orders.filter(o => o.status === 'pending_assignment').length,
      assigned: orders.filter(o => o.status === 'assigned').length,
      in_progress: orders.filter(o => o.status === 'in_progress').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    };
    
    res.json({
      success: true,
      total: orders.length,
      orders: orderSummary,
      status_counts: statusCounts,
      pending_orders_available: statusCounts.pending_assignment > 0,
      active_notifications: Array.from(notifications.keys()).length,
      system_time: new Date().toISOString(),
      database_connected: true
    });
  } catch (error) {
    console.error('[DEBUG] Error fetching debug orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Debug endpoint failed'
    });
  }
});

// ✅ MAIN POST ROUTE - CRITICAL FIX
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

    // Log received data
    console.log('[ORDER CREATE] Received data:', {
      items_type: typeof items,
      items_is_array: Array.isArray(items),
      items_length: items?.length,
      items_sample: items?.[0],
      restaurants_type: typeof restaurants,
      restaurants_is_array: Array.isArray(restaurants),
      restaurants_length: restaurants?.length,
      restaurants_sample: restaurants?.[0]
    });

    const actualUserId = user_id || req.user.id;

    // Validation
    const validationErrors = [];
    
    if (!actualUserId) validationErrors.push('معرف المستخدم مطلوب');
    if (!customer_name?.trim()) validationErrors.push('اسم العميل مطلوب');
    if (!customer_phone?.trim()) validationErrors.push('رقم هاتف العميل مطلوب');
    if (!address?.trim()) validationErrors.push('عنوان التوصيل مطلوب');
    if (!items || !Array.isArray(items) || items.length === 0) validationErrors.push('عناصر الطلب مطلوبة');
    if (!subtotal || isNaN(subtotal) || subtotal <= 0) validationErrors.push('المجموع الفرعي مطلوب ويجب أن يكون أكبر من صفر');
    if (!total || isNaN(total) || total <= 0) validationErrors.push('الإجمالي مطلوب ويجب أن يكون أكبر من صفر');

    if (validationErrors.length > 0) {
      console.error('[ORDER CREATE] Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'بيانات الطلب غير صحيحة',
        errors: validationErrors
      });
    }

    // ✅ CRITICAL FIX: Stringify arrays BEFORE passing to Sequelize
    const orderData = {
      user_id: parseInt(actualUserId),
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      address: address.trim(),
      customer_location: req.body.customer_location ? JSON.stringify(req.body.customer_location) : null,
      // ✅ Stringify items array manually
      items: JSON.stringify(Array.isArray(items) ? items : []),
      // ✅ Stringify restaurants array manually
      restaurants: JSON.stringify(Array.isArray(restaurants) ? restaurants : []),
      subtotal: parseFloat(subtotal),
      delivery_fee: parseFloat(delivery_fee || 0),
      total: parseFloat(total),
      status: 'pending_assignment',
      payment_method,
      type,
      // ✅ Stringify restaurant_emails array manually
      restaurant_emails: JSON.stringify(Array.isArray(restaurant_emails) ? restaurant_emails : []),
      locationAccuracy: req.body.locationAccuracy || null,
      hasAccurateLocation: req.body.hasAccurateLocation || false,
      estimated_delivery_time: parseInt(req.body.estimated_delivery_time || 30),
      priority: req.body.priority || 'normal',
      tax: parseFloat(req.body.tax || 0),
      notes: req.body.notes || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('[ORDER CREATE] Order data prepared (all fields stringified):', {
      items_type: typeof orderData.items,
      items_length: orderData.items.length,
      items_preview: orderData.items.substring(0, 150) + '...',
      restaurants_type: typeof orderData.restaurants,
      restaurants_preview: orderData.restaurants.substring(0, 150) + '...'
    });

    let newOrder;
    try {
      console.log('[ORDER CREATE] Calling Order.create()...');
      newOrder = await Order.create(orderData);
      console.log('[ORDER CREATE] Order created successfully:', {
        id: newOrder.id,
        status: newOrder.status,
        customer_name: newOrder.customer_name,
        total: newOrder.total,
        items_stored_type: typeof newOrder.items,
        restaurants_stored_type: typeof newOrder.restaurants
      });
    } catch (createError) {
      console.error('[ORDER CREATE] Order creation failed:', createError);
      console.error('[ORDER CREATE] Error details:', {
        message: createError.message,
        name: createError.name,
        errors: createError.errors,
        sql: createError.sql
      });
      throw createError;
    }
    
    const orderId = parseInt(newOrder.id);
    
    // Notify delivery drivers
    try {
      console.log('[ORDER CREATE] Notifying delivery drivers...');
      await notifyDeliveryDrivers(newOrder);
      console.log('[ORDER CREATE] Delivery drivers notified successfully');
    } catch (notifyError) {
      console.warn('[ORDER CREATE] Failed to notify drivers:', notifyError.message);
    }

    // ✅ Parse back to arrays for response
    let parsedItems = [];
    let parsedRestaurants = [];
    
    try {
      parsedItems = JSON.parse(newOrder.items);
    } catch (e) {
      console.error('[ORDER CREATE] Failed to parse items:', e);
      parsedItems = [];
    }
    
    try {
      parsedRestaurants = JSON.parse(newOrder.restaurants);
    } catch (e) {
      console.error('[ORDER CREATE] Failed to parse restaurants:', e);
      parsedRestaurants = [];
    }

    const orderResponse = {
      id: orderId,
      user_id: newOrder.user_id,
      customer_name: newOrder.customer_name,
      customer_phone: newOrder.customer_phone,
      address: newOrder.address,
      customer_location: newOrder.customer_location ? JSON.parse(newOrder.customer_location) : null,
      items: parsedItems,
      restaurants: parsedRestaurants,
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
    console.log('[ORDER CREATE] Response items count:', orderResponse.items.length);
    console.log('[ORDER CREATE] Response restaurants count:', orderResponse.restaurants.length);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح وإشعار المندوبين',
      order: orderResponse
    });

  } catch (error) {
    console.error('[ORDER CREATE] FATAL ERROR:', error);
    console.error('[ORDER CREATE] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء الطلب',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'خطأ داخلي في الخادم'
    });
  }
});

// GET all orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      assigned_to, 
      limit = 50, 
      offset = 0,
      type,
      priority,
      date_from,
      date_to 
    } = req.query;
    
    console.log('[ORDER FETCH] =================================');
    console.log('[ORDER FETCH] Request from user:', {
      userId: req.user?.id,
      userRole: req.user?.role,
      requestedStatus: status,
      assignedTo: assigned_to,
      limit: limit
    });
    
    let whereClause = {};
    
    if (req.user.role === 'user' || req.user.role === 'customer') {
      whereClause.user_id = req.user.id;
      console.log('[ORDER FETCH] Filtering by user_id for customer:', req.user.id);
    } else {
      console.log('[ORDER FETCH] No user_id filtering - user role:', req.user.role);
    }
    
    if (status) {
      if (Array.isArray(status)) {
        whereClause.status = { [Op.in]: status };
      } else {
        whereClause.status = status;
      }
      console.log('[ORDER FETCH] Filtering by status:', status);
    }
    
    if (assigned_to) {
      whereClause.assigned_to = parseInt(assigned_to);
      console.log('[ORDER FETCH] Filtering by assigned_to:', assigned_to);
    }

    if (type) {
      whereClause.type = type;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) {
        whereClause.created_at[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        whereClause.created_at[Op.lte] = new Date(date_to);
      }
    }

    console.log('[ORDER FETCH] Final where clause:', JSON.stringify(whereClause));
    
    const orders = await Order.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'delivery_driver',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        }
      ]
    });

    console.log(`[ORDER FETCH] Database query returned ${orders.length} orders`);

    const transformedOrders = orders.map((order, index) => {
      const orderId = order.id;
      if (!orderId || orderId === null || orderId === undefined) {
        console.warn('[ORDER FETCH] Order found with invalid ID, skipping:', order);
        return null;
      }

      try {
        let parsedItems = [];
        let parsedRestaurants = [];

        if (order.items) {
          if (typeof order.items === 'string') {
            try {
              parsedItems = JSON.parse(order.items);
            } catch (e) {
              console.error(`[ORDER FETCH] Failed to parse items for order ${orderId}:`, e);
              parsedItems = [];
            }
          } else if (Array.isArray(order.items)) {
            parsedItems = order.items;
          }
        }

        if (order.restaurants) {
          if (typeof order.restaurants === 'string') {
            try {
              parsedRestaurants = JSON.parse(order.restaurants);
            } catch (e) {
              console.error(`[ORDER FETCH] Failed to parse restaurants for order ${orderId}:`, e);
              parsedRestaurants = [];
            }
          } else if (Array.isArray(order.restaurants)) {
            parsedRestaurants = order.restaurants;
          }
        }

        const transformedOrder = {
          id: parseInt(orderId),
          user_id: order.user_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          address: order.address,
          customer_location: order.customer_location,
          items: parsedItems,
          restaurants: parsedRestaurants,
          subtotal: parseFloat(order.subtotal),
          delivery_fee: parseFloat(order.delivery_fee),
          total: parseFloat(order.total),
          status: order.status,
          payment_method: order.payment_method,
          type: order.type,
          assigned_to: order.assigned_to,
          assigned_delivery_name: order.assigned_delivery_name,
          assigned_delivery_phone: order.assigned_delivery_phone,
          accepted_at: order.accepted_at,
          started_at: order.started_at,
          completed_at: order.completed_at,
          estimated_delivery_time: order.estimated_delivery_time,
          priority: order.priority,
          locationAccuracy: order.locationAccuracy,
          hasAccurateLocation: order.hasAccurateLocation,
          created_at: order.created_at,
          updated_at: order.updated_at,
          tax: parseFloat(order.tax || 0),
          notes: order.notes,
          customer_info: order.customer ? {
            id: order.customer.id,
            name: order.customer.name,
            email: order.customer.email
          } : null,
          delivery_info: order.delivery_driver ? {
            id: order.delivery_driver.id,
            name: order.delivery_driver.name,
            phone: order.delivery_driver.phone
          } : null
        };

        return transformedOrder;
      } catch (parseError) {
        console.error('[ORDER FETCH] Error transforming order:', parseError, order.id);
        return null;
      }
    }).filter(order => order !== null);
    
    const statusBreakdown = {};
    transformedOrders.forEach(order => {
      statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
    });
    
    console.log('[ORDER FETCH] Status breakdown:', statusBreakdown);
    console.log('[ORDER FETCH] Returning', transformedOrders.length, 'orders');
    console.log('[ORDER FETCH] =================================');
    
    res.json({
      success: true,
      orders: transformedOrders,
      total: transformedOrders.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: transformedOrders.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[ORDER FETCH] Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الطلبات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// UPDATE order
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    console.log(`[ORDER UPDATE] =================================`);
    console.log(`[ORDER UPDATE] Updating order ${orderId}`);
    console.log(`[ORDER UPDATE] User:`, { id: req.user?.id, role: req.user?.role });
    console.log(`[ORDER UPDATE] Update data:`, req.body);
    
    if (!orderId || isNaN(orderId) || parseInt(orderId) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    const orderIdInt = parseInt(orderId);
    
    const existingOrder = await Order.findByPk(orderIdInt);
    if (!existingOrder) {
      console.error(`[ORDER UPDATE] Order ${orderIdInt} not found`);
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    console.log(`[ORDER UPDATE] Existing order:`, {
      id: existingOrder.id,
      status: existingOrder.status,
      assigned_to: existingOrder.assigned_to
    });

    const validStatusTransitions = {
      'pending_assignment': ['assigned', 'cancelled'],
      'assigned': ['in_progress', 'cancelled'],
      'in_progress': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    };

    if (req.body.status && req.body.status !== existingOrder.status) {
      const allowedTransitions = validStatusTransitions[existingOrder.status] || [];
      if (!allowedTransitions.includes(req.body.status)) {
        console.error(`[ORDER UPDATE] Invalid status transition: ${existingOrder.status} -> ${req.body.status}`);
        return res.status(400).json({
          success: false,
          message: `لا يمكن تغيير حالة الطلب من "${existingOrder.status}" إلى "${req.body.status}"`
        });
      }
    }

    if (req.user.role === 'delivery') {
      if (existingOrder.status === 'pending_assignment' && req.body.status === 'assigned') {
        console.log(`[ORDER UPDATE] Delivery driver ${req.user.id} accepting order ${orderIdInt}`);
        req.body.assigned_to = req.user.id;
        req.body.assigned_delivery_name = req.user.name;
        req.body.assigned_delivery_phone = req.user.phone;
        req.body.accepted_at = new Date().toISOString();
      } 
      else if (existingOrder.assigned_to && existingOrder.assigned_to !== req.user.id) {
        console.error(`[ORDER UPDATE] Driver ${req.user.id} not authorized for order ${orderIdInt} (assigned to ${existingOrder.assigned_to})`);
        return res.status(403).json({
          success: false,
          message: 'غير مسموح لك بتحديث هذا الطلب'
        });
      }

      if (req.body.status === 'in_progress' && !req.body.started_at) {
        req.body.started_at = new Date().toISOString();
      }
      if (req.body.status === 'delivered' && !req.body.completed_at) {
        req.body.completed_at = new Date().toISOString();
      }
    }

    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    if (req.body.items && Array.isArray(req.body.items)) {
      updateData.items = JSON.stringify(req.body.items);
    }
    if (req.body.restaurants && Array.isArray(req.body.restaurants)) {
      updateData.restaurants = JSON.stringify(req.body.restaurants);
    }
    if (req.body.restaurant_emails && Array.isArray(req.body.restaurant_emails)) {
      updateData.restaurant_emails = JSON.stringify(req.body.restaurant_emails);
    }

    if (updateData.assigned_to) {
      updateData.assigned_to = parseInt(updateData.assigned_to);
    }
    if (updateData.subtotal) {
      updateData.subtotal = parseFloat(updateData.subtotal);
    }
    if (updateData.delivery_fee) {
      updateData.delivery_fee = parseFloat(updateData.delivery_fee);
    }
    if (updateData.total) {
      updateData.total = parseFloat(updateData.total);
    }

    console.log(`[ORDER UPDATE] Final update data:`, updateData);

    const [updatedRowsCount] = await Order.update(updateData, {
      where: { id: orderIdInt }
    });

    console.log(`[ORDER UPDATE] Update result - rows affected: ${updatedRowsCount}`);

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على الطلب أو لم يتم تحديثه'
      });
    }

    const updatedOrder = await Order.findByPk(orderIdInt);
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'فشل في جلب الطلب المحدث'
      });
    }

    console.log(`[ORDER UPDATE] Order updated successfully:`, {
      id: updatedOrder.id,
      status: updatedOrder.status,
      assigned_to: updatedOrder.assigned_to
    });

    const transformedOrder = {
      id: parseInt(updatedOrder.id),
      user_id: updatedOrder.user_id,
      customer_name: updatedOrder.customer_name,
      customer_phone: updatedOrder.customer_phone,
      address: updatedOrder.address,
      customer_location: updatedOrder.customer_location,
      items: typeof updatedOrder.items === 'string' ? JSON.parse(updatedOrder.items) : updatedOrder.items,
      restaurants: typeof updatedOrder.restaurants === 'string' ? JSON.parse(updatedOrder.restaurants) : updatedOrder.restaurants,
      subtotal: parseFloat(updatedOrder.subtotal),
      delivery_fee: parseFloat(updatedOrder.delivery_fee),
      total: parseFloat(updatedOrder.total),
      status: updatedOrder.status,
      payment_method: updatedOrder.payment_method,
      type: updatedOrder.type,
      assigned_to: updatedOrder.assigned_to,
      assigned_delivery_name: updatedOrder.assigned_delivery_name,
      assigned_delivery_phone: updatedOrder.assigned_delivery_phone,
      accepted_at: updatedOrder.accepted_at,
      started_at: updatedOrder.started_at,
      completed_at: updatedOrder.completed_at,
      estimated_delivery_time: updatedOrder.estimated_delivery_time,
      priority: updatedOrder.priority,
      locationAccuracy: updatedOrder.locationAccuracy,
      hasAccurateLocation: updatedOrder.hasAccurateLocation,
      created_at: updatedOrder.created_at,
      updated_at: updatedOrder.updated_at,
      tax: parseFloat(updatedOrder.tax || 0),
      notes: updatedOrder.notes
    };
    
    console.log(`[ORDER UPDATE] =================================`);
    
    res.json({
      success: true,
      order: transformedOrder,
      message: 'تم تحديث الطلب بنجاح'
    });
  } catch (error) {
    console.error('[ORDER UPDATE] Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// GET single order
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    if (!orderId || isNaN(orderId) || parseInt(orderId) <= 0) {
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

    const transformedOrder = {
      id: parseInt(order.id),
      user_id: order.user_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      address: order.address,
      customer_location: order.customer_location,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      restaurants: typeof order.restaurants === 'string' ? JSON.parse(order.restaurants) : order.restaurants,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      total: parseFloat(order.total),
      status: order.status,
      payment_method: order.payment_method,
      type: order.type,
      assigned_to: order.assigned_to,
      assigned_delivery_name: order.assigned_delivery_name,
      assigned_delivery_phone: order.assigned_delivery_phone,
      accepted_at: order.accepted_at,
      started_at: order.started_at,
      completed_at: order.completed_at,
      estimated_delivery_time: order.estimated_delivery_time,
      priority: order.priority,
      locationAccuracy: order.locationAccuracy,
      hasAccurateLocation: order.hasAccurateLocation,
      created_at: order.created_at,
      updated_at: order.updated_at,
      tax: parseFloat(order.tax || 0),
      notes: order.notes
    };
    
    res.json({
      success: true,
      order: transformedOrder
    });
  } catch (error) {
    console.error('[ORDER GET] Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Notifications endpoints
router.get('/notifications/:driverId', authenticateToken, async (req, res) => {
  try {
    const driverId = parseInt(req.params.driverId);
    const driverNotifications = notifications.get(driverId) || [];
    
    res.json({
      success: true,
      notifications: driverNotifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الإشعارات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

router.put('/notifications/:driverId/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const driverId = parseInt(req.params.driverId);
    const notificationId = parseInt(req.params.notificationId);
    
    const driverNotifications = notifications.get(driverId) || [];
    const notification = driverNotifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      notifications.set(driverId, driverNotifications);
    }
    
    res.json({
      success: true,
      message: 'تم تحديث حالة الإشعار'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الإشعار',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

router.get('/debug/recent', async (req, res) => {
  try {
    const recentOrders = await Order.findAll({
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    res.json({
      success: true,
      orders: recentOrders.map(o => ({
        id: o.id,
        status: o.status,
        customer_name: o.customer_name,
        total: o.total,
        created_at: o.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delivery dashboard stats
router.get('/stats/delivery-dashboard', authenticateToken, requireRole(['delivery', 'admin']), async (req, res) => {
  try {
    const { delivery_id } = req.query;
    const actualDeliveryId = delivery_id || req.user.id;

    const [
      totalOrders,
      pendingOrders,
      assignedOrders,
      inProgressOrders,
      deliveredOrders,
      todaysOrders,
      totalEarnings
    ] = await Promise.all([
      Order.count({ where: { assigned_to: actualDeliveryId } }),
      Order.count({ where: { status: 'pending_assignment' } }),
      Order.count({ where: { status: 'assigned', assigned_to: actualDeliveryId } }),
      Order.count({ where: { status: 'in_progress', assigned_to: actualDeliveryId } }),
      Order.count({ where: { status: 'delivered', assigned_to: actualDeliveryId } }),
      Order.count({ 
        where: { 
          assigned_to: actualDeliveryId,
          created_at: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      Order.sum('delivery_fee', { 
        where: { 
          status: 'delivered', 
          assigned_to: actualDeliveryId 
        } 
      })
    ]);

    res.json({
      success: true,
      stats: {
        total_orders: totalOrders || 0,
        pending_orders: pendingOrders || 0,
        assigned_orders: assignedOrders || 0,
        in_progress_orders: inProgressOrders || 0,
        delivered_orders: deliveredOrders || 0,
        todays_orders: todaysOrders || 0,
        total_earnings: parseFloat(totalEarnings || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الإحصائيات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

module.exports = router;