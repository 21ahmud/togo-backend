const express = require('express');
const { body, validationResult, query, param } = require('express-validator');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateMenuItem = [
  body('name').trim().notEmpty().withMessage('اسم العنصر مطلوب'),
  body('price').isFloat({ min: 0 }).withMessage('السعر يجب أن يكون رقم موجب'),
  body('restaurant_email').isEmail().withMessage('بريد المطعم غير صحيح'),
  body('category').isIn(['Main', 'Starter', 'Dessert', 'Drinks']).withMessage('فئة غير صحيحة'),
];

// Get all menu items (public endpoint for home page)
router.get('/', async (req, res) => {
  try {
    const { restaurant_email, restaurant_id, category, available } = req.query;
    
    console.log('Menu items request with query:', req.query);
    
    let whereClause = {};
    
    if (restaurant_email) {
      whereClause.restaurant_email = restaurant_email;
    }
    
    if (restaurant_id) {
      whereClause.restaurant_id = restaurant_id;
    }
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    if (available !== undefined) {
      whereClause.available = available === 'true';
    }

    const menuItems = await MenuItem.findAll({
      where: whereClause,
      order: [
        ['is_popular', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    console.log(`Found ${menuItems.length} menu items`);

    res.json({
      success: true,
      menuItems,
      count: menuItems.length
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحميل عناصر القائمة',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get menu item by ID
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('معرف العنصر غير صحيح')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود'
      });
    }

    res.json({
      success: true,
      menuItem
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحميل العنصر',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new menu item (requires authentication)
router.post('/', validateMenuItem, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      price,
      original_price,
      discount_percentage,
      has_discount,
      category,
      image_url,
      prep_time,
      is_popular,
      available,
      restaurant_email
    } = req.body;

    console.log('Creating menu item with data:', {
      name,
      price,
      restaurant_email,
      has_discount,
      discount_percentage,
      category
    });

    // Verify restaurant exists
    const restaurant = await User.findOne({
      where: {
        email: restaurant_email,
        role: 'restaurant'
      }
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }

    // Calculate prices
    let finalPrice = parseFloat(price);
    let finalOriginalPrice = original_price ? parseFloat(original_price) : finalPrice;
    let finalDiscountPercentage = 0;
    let finalHasDiscount = false;

    if (has_discount && discount_percentage && discount_percentage > 0) {
      finalDiscountPercentage = parseFloat(discount_percentage);
      finalHasDiscount = true;
      
      // If original price not provided, calculate it from discounted price
      if (!original_price) {
        finalOriginalPrice = finalPrice;
        finalPrice = finalPrice * (1 - finalDiscountPercentage / 100);
      }
    }

    const menuItem = await MenuItem.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      price: finalPrice,
      original_price: finalOriginalPrice,
      discount_percentage: finalDiscountPercentage,
      has_discount: finalHasDiscount,
      category,
      image_url: image_url || null,
      prep_time: prep_time ? parseInt(prep_time) : null,
      is_popular: Boolean(is_popular),
      available: available !== undefined ? Boolean(available) : true,
      restaurant_email,
      restaurant_id: restaurant.id
    });

    console.log('Menu item created successfully:', menuItem.id);

    res.status(201).json({
      success: true,
      message: 'تم إضافة العنصر بنجاح',
      menuItem
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    
    // Handle unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'عنصر بهذا الاسم موجود بالفعل في قائمة هذا المطعم'
      });
    }
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: error.errors.map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'فشل في إضافة العنصر',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update menu item
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('معرف العنصر غير صحيح'),
  ...validateMenuItem
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود'
      });
    }

    const {
      name,
      description,
      price,
      original_price,
      discount_percentage,
      has_discount,
      category,
      image_url,
      prep_time,
      is_popular,
      available,
      restaurant_email
    } = req.body;

    console.log('Updating menu item:', req.params.id, 'with data:', {
      name,
      price,
      has_discount,
      discount_percentage
    });

    // Calculate prices
    let finalPrice = parseFloat(price);
    let finalOriginalPrice = original_price ? parseFloat(original_price) : finalPrice;
    let finalDiscountPercentage = 0;
    let finalHasDiscount = false;

    if (has_discount && discount_percentage && discount_percentage > 0) {
      finalDiscountPercentage = parseFloat(discount_percentage);
      finalHasDiscount = true;
      
      if (!original_price) {
        finalOriginalPrice = finalPrice;
        finalPrice = finalPrice * (1 - finalDiscountPercentage / 100);
      }
    }

    await menuItem.update({
      name: name.trim(),
      description: description ? description.trim() : null,
      price: finalPrice,
      original_price: finalOriginalPrice,
      discount_percentage: finalDiscountPercentage,
      has_discount: finalHasDiscount,
      category,
      image_url: image_url || menuItem.image_url,
      prep_time: prep_time ? parseInt(prep_time) : null,
      is_popular: Boolean(is_popular),
      available: available !== undefined ? Boolean(available) : true,
      restaurant_email
    });

    console.log('Menu item updated successfully:', menuItem.id);

    res.json({
      success: true,
      message: 'تم تحديث العنصر بنجاح',
      menuItem
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: error.errors.map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'فشل في تحديث العنصر',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update menu item status (availability)
router.patch('/:id', [
  param('id').isInt({ min: 1 }).withMessage('معرف العنصر غير صحيح')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود'
      });
    }

    const updateData = {};
    
    if (req.body.available !== undefined) {
      updateData.available = Boolean(req.body.available);
    }
    
    if (req.body.is_popular !== undefined) {
      updateData.is_popular = Boolean(req.body.is_popular);
    }

    console.log('Updating menu item status:', req.params.id, updateData);

    await menuItem.update(updateData);

    res.json({
      success: true,
      message: 'تم تحديث حالة العنصر بنجاح',
      menuItem
    });
  } catch (error) {
    console.error('Error updating menu item status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة العنصر',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete menu item
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('معرف العنصر غير صحيح')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const menuItem = await MenuItem.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود'
      });
    }

    await menuItem.destroy();

    console.log('Menu item deleted successfully:', req.params.id);

    res.json({
      success: true,
      message: 'تم حذف العنصر بنجاح'
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف العنصر',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get menu items by restaurant (alternative endpoint)
router.get('/restaurant/:restaurantId', [
  param('restaurantId').isInt({ min: 1 }).withMessage('معرف المطعم غير صحيح')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const { category, available } = req.query;
    
    let whereClause = {
      restaurant_id: req.params.restaurantId
    };
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    if (available !== undefined) {
      whereClause.available = available === 'true';
    }

    const menuItems = await MenuItem.findAll({
      where: whereClause,
      order: [
        ['is_popular', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    console.log(`Found ${menuItems.length} menu items for restaurant ${req.params.restaurantId}`);

    res.json({
      success: true,
      menuItems,
      count: menuItems.length
    });
  } catch (error) {
    console.error('Error fetching restaurant menu items:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحميل عناصر قائمة المطعم',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Bulk update menu items availability
router.patch('/bulk/availability', [
  body('menuItemIds').isArray().withMessage('قائمة معرفات العناصر مطلوبة'),
  body('menuItemIds.*').isInt({ min: 1 }).withMessage('معرف العنصر غير صحيح'),
  body('available').isBoolean().withMessage('حالة التوفر يجب أن تكون true أو false')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const { menuItemIds, available } = req.body;

    const [updatedCount] = await MenuItem.update(
      { available: Boolean(available) },
      {
        where: {
          id: menuItemIds
        }
      }
    );

    console.log(`Bulk updated ${updatedCount} menu items availability to ${available}`);

    res.json({
      success: true,
      message: `تم تحديث حالة ${updatedCount} عنصر بنجاح`,
      updatedCount
    });
  } catch (error) {
    console.error('Error bulk updating menu items:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في التحديث المجمع',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get menu statistics for a restaurant
router.get('/stats/:restaurantEmail', async (req, res) => {
  try {
    const { restaurantEmail } = req.params;

    const totalItems = await MenuItem.count({
      where: { restaurant_email: restaurantEmail }
    });

    const availableItems = await MenuItem.count({
      where: { 
        restaurant_email: restaurantEmail,
        available: true 
      }
    });

    const popularItems = await MenuItem.count({
      where: { 
        restaurant_email: restaurantEmail,
        is_popular: true 
      }
    });

    const discountedItems = await MenuItem.count({
      where: { 
        restaurant_email: restaurantEmail,
        has_discount: true 
      }
    });

    const categoryStats = await MenuItem.findAll({
      where: { restaurant_email: restaurantEmail },
      attributes: [
        'category',
        [MenuItem.sequelize.fn('COUNT', MenuItem.sequelize.col('category')), 'count']
      ],
      group: ['category']
    });

    res.json({
      success: true,
      stats: {
        total: totalItems,
        available: availableItems,
        popular: popularItems,
        discounted: discountedItems,
        categories: categoryStats.map(stat => ({
          category: stat.category,
          count: parseInt(stat.dataValues.count)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching menu statistics:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحميل إحصائيات القائمة',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;