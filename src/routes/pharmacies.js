const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
// const Pharmacy = require('../models/Pharmacy'); // Optional - comment out if not needed
const { authenticateToken } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Get all pharmacies (public access for listing)
router.get('/', async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;
    
    const whereClause = {
      role: 'pharmacy'
    };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { owner: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const pharmacies = await User.findAll({
      where: whereClause,
      // include: [{
      //   model: Pharmacy,
      //   as: 'pharmacy',
      //   required: false
      // }],
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform the data to match expected format
    const transformedPharmacies = pharmacies.map(user => {
      return {
        id: user.id,
        name: user.pharmacyName || user.name, // Use pharmacyName field from your model
        owner: user.name, // Use name as owner
        email: user.email,
        phone: user.phone,
        license_number: user.license, // Use existing license field
        status: user.isActive ? 'active' : 'pending', // Map from isActive
        image_url: user.avatar, // Use existing avatar field
        description: user.address, // Use address as description for now
        pharmacy_location: user.location, // Use existing location field
        rating: user.rating || 5.0,
        total_orders: user.totalOrders || 0,
        is_verified: user.isVerified || false,
        online: user.online || false,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      };
    });

    res.json({
      success: true,
      pharmacies: transformedPharmacies,
      total: transformedPharmacies.length,
      message: 'تم جلب الصيدليات بنجاح'
    });
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الصيدليات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single pharmacy by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pharmacy = await User.findOne({
      where: { id, role: 'pharmacy' },
      // include: [{
      //   model: Pharmacy,
      //   as: 'pharmacy',
      //   required: false
      // }],
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'الصيدلية غير موجودة'
      });
    }

    const transformedPharmacy = {
      id: pharmacy.id,
      name: pharmacy.pharmacyName || pharmacy.name,
      owner: pharmacy.name,
      email: pharmacy.email,
      phone: pharmacy.phone,
      license_number: pharmacy.license,
      status: pharmacy.isActive ? 'active' : 'pending',
      image_url: pharmacy.avatar,
      description: pharmacy.address,
      pharmacy_location: pharmacy.location,
      rating: pharmacy.rating || 5.0,
      total_orders: pharmacy.totalOrders || 0,
      is_verified: pharmacy.isVerified || false,
      online: pharmacy.online || false,
      created_at: pharmacy.createdAt,
      updated_at: pharmacy.updatedAt
    };

    res.json({
      success: true,
      pharmacy: transformedPharmacy,
      message: 'تم جلب بيانات الصيدلية بنجاح'
    });
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات الصيدلية',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new pharmacy (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      name, owner, email, password, phone, license_number,
      status = 'pending', image_url, description, pharmacy_location,
      role = 'pharmacy'
    } = req.body;

    // Validation
    if (!name || !owner || !email || !password || !phone || !license_number) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول المطلوبة يجب ملؤها'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل'
      });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني غير صحيح'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      name: owner, // Use owner as the user name
      pharmacyName: name, // Store pharmacy name separately
      email,
      password: hashedPassword,
      phone,
      license: license_number, // Use existing license field
      address: description, // Store description in address field
      avatar: image_url || '', // Use avatar field for image
      location: pharmacy_location || { lat: 30.0444, lng: 31.2357 }, // Use existing location field
      role: 'pharmacy',
      online: false,
      totalOrders: 0,
      rating: 5.0,
      isVerified: status === 'active',
      isActive: status === 'active'
    });

    // Create pharmacy record (optional, for additional pharmacy-specific data)
    // Commented out since Pharmacy model might not exist
    // try {
    //   await Pharmacy.create({
    //     userId: newUser.id,
    //     name,
    //     owner,
    //     license_number,
    //     phone,
    //     image_url: image_url || '',
    //     description: description || '',
    //     pharmacy_location: pharmacy_location || null,
    //     status,
    //     rating: 5.0,
    //     total_orders: 0,
    //     is_verified: status === 'active'
    //   });
    // } catch (pharmacyError) {
    //   console.log('Pharmacy table creation skipped:', pharmacyError.message);
    // }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الصيدلية بنجاح',
      pharmacy: {
        id: newUser.id,
        name: newUser.pharmacyName,
        owner: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        license_number: newUser.license,
        status: newUser.isActive ? 'active' : 'pending'
      }
    });
  } catch (error) {
    console.error('Error creating pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء الصيدلية',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update pharmacy (admin or pharmacy owner)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, owner, email, phone, license_number,
      status, image_url, description, pharmacy_location
    } = req.body;

    const pharmacy = await User.findOne({
      where: { id, role: 'pharmacy' }
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'الصيدلية غير موجودة'
      });
    }

    // Check permissions (admin or pharmacy owner)
    if (req.user.role !== 'admin' && req.user.id !== pharmacy.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح لك بتعديل هذه الصيدلية'
      });
    }

    // Validation for email if provided
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني غير صحيح'
      });
    }

    // Check if new email is already taken by another user
    if (email && email !== pharmacy.email) {
      const existingUser = await User.findOne({ 
        where: { 
          email, 
          id: { [Op.ne]: id } 
        } 
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني مستخدم بالفعل'
        });
      }
    }

    // Update fields - map to your existing User model fields
    const updateData = {};
    if (name !== undefined) updateData.pharmacyName = name;
    if (owner !== undefined) updateData.name = owner;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (license_number !== undefined) updateData.license = license_number;
    if (status !== undefined) {
      updateData.isActive = status === 'active';
      updateData.isVerified = status === 'active';
    }
    if (image_url !== undefined) updateData.avatar = image_url;
    if (description !== undefined) updateData.address = description;
    if (pharmacy_location !== undefined) updateData.location = pharmacy_location;

    await pharmacy.update(updateData);

    // Also update pharmacy table if it exists
    // Commented out since Pharmacy model might not exist
    // try {
    //   const pharmacyRecord = await Pharmacy.findOne({ where: { userId: id } });
    //   if (pharmacyRecord) {
    //     await pharmacyRecord.update(updateData);
    //   }
    // } catch (pharmacyUpdateError) {
    //   console.log('Pharmacy table update skipped:', pharmacyUpdateError.message);
    // }

    res.json({
      success: true,
      message: 'تم تحديث بيانات الصيدلية بنجاح',
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.pharmacyName || pharmacy.name,
        owner: pharmacy.name,
        email: pharmacy.email,
        phone: pharmacy.phone,
        license_number: pharmacy.license,
        status: pharmacy.isActive ? 'active' : 'pending'
      }
    });
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث بيانات الصيدلية',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update pharmacy status (admin only)
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'pending', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة'
      });
    }

    const pharmacy = await User.findOne({
      where: { id, role: 'pharmacy' }
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'الصيدلية غير موجودة'
      });
    }

    await pharmacy.update({ 
      isActive: status === 'active',
      isVerified: status === 'active'
    });

    // Also update pharmacy table if it exists
    // Commented out since Pharmacy model might not exist
    // try {
    //   const pharmacyRecord = await Pharmacy.findOne({ where: { userId: id } });
    //   if (pharmacyRecord) {
    //     await pharmacyRecord.update({ 
    //       status,
    //       is_verified: status === 'active'
    //     });
    //   }
    // } catch (pharmacyUpdateError) {
    //   console.log('Pharmacy table status update skipped:', pharmacyUpdateError.message);
    // }

    res.json({
      success: true,
      message: 'تم تحديث حالة الصيدلية بنجاح',
      pharmacy: {
        id: pharmacy.id,
        status: pharmacy.isActive ? 'active' : 'pending'
      }
    });
  } catch (error) {
    console.error('Error updating pharmacy status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة الصيدلية',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete pharmacy (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const pharmacy = await User.findOne({
      where: { id, role: 'pharmacy' }
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'الصيدلية غير موجودة'
      });
    }

    // Delete pharmacy record first (if exists)
    // Commented out since Pharmacy model might not exist
    // try {
    //   await Pharmacy.destroy({ where: { userId: id } });
    // } catch (pharmacyDeleteError) {
    //   console.log('Pharmacy table delete skipped:', pharmacyDeleteError.message);
    // }

    // Delete user
    await pharmacy.destroy();

    res.json({
      success: true,
      message: 'تم حذف الصيدلية بنجاح'
    });
  } catch (error) {
    console.error('Error deleting pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الصيدلية',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get pharmacy statistics (admin only)
router.get('/stats/overview', adminAuth, async (req, res) => {
  try {
    const totalPharmacies = await User.count({
      where: { role: 'pharmacy' }
    });

    const activePharmacies = await User.count({
      where: { role: 'pharmacy', isActive: true }
    });

    const pendingPharmacies = await User.count({
      where: { role: 'pharmacy', isActive: false }
    });

    const verifiedPharmacies = await User.count({
      where: { role: 'pharmacy', isVerified: true }
    });

    const onlinePharmacies = await User.count({
      where: { role: 'pharmacy', online: true }
    });

    res.json({
      success: true,
      stats: {
        total: totalPharmacies,
        active: activePharmacies,
        pending: pendingPharmacies,
        verified: verifiedPharmacies,
        online: onlinePharmacies
      },
      message: 'تم جلب إحصائيات الصيدليات بنجاح'
    });
  } catch (error) {
    console.error('Error fetching pharmacy stats:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب إحصائيات الصيدليات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;