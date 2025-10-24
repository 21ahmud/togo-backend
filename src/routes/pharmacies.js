const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Helper function to parse location data
const parseLocation = (locationData) => {
  if (!locationData) return null;
  
  // If it's already an object, return it
  if (typeof locationData === 'object' && locationData.lat && locationData.lng) {
    return locationData;
  }
  
  // If it's a string, try to parse it
  if (typeof locationData === 'string') {
    try {
      const parsed = JSON.parse(locationData);
      if (parsed && parsed.lat && parsed.lng) {
        return parsed;
      }
    } catch (e) {
      console.log('Failed to parse location:', e.message);
    }
  }
  
  return null;
};

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
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform the data to match expected format
    const transformedPharmacies = pharmacies.map(user => {
      // Parse the location data properly
      const locationData = parseLocation(user.location);
      
      return {
        id: user.id,
        name: user.pharmacyName || user.name,
        owner: user.name,
        email: user.email,
        phone: user.phone,
        license_number: user.license,
        status: user.isActive ? 'active' : 'pending',
        image_url: user.avatar || user.image_url || '',
        description: user.address || user.description || '',
        pharmacy_location: locationData, // Properly mapped location
        rating: user.rating || 5.0,
        delivery_time: user.delivery_time || '20-30 دقيقة',
        delivery_fee: user.delivery_fee || 25,
        total_orders: user.totalOrders || 0,
        is_verified: user.isVerified || false,
        online: user.online || false,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      };
    });

    console.log('Transformed pharmacies with locations:', transformedPharmacies.map(p => ({
      name: p.name,
      hasLocation: !!p.pharmacy_location,
      location: p.pharmacy_location
    })));

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
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'الصيدلية غير موجودة'
      });
    }

    const locationData = parseLocation(pharmacy.location);

    const transformedPharmacy = {
      id: pharmacy.id,
      name: pharmacy.pharmacyName || pharmacy.name,
      owner: pharmacy.name,
      email: pharmacy.email,
      phone: pharmacy.phone,
      license_number: pharmacy.license,
      status: pharmacy.isActive ? 'active' : 'pending',
      image_url: pharmacy.avatar || pharmacy.image_url || '',
      description: pharmacy.address || pharmacy.description || '',
      pharmacy_location: locationData,
      rating: pharmacy.rating || 5.0,
      delivery_time: pharmacy.delivery_time || '20-30 دقيقة',
      delivery_fee: pharmacy.delivery_fee || 25,
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
      role = 'pharmacy', delivery_fee, delivery_time
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

    // Validate location
    if (!pharmacy_location || !pharmacy_location.lat || !pharmacy_location.lng) {
      return res.status(400).json({
        success: false,
        message: 'موقع الصيدلية مطلوب (يجب تحديد lat و lng)'
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

    // Create user with proper location storage
    const newUser = await User.create({
      name: owner,
      pharmacyName: name,
      email,
      password: hashedPassword,
      phone,
      license: license_number,
      address: description || '',
      avatar: image_url || '',
      location: pharmacy_location, // Store as JSON object
      delivery_fee: delivery_fee || 25,
      delivery_time: delivery_time || '20-30 دقيقة',
      role: 'pharmacy',
      online: false,
      totalOrders: 0,
      rating: 5.0,
      isVerified: status === 'active',
      isActive: status === 'active'
    });

    console.log('Created pharmacy with location:', {
      id: newUser.id,
      name: newUser.pharmacyName,
      location: newUser.location
    });

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
        pharmacy_location: parseLocation(newUser.location),
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
      status, image_url, description, pharmacy_location,
      delivery_fee, delivery_time
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

    // Update fields
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
    if (pharmacy_location !== undefined) {
      // Validate location format
      if (pharmacy_location && (!pharmacy_location.lat || !pharmacy_location.lng)) {
        return res.status(400).json({
          success: false,
          message: 'تنسيق الموقع غير صحيح (يجب أن يحتوي على lat و lng)'
        });
      }
      updateData.location = pharmacy_location;
    }
    if (delivery_fee !== undefined) updateData.delivery_fee = delivery_fee;
    if (delivery_time !== undefined) updateData.delivery_time = delivery_time;

    await pharmacy.update(updateData);

    console.log('Updated pharmacy with location:', {
      id: pharmacy.id,
      name: pharmacy.pharmacyName,
      location: pharmacy.location
    });

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
        pharmacy_location: parseLocation(pharmacy.location),
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

    // Count pharmacies with locations
    const pharmaciesWithLocation = await User.count({
      where: { 
        role: 'pharmacy',
        location: { [Op.ne]: null }
      }
    });

    res.json({
      success: true,
      stats: {
        total: totalPharmacies,
        active: activePharmacies,
        pending: pendingPharmacies,
        verified: verifiedPharmacies,
        online: onlinePharmacies,
        withLocation: pharmaciesWithLocation
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