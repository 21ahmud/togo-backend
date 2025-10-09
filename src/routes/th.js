const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');

// Import the auth middleware - make sure this matches your existing file
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Auth route is working',
    timestamp: new Date().toISOString()
  });
});

const generateToken = (userId, userEmail, userRole) => {
  return jwt.sign(
    { 
      userId, 
      email: userEmail, 
      role: userRole 
    }, 
    process.env.JWT_SECRET || 'your-secret-key', 
    { expiresIn: '30d' }
  );
};

// Keep your existing register route but add the auth middleware check
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role = 'customer', license, vehicle } = req.body;

    // For delivery/driver creation, require authentication (admin only)
    if (role === 'delivery' || role === 'driver') {
      // Check if Authorization header exists
      const authHeader = req.header('Authorization');
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'يتطلب تسجيل الدخول كمدير لإنشاء مندوبين'
        });
      }

      try {
        // Extract and verify token
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.replace('Bearer ', '') 
          : authHeader;

        const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET || 'your-secret-key');
        const admin = await User.findByPk(decoded.userId);
        
        if (!admin || admin.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'يتطلب صلاحيات المدير لإنشاء مندوبين'
          });
        }
      } catch (authError) {
        return res.status(401).json({
          success: false,
          message: 'رمز التحقق غير صحيح أو منتهي الصلاحية'
        });
      }
    }

    // Basic validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة',
        errors: ['الاسم والبريد الإلكتروني والهاتف وكلمة المرور مطلوبة']
      });
    }

    // Role-specific validation
    if ((role === 'driver' || role === 'delivery') && (!license || !vehicle)) {
      return res.status(400).json({
        success: false,
        message: 'بيانات ناقصة',
        errors: ['رخصة القيادة ونوع المركبة مطلوبان للمندوبين']
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور ضعيفة',
        errors: ['كلمة المرور يجب أن تكون 6 أحرف على الأقل']
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني غير صحيح',
        errors: ['الرجاء إدخال بريد إلكتروني صحيح']
      });
    }

    // Phone validation
    if (phone.trim().length < 11) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف قصير',
        errors: ['رقم الهاتف يجب أن يكون 11 رقم على الأقل']
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({
      where: {
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
        message: `${conflictField} مستخدم بالفعل`,
        errors: [`${conflictField} مستخدم بالفعل`]
      });
    }

    // Prepare user data
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role: role || 'customer',
      isActive: true,
      isVerified: role === 'admin' // Auto-verify admin accounts
    };

    // Role-specific setup
    switch (role) {
      case 'driver':
        userData.license = license ? license.trim() : '';
        userData.vehicle = vehicle ? vehicle.trim() : '';
        userData.online = false;
        userData.forceOffline = false;
        userData.totalEarnings = 0;
        userData.totalRides = 0;
        userData.rating = 5.0;
        userData.location = { lat: 30.0444, lng: 31.2357 };
        break;
        
      case 'delivery':
        userData.license = license ? license.trim() : '';
        userData.vehicle = vehicle ? vehicle.trim() : '';
        userData.online = false;
        userData.forceOffline = false;
        userData.totalEarnings = 0;
        userData.totalDeliveries = 0;
        userData.rating = 5.0;
        userData.location = { lat: 30.0444, lng: 31.2357 };
        break;
        
      case 'restaurant':
        userData.online = false;
        userData.totalOrders = 0;
        userData.rating = 5.0;
        userData.isVerified = false;
        break;
        
      case 'pharmacy':
        userData.online = false;
        userData.totalOrders = 0;
        userData.rating = 5.0;
        userData.isVerified = false;
        break;
        
      case 'customer':
      default:
        userData.isVerified = true;
        break;
    }

    // Create the user
    const user = await User.create(userData);
    
    // Generate token for the new user
    const token = generateToken(user.id, user.email, user.role);

    // Success message based on role
    const successMessage = role === 'delivery' 
      ? 'تم إنشاء المندوب بنجاح' 
      : role === 'driver'
      ? 'تم إنشاء السائق بنجاح'
      : 'تم إنشاء الحساب بنجاح';

    res.status(201).json({
      success: true,
      message: successMessage,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        license: user.license,
        vehicle: user.vehicle,
        isVerified: user.isVerified,
        isActive: user.isActive,
        online: user.online,
        forceOffline: user.forceOffline,
        location: user.location,
        rating: user.rating,
        totalEarnings: user.totalEarnings,
        totalDeliveries: user.totalDeliveries,
        totalRides: user.totalRides,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Register error:', error);

    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: validationErrors
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
        message,
        errors: [message]
      });
    }

    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الحساب',
      errors: [process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم']
    });
  }
});

// Keep the rest of your existing routes exactly as they are
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password, role = 'customer' } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase().trim() },
          { phone: phone.trim() }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase().trim() 
          ? 'البريد الإلكتروني مستخدم بالفعل'
          : 'رقم الهاتف مستخدم بالفعل'
      });
    }

    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role: role || 'customer'
    };

    switch (role) {
      case 'restaurant':
        userData.online = false;
        userData.totalOrders = 0;
        userData.rating = 5.0;
        userData.isVerified = false;
        break;
      case 'pharmacy':
        userData.online = false;
        userData.totalOrders = 0;
        userData.rating = 5.0;
        userData.isVerified = false;
        break;
      case 'driver':
        userData.online = false;
        userData.forceOffline = false;
        userData.totalEarnings = 0;
        userData.totalRides = 0;
        userData.rating = 5.0;
        userData.location = { lat: 30.0444, lng: 31.2357 };
        break;
      case 'delivery':
        userData.online = false;
        userData.forceOffline = false;
        userData.totalEarnings = 0;
        userData.totalDeliveries = 0;
        userData.rating = 5.0;
        userData.location = { lat: 30.0444, lng: 31.2357 };
        break;
      case 'customer':
      default:
        userData.isVerified = true;
        break;
    }

    const user = await User.create(userData);
    const token = generateToken(user.id, user.email, user.role);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Signup error:', error);

    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: validationErrors
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
      message: 'حدث خطأ أثناء إنشاء الحساب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    const user = await User.scope('withPassword').findOne({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'حسابك غير نشط، يرجى التواصل مع الإدارة'
      });
    }

    await user.update({ lastLogin: new Date() });

    const token = generateToken(user.id, user.email, user.role);

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      online: user.online,
      location: user.location,
      rating: user.rating,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);

    if (error.name === 'SequelizeConnectionError') {
      return res.status(500).json({
        success: false,
        message: 'خطأ في الاتصال بقاعدة البيانات'
      });
    }

    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تسجيل الدخول',
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        stack: error.stack 
      })
    });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    res.json({
      success: true,
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب بيانات المستخدم'
    });
  }
});

router.put('/update-profile', auth, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phone', 'location', 'address', 'restaurantName', 'pharmacyName', 'vehicle'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد بيانات للتحديث'
      });
    }

    const [updatedRowsCount] = await User.update(updates, {
      where: { id: req.userId }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    const updatedUser = await User.findByPk(req.userId);

    res.json({
      success: true,
      message: 'تم تحديث البيانات بنجاح',
      user: updatedUser.toJSON()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: error.errors.map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث البيانات'
    });
  }
});

router.put('/update-status', auth, async (req, res) => {
  try {
    const { online, lastLogin } = req.body;
    const updates = {};

    if (typeof online === 'boolean') {
      updates.online = online;
    }

    if (lastLogin) {
      updates.lastLogin = new Date(lastLogin);
    }

    const [updatedRowsCount] = await User.update(updates, {
      where: { id: req.userId }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث الحالة بنجاح'
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الحالة'
    });
  }
});

router.post('/create-admin', async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'يوجد مسؤول بالفعل في النظام'
      });
    }

    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    const adminData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role: 'admin',
      isVerified: true,
      isActive: true
    };

    const admin = await User.create(adminData);
    const token = generateToken(admin.id, admin.email, admin.role);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء حساب المدير بنجاح',
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء حساب المدير'
    });
  }
});

module.exports = router;