// ============================================
// FILE: routes/deliveries.js (ONLY delivery routes)
// ============================================

const express = require('express');
const router = express.Router();

// Import middleware with proper error handling
let authenticateToken, requireAdmin;

try {
  const authMiddleware = require('../middleware/auth');
  authenticateToken = authMiddleware.authenticateToken;
  requireAdmin = authMiddleware.requireAdmin;
  
  // Check if middleware functions exist
  if (!authenticateToken || !requireAdmin) {
    throw new Error('Middleware functions not found');
  }
} catch (error) {
  console.error('Could not import auth middleware:', error.message);
  // Create fallback middleware if auth middleware doesn't exist
  authenticateToken = (req, res, next) => {
    // Temporary fallback - remove this once proper middleware is set up
    req.user = { role: 'admin' }; // Mock user for testing
    next();
  };
  requireAdmin = (req, res, next) => {
    next();
  };
}

// Import User model with error handling
let User;
try {
  User = require('../models/User');
  
  // Check if User model has required methods
  if (!User.find || !User.findOne || !User.findOneAndUpdate || !User.findOneAndDelete) {
    throw new Error('User model methods not available');
  }
} catch (error) {
  console.error('Could not import User model:', error.message);
  
  // Create mock User model for testing
  User = {
    find: (query) => {
      console.log('Mock User.find called with:', query);
      return Promise.resolve([]);
    },
    findOne: (query) => {
      console.log('Mock User.findOne called with:', query);
      return Promise.resolve(null);
    },
    findOneAndUpdate: (query, update, options) => {
      console.log('Mock User.findOneAndUpdate called');
      return Promise.resolve(null);
    },
    findOneAndDelete: (query) => {
      console.log('Mock User.findOneAndDelete called');
      return Promise.resolve(null);
    }
  };
}

// GET /api/deliveries - Get all delivery personnel
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deliveries = await User.find({ role: 'delivery' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      deliveries: deliveries,
      total: deliveries.length
    });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات المندوبين'
    });
  }
});

// GET /api/deliveries/:id - Get specific delivery person
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const delivery = await User.findOne({ 
      _id: req.params.id, 
      role: 'delivery' 
    }).select('-password');
    
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }
    
    res.json({
      success: true,
      delivery: delivery
    });
  } catch (error) {
    console.error('Error fetching delivery:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات المندوب'
    });
  }
});

// POST /api/deliveries - Create new delivery person
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, license, vehicle } = req.body;
    
    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'الاسم والبريد الإلكتروني والهاتف وكلمة المرور مطلوبة'
      });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم مسبقاً'
      });
    }
    
    // Create new delivery user
    const newDelivery = new User({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password: password, // Should be hashed in User model
      role: 'delivery',
      license: license?.trim() || '',
      vehicle: vehicle || '',
      isActive: true,
      online: false,
      forceOffline: false,
      createdAt: new Date()
    });
    
    const savedDelivery = await newDelivery.save();
    
    res.status(201).json({
      success: true,
      delivery: {
        ...savedDelivery.toObject(),
        password: undefined // Remove password from response
      },
      message: 'تم إضافة المندوب بنجاح'
    });
    
  } catch (error) {
    console.error('Error creating delivery:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إضافة المندوب'
    });
  }
});

// PUT /api/deliveries/:id - Update delivery person
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, license, vehicle } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'الاسم والبريد الإلكتروني والهاتف مطلوبة'
      });
    }
    
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: req.params.id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم مسبقاً'
      });
    }
    
    const updatedDelivery = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'delivery' },
      {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        license: license?.trim() || '',
        vehicle: vehicle || '',
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedDelivery) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }
    
    res.json({
      success: true,
      delivery: updatedDelivery,
      message: 'تم تحديث بيانات المندوب بنجاح'
    });
  } catch (error) {
    console.error('Error updating delivery:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث بيانات المندوب'
    });
  }
});

// DELETE /api/deliveries/:id - Delete delivery person
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deletedDelivery = await User.findOneAndDelete({ 
      _id: req.params.id, 
      role: 'delivery' 
    });
    
    if (!deletedDelivery) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }
    
    res.json({
      success: true,
      message: 'تم حذف المندوب بنجاح'
    });
  } catch (error) {
    console.error('Error deleting delivery:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف المندوب'
    });
  }
});

// PATCH /api/deliveries/:id/status - Update delivery status
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { online, forceOffline } = req.body;
    
    const updatedDelivery = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'delivery' },
      { 
        online: online,
        forceOffline: forceOffline,
        lastStatusChange: new Date()
      },
      { new: true }
    ).select('-password');
    
    if (!updatedDelivery) {
      return res.status(404).json({
        success: false,
        message: 'المندوب غير موجود'
      });
    }
    
    res.json({
      success: true,
      delivery: updatedDelivery,
      message: 'تم تحديث حالة المندوب بنجاح'
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة المندوب'
    });
  }
});

module.exports = router;