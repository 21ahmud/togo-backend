// src/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق مطلوب للوصول',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق مطلوب للوصول',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'رمز التحقق منتهي الصلاحية',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'رمز التحقق غير صحيح',
          code: 'INVALID_TOKEN'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق غير صالح',
        code: 'TOKEN_ERROR'
      });
    }

    // Check if decoded token has required fields
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق غير صالح - معرف المستخدم مفقود',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    }

    // Find user in database (using findByPk for Sequelize or findById for MongoDB)
    let user;
    try {
      // Try Sequelize first
      user = await User.findByPk(decoded.userId);
    } catch (error) {
      // If Sequelize fails, try MongoDB
      user = await User.findById(decoded.userId);
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user account is active
    if (user.isActive !== undefined && !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'حسابك غير نشط، يرجى التواصل مع الإدارة',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Attach user info to request object
    req.userId = user.id;
    req.user = user;
    req.userRole = user.role;
    
    console.log(`Auth successful for user: ${user.id} (${user.role})`);
    next();

  } catch (error) {
    console.error('Auth middleware unexpected error:', error);
    
    // Database connection errors
    if (error.name === 'SequelizeConnectionError') {
      return res.status(500).json({
        success: false,
        message: 'خطأ في الاتصال بقاعدة البيانات',
        code: 'DATABASE_ERROR'
      });
    }

    // Database query errors
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({
        success: false,
        message: 'خطأ في قاعدة البيانات',
        code: 'DATABASE_QUERY_ERROR'
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في التحقق من الهوية',
      code: 'SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        stack: error.stack 
      })
    });
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'غير مُخوَّل',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح لك بالوصول لهذا المورد',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'هذا المورد متاح للمديرين فقط',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
};

// Simple auth middleware (lightweight version without database check)
const simpleAuth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق مطلوب'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Simple auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'رمز التحقق غير صحيح'
    });
  }
};

// Export all middleware functions
module.exports = {
  auth: authenticateToken, // Alias for backward compatibility
  authenticateToken,
  requireRole,
  requireAdmin,
  simpleAuth
};