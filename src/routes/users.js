const express = require('express');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auth, requireAdmin } = require('../middleware/auth'); // Keep existing auth for admin routes

const router = express.Router();

// Get current user profile - FIXED to allow all authenticated users
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    console.log('[USER PROFILE] Request from user:', {
      id: req.user?.id,
      role: req.user?.role,
      email: req.user?.email
    });

    const user = await User.findByPk(req.user.id, {
      attributes: { 
        exclude: ['password'] 
      }
    });

    if (!user) {
      console.error('[USER PROFILE] User not found:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    console.log('[USER PROFILE] Profile retrieved successfully for user:', user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        profilePicture: user.profilePicture,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Role-specific fields
        ...(user.role === 'delivery' && {
          license: user.license,
          vehicle: user.vehicle,
          rating: user.rating || 4.8,
          total_deliveries: user.total_deliveries || 0,
          total_earnings: user.total_earnings || 0,
          online: user.online || false,
          forceOffline: user.forceOffline || false
        }),
        ...(user.role === 'driver' && {
          license: user.license,
          vehicle: user.vehicle,
          rating: user.rating || 4.7,
          total_rides: user.total_rides || 0,
          total_earnings: user.total_earnings || 0,
          online: user.online || false
        }),
        ...(user.role === 'pharmacy' && {
          license_number: user.license_number,
          status: user.status || 'active'
        }),
        ...(user.role === 'restaurant' && {
          status: user.status || 'active',
          cuisine: user.cuisine,
          location: user.location
        })
      }
    });

  } catch (error) {
    console.error('[USER PROFILE] Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات الملف الشخصي',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ داخلي في الخادم'
    });
  }
});

// Update current user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    console.log('[USER PROFILE UPDATE] Request from user:', req.user.id);
    
    const { 
      name, 
      phone, 
      address, 
      dateOfBirth, 
      gender,
      // Delivery-specific fields
      license, 
      vehicle,
      // Driver-specific fields 
      online
    } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Build update object with only provided fields
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updates.gender = gender;
    
    // Role-specific updates
    if (user.role === 'delivery' || user.role === 'driver') {
      if (license !== undefined) updates.license = license.trim();
      if (vehicle !== undefined) updates.vehicle = vehicle;
      if (typeof online === 'boolean') updates.online = online;
    }

    // Check for phone conflicts with other users
    if (phone) {
      const existingUser = await User.findOne({
        where: {
          phone: updates.phone,
          id: { [Op.ne]: req.user.id }
        }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'رقم الهاتف مستخدم بالفعل'
        });
      }
    }

    await user.update(updates);

    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    console.log('[USER PROFILE UPDATE] Profile updated successfully for user:', user.id);

    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: updatedUser
    });

  } catch (error) {
    console.error('[USER PROFILE UPDATE] Error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: error.errors.map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الملف الشخصي'
    });
  }
});

// ADMIN ROUTES - Keep existing functionality
// GET /users - Fetch all users with optional role filter
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;
    
    const whereClause = {};
    if (role) {
      whereClause.role = role;
    }

    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      users,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب المستخدمين'
    });
  }
});

// PUT /users/:id - Update user data
router.put('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, license, vehicle, online, forceOffline, isActive } = req.body;

    // Build update object with only provided fields
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (license !== undefined) updates.license = license.trim();
    if (vehicle !== undefined) updates.vehicle = vehicle;
    if (typeof online === 'boolean') updates.online = online;
    if (typeof forceOffline === 'boolean') updates.forceOffline = forceOffline;
    if (typeof isActive === 'boolean') updates.isActive = isActive;

    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Check for email/phone conflicts with other users
    if (email || phone) {
      const conflictWhere = {
        id: { [Op.ne]: id }
      };
      
      if (email && phone) {
        conflictWhere[Op.or] = [
          { email: updates.email },
          { phone: updates.phone }
        ];
      } else if (email) {
        conflictWhere.email = updates.email;
      } else if (phone) {
        conflictWhere.phone = updates.phone;
      }

      const existingUser = await User.findOne({ where: conflictWhere });
      if (existingUser) {
        const conflictField = existingUser.email === updates.email ? 'البريد الإلكتروني' : 'رقم الهاتف';
        return res.status(400).json({
          success: false,
          message: `${conflictField} مستخدم بالفعل`
        });
      }
    }

    // Update user
    await user.update(updates);

    // Fetch updated user
    const updatedUser = await User.findByPk(id);

    res.json({
      success: true,
      message: 'تم تحديث بيانات المستخدم بنجاح',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    
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
      message: 'فشل في تحديث المستخدم'
    });
  }
});

// DELETE /users/:id - Delete user
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكنك حذف حسابك الخاص'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف المستخدم'
    });
  }
});

// GET /users/:id - Get single user
router.get('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات المستخدم'
    });
  }
});

module.exports = router;