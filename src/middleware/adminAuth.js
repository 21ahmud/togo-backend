const { authenticateToken } = require('./auth');

const adminAuth = (req, res, next) => {
  // First authenticate the user
  authenticateToken(req, res, (err) => {
    if (err) {
      return next(err);
    }

    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذا المورد - مطلوب صلاحيات المدير',
        code: 'ADMIN_REQUIRED'
      });
    }

    // User is authenticated and is admin
    next();
  });
};

module.exports = adminAuth;