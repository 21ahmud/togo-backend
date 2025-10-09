// src/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    let token = req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق مطلوب للوصول'
      });
    }

    // Handle both "Bearer token" and just "token" formats
    if (token.startsWith('Bearer ')) {
      token = token.replace('Bearer ', '');
    }

    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق مطلوب للوصول'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET || 'your-secret-key');
    
    // Find user in database - use the userId from the token
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'حسابك غير نشط'
      });
    }

    // Attach user info to request
    req.userId = user.id;
    req.user = user;
    
    next();

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق غير صحيح'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'رمز التحقق منتهي الصلاحية'
      });
    }

    res.status(500).json({
      success: false,
      message: 'حدث خطأ في التحقق من الهوية'
    });
  }
};

module.exports = auth;