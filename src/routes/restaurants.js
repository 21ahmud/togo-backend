const express = require('express');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Import models - adjust paths based on your project structure
let Restaurant, User;
try {
  Restaurant = require('../models/Restaurant');
  User = require('../models/User');
  console.log('Models imported successfully');
} catch (error) {
  console.error('Model import error:', error);
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Restaurant routes working' });
});

// Debug endpoint
router.get('/debug', async (req, res) => {
  try {
    console.log('=== RESTAURANT DEBUG ===');
    
    // Check Restaurant model
    let restaurantsFromRestaurantTable = [];
    let restaurantModelError = null;
    try {
      if (Restaurant) {
        console.log('Restaurant model available');
        restaurantsFromRestaurantTable = await Restaurant.findAll();
        console.log(`Found ${restaurantsFromRestaurantTable.length} restaurants in Restaurant table`);
        console.log('Restaurant table data:', restaurantsFromRestaurantTable.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          status: r.status,
          cuisine_type: r.cuisine_type
        })));
      } else {
        console.log('Restaurant model not available');
      }
    } catch (error) {
      restaurantModelError = error.message;
      console.error('Restaurant model error:', error);
    }

    // Check User model for restaurant users
    let restaurantUsersFromUserTable = [];
    let userModelError = null;
    try {
      if (User) {
        console.log('User model available');
        restaurantUsersFromUserTable = await User.findAll({
          where: { role: 'restaurant' }
        });
        console.log(`Found ${restaurantUsersFromUserTable.length} restaurant users in User table`);
        console.log('User table restaurant data:', restaurantUsersFromUserTable.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isVerified: u.isVerified,
          cuisine_type: u.cuisine_type
        })));
      } else {
        console.log('User model not available');
      }
    } catch (error) {
      userModelError = error.message;
      console.error('User model error:', error);
    }

    // Check all users to see what's there
    let allUsers = [];
    try {
      if (User) {
        allUsers = await User.findAll();
        console.log(`Total users in database: ${allUsers.length}`);
        console.log('All users:', allUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isVerified: u.isVerified
        })));
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
    }

    console.log('=== END DEBUG ===');

    res.json({
      success: true,
      debug: {
        restaurantModel: {
          available: !!Restaurant,
          error: restaurantModelError,
          count: restaurantsFromRestaurantTable.length,
          data: restaurantsFromRestaurantTable
        },
        userModel: {
          available: !!User,
          error: userModelError,
          count: restaurantUsersFromUserTable.length,
          restaurantUsers: restaurantUsersFromUserTable,
          allUsersCount: allUsers.length,
          allUsers: allUsers
        }
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
});

// GET all restaurants (public)
router.get('/', async (req, res) => {
  try {
    console.log('=== GET RESTAURANTS CALLED ===');
    console.log('Query params:', req.query);
    
    const { page = 1, limit = 50, search, status, cuisine_type } = req.query;
    const offset = (page - 1) * limit;

    let allRestaurants = [];

    // Strategy 1: Try Restaurant table first
    if (Restaurant) {
      try {
        console.log('Querying Restaurant table...');
        
        let whereClause = {};
        
        if (search) {
          whereClause[Op.or] = [
            { name: { [Op.iLike]: `%${search}%` } },
            { owner: { [Op.iLike]: `%${search}%` } },
            { cuisine_type: { [Op.iLike]: `%${search}%` } }
          ];
        }

        if (status) {
          whereClause.status = status;
        }

        if (cuisine_type) {
          whereClause.cuisine_type = cuisine_type;
        }

        const restaurantResults = await Restaurant.findAll({
          where: whereClause,
          order: [['createdAt', 'DESC']],
          limit: Math.min(parseInt(limit), 100),
          offset: parseInt(offset)
        });
        
        console.log(`Restaurant table query result: ${restaurantResults.length} restaurants found`);
        allRestaurants = [...restaurantResults];
      } catch (restaurantError) {
        console.error('Restaurant table query error:', restaurantError);
      }
    } else {
      console.log('Restaurant model not available');
    }

    // Strategy 2: Also get from User table (restaurant role)
    if (User) {
      try {
        console.log('Querying User table for restaurant users...');
        
        let userWhereClause = { role: 'restaurant' };
        
        if (search) {
          userWhereClause[Op.or] = [
            { name: { [Op.iLike]: `%${search}%` } },
            { cuisine_type: { [Op.iLike]: `%${search}%` } }
          ];
        }

        if (status === 'active') {
          userWhereClause.isVerified = true;
        } else if (status === 'pending') {
          userWhereClause.isVerified = false;
        }

        if (cuisine_type) {
          userWhereClause.cuisine_type = cuisine_type;
        }

        const restaurantUsers = await User.findAll({
          where: userWhereClause,
          order: [['createdAt', 'DESC']],
          limit: Math.min(parseInt(limit), 100),
          offset: parseInt(offset)
        });
        
        console.log(`User table query result: ${restaurantUsers.length} restaurant users found`);
        
        // Convert user records to restaurant format
        const userRestaurants = restaurantUsers.map(user => ({
          id: user.id,
          name: user.name || 'غير محدد',
          owner: user.name || 'غير محدد',
          email: user.email,
          phone: user.phone || 'غير محدد',
          license_number: user.license || user.license_number || 'غير محدد',
          status: user.isVerified ? 'active' : 'pending',
          image_url: user.image_url || '',
          description: user.description || '',
          restaurant_location: user.location || null,
          cuisine_type: user.cuisine_type || 'غير محدد',
          delivery_fee: user.delivery_fee || 0,
          rating: user.rating || 5.0,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        }));

        // Merge with existing restaurants, avoiding duplicates by email
        userRestaurants.forEach(userRestaurant => {
          const existing = allRestaurants.find(r => r.email === userRestaurant.email);
          if (!existing) {
            allRestaurants.push(userRestaurant);
          }
        });
        
      } catch (userError) {
        console.error('User table query error:', userError);
      }
    } else {
      console.log('User model not available');
    }

    console.log(`Final result: ${allRestaurants.length} restaurants to return`);
    
    if (allRestaurants.length > 0) {
      console.log('Sample restaurant data:', {
        id: allRestaurants[0].id,
        name: allRestaurants[0].name,
        email: allRestaurants[0].email,
        status: allRestaurants[0].status,
        cuisine_type: allRestaurants[0].cuisine_type
      });
    }

    res.json({
      success: true,
      restaurants: allRestaurants,
      pagination: {
        total: allRestaurants.length,
        pages: Math.ceil(allRestaurants.length / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب المطاعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET single restaurant by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'معرف المطعم غير صحيح'
      });
    }

    let restaurant = null;

    // Try Restaurant table first
    if (Restaurant) {
      try {
        restaurant = await Restaurant.findByPk(id);
      } catch (error) {
        console.log('Restaurant table lookup failed:', error.message);
      }
    }

    // If not found in Restaurant table, try User table
    if (!restaurant && User) {
      try {
        const user = await User.findOne({
          where: { 
            id: id,
            role: 'restaurant'
          }
        });
        
        if (user) {
          restaurant = {
            id: user.id,
            name: user.name || 'غير محدد',
            owner: user.name || 'غير محدد',
            email: user.email,
            phone: user.phone || 'غير محدد',
            license_number: user.license || user.license_number || 'غير محدد',
            status: user.isVerified ? 'active' : 'pending',
            image_url: user.image_url || '',
            description: user.description || '',
            restaurant_location: user.location || null,
            cuisine_type: user.cuisine_type || 'غير محدد',
            delivery_fee: user.delivery_fee || 0,
            rating: user.rating || 5.0,
            created_at: user.createdAt,
            updated_at: user.updatedAt
          };
        }
      } catch (error) {
        console.log('User table lookup failed:', error.message);
      }
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }

    res.json({
      success: true,
      restaurant
    });

  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات المطعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST create restaurant (admin only)
router.post('/', auth, requireAdmin, async (req, res) => {
  const transaction = await (Restaurant?.sequelize || User?.sequelize)?.transaction();
  
  try {
    console.log('Creating restaurant with data:', req.body);

    const {
      name, owner, email, password, phone, license_number,
      status, image_url, description, restaurant_location,
      cuisine_type, delivery_fee
    } = req.body;

    // Validate required fields
    const requiredFields = {
      name: name?.trim(),
      owner: owner?.trim(), 
      email: email?.trim(),
      password: password?.trim(),
      phone: phone?.trim(),
      license_number: license_number?.trim(),
      cuisine_type: cuisine_type?.trim()
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `الحقول المطلوبة مفقودة: ${missingFields.join(', ')}`
      });
    }

    // Validate restaurant_location
    if (!restaurant_location || typeof restaurant_location !== 'object') {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'موقع المطعم مطلوب ويجب أن يكون كائن صحيح'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'الرجاء إدخال بريد إلكتروني صحيح'
      });
    }

    // Validate password length
    if (password.trim().length < 6) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل'
      });
    }

    // Check for existing restaurant with same email or license
    if (Restaurant) {
      const existingRestaurant = await Restaurant.findOne({
        where: {
          [Op.or]: [
            { email: email.toLowerCase().trim() },
            { license_number: license_number.trim() }
          ]
        },
        ...(transaction && { transaction })
      });

      if (existingRestaurant) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني أو رقم الترخيص مستخدم بالفعل'
        });
      }
    }

    // Create user account first if User model exists
    let user = null;
    if (User) {
      try {
        // Check if user with email already exists
        const existingUser = await User.findOne({
          where: { email: email.toLowerCase().trim() },
          ...(transaction && { transaction })
        });

        if (existingUser) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'مستخدم بهذا البريد الإلكتروني موجود بالفعل'
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password.trim(), 10);

        const userData = {
          name: owner.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          password: hashedPassword,
          role: 'restaurant',
          isVerified: status === 'active',
          isActive: true,
          license: license_number.trim(),
          cuisine_type: cuisine_type.trim(),
          delivery_fee: parseFloat(delivery_fee) || 0,
          location: restaurant_location,
          image_url: image_url || null,
          description: description || null,
          rating: 5.0
        };

        user = await User.create(userData, { ...(transaction && { transaction }) });
        console.log('User created successfully:', user.id);
      } catch (userError) {
        console.error('User creation error:', userError);
        if (transaction) await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: 'فشل في إنشاء حساب المستخدم'
        });
      }
    }

    // Create restaurant
    let restaurant = null;
    if (Restaurant) {
      try {
        const restaurantData = {
          name: name.trim(),
          owner: owner.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          license_number: license_number.trim(),
          status: status || 'pending',
          image_url: image_url || null,
          description: description || null,
          restaurant_location: restaurant_location,
          cuisine_type: cuisine_type.trim(),
          delivery_fee: parseFloat(delivery_fee) || 0,
          rating: 5.0,
          user_id: user ? user.id : null
        };

        console.log('Creating restaurant with data:', restaurantData);

        restaurant = await Restaurant.create(restaurantData, { ...(transaction && { transaction }) });
        
        console.log('Restaurant created successfully:', restaurant.id);
      } catch (restaurantError) {
        console.error('Restaurant creation error:', restaurantError);
        // Continue without restaurant record if user was created
        if (!user) {
          if (transaction) await transaction.rollback();
          return res.status(500).json({
            success: false,
            message: 'فشل في إنشاء المطعم'
          });
        }
      }
    }
    
    if (transaction) await transaction.commit();
    
    // Return response without sensitive data
    const responseData = restaurant ? restaurant.toJSON() : {
      id: user.id,
      name: user.name,
      owner: user.name,
      email: user.email,
      phone: user.phone,
      license_number: user.license,
      status: user.isVerified ? 'active' : 'pending',
      image_url: user.image_url,
      description: user.description,
      restaurant_location: user.location,
      cuisine_type: user.cuisine_type,
      delivery_fee: user.delivery_fee,
      rating: user.rating
    };
    
    if (responseData.user_id) delete responseData.user_id;

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المطعم بنجاح',
      restaurant: responseData,
      id: restaurant ? restaurant.id : user.id
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Create restaurant error:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني أو رقم الترخيص مستخدم بالفعل'
      });
    }

    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => `${err.path}: ${err.message}`);
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: `خطأ في التحقق من البيانات: ${validationErrors.join(', ')}`
      });
    }

    if (error.name === 'SequelizeDatabaseError') {
      console.log('Database error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'خطأ في قاعدة البيانات'
      });
    }

    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء المطعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT update restaurant (admin only)
router.put('/:id', auth, requireAdmin, async (req, res) => {
  const transaction = await (Restaurant?.sequelize || User?.sequelize)?.transaction();
  
  try {
    const { id } = req.params;
    const {
      name, owner, email, phone, license_number,
      status, image_url, description, restaurant_location,
      cuisine_type, delivery_fee
    } = req.body;

    if (!id || isNaN(id)) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'معرف المطعم غير صحيح'
      });
    }

    let restaurant = null;
    let user = null;

    // Find restaurant and associated user
    if (Restaurant) {
      restaurant = await Restaurant.findByPk(id, { ...(transaction && { transaction }) });
      if (restaurant && restaurant.user_id) {
        user = await User.findByPk(restaurant.user_id, { ...(transaction && { transaction }) });
      }
    }
    
    if (!restaurant && User) {
      user = await User.findOne({
        where: { 
          id: id,
          role: 'restaurant'
        },
        ...(transaction && { transaction })
      });
    }

    if (!restaurant && !user) {
      if (transaction) await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'الرجاء إدخال بريد إلكتروني صحيح'
      });
    }

    // Check for conflicts with other restaurants
    if (email || license_number) {
      const conflictWhere = {
        id: { [Op.ne]: id }
      };
      
      if (email && license_number) {
        conflictWhere[Op.or] = [
          { email: email.toLowerCase().trim() },
          { license_number: license_number.trim() }
        ];
      } else if (email) {
        conflictWhere.email = email.toLowerCase().trim();
      } else if (license_number) {
        conflictWhere.license_number = license_number.trim();
      }

      if (Restaurant) {
        const existingRestaurant = await Restaurant.findOne({ 
          where: conflictWhere,
          ...(transaction && { transaction })
        });
        
        if (existingRestaurant) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'البريد الإلكتروني أو رقم الترخيص مستخدم بالفعل'
          });
        }
      }

      // Also check User table for email conflicts
      if (email && User) {
        const existingUser = await User.findOne({
          where: {
            email: email.toLowerCase().trim(),
            id: { [Op.ne]: id }
          },
          ...(transaction && { transaction })
        });

        if (existingUser) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'البريد الإلكتروني مستخدم بالفعل'
          });
        }
      }
    }

    // Update restaurant record if exists
    if (restaurant) {
      const restaurantUpdateData = {};
      if (name !== undefined) restaurantUpdateData.name = name.trim();
      if (owner !== undefined) restaurantUpdateData.owner = owner.trim();
      if (email !== undefined) restaurantUpdateData.email = email.toLowerCase().trim();
      if (phone !== undefined) restaurantUpdateData.phone = phone.trim();
      if (license_number !== undefined) restaurantUpdateData.license_number = license_number.trim();
      if (status !== undefined) restaurantUpdateData.status = status;
      if (image_url !== undefined) restaurantUpdateData.image_url = image_url;
      if (description !== undefined) restaurantUpdateData.description = description;
      if (restaurant_location !== undefined) restaurantUpdateData.restaurant_location = restaurant_location;
      if (cuisine_type !== undefined) restaurantUpdateData.cuisine_type = cuisine_type.trim();
      if (delivery_fee !== undefined) restaurantUpdateData.delivery_fee = parseFloat(delivery_fee) || 0;

      await restaurant.update(restaurantUpdateData, { ...(transaction && { transaction }) });
    }

    // Update user record if exists
    if (user) {
      const userUpdateData = {};
      if (owner !== undefined) userUpdateData.name = owner.trim();
      if (email !== undefined) userUpdateData.email = email.toLowerCase().trim();
      if (phone !== undefined) userUpdateData.phone = phone.trim();
      if (license_number !== undefined) userUpdateData.license = license_number.trim();
      if (status !== undefined) userUpdateData.isVerified = status === 'active';
      if (image_url !== undefined) userUpdateData.image_url = image_url;
      if (description !== undefined) userUpdateData.description = description;
      if (restaurant_location !== undefined) userUpdateData.location = restaurant_location;
      if (cuisine_type !== undefined) userUpdateData.cuisine_type = cuisine_type.trim();
      if (delivery_fee !== undefined) userUpdateData.delivery_fee = parseFloat(delivery_fee) || 0;

      await user.update(userUpdateData, { ...(transaction && { transaction }) });
    }

    if (transaction) await transaction.commit();

    // Fetch updated restaurant
    let updatedRestaurant = null;
    if (restaurant) {
      updatedRestaurant = await Restaurant.findByPk(id);
    } else if (user) {
      const updatedUser = await User.findByPk(id);
      updatedRestaurant = {
        id: updatedUser.id,
        name: updatedUser.name,
        owner: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        license_number: updatedUser.license,
        status: updatedUser.isVerified ? 'active' : 'pending',
        image_url: updatedUser.image_url,
        description: updatedUser.description,
        restaurant_location: updatedUser.location,
        cuisine_type: updatedUser.cuisine_type,
        delivery_fee: updatedUser.delivery_fee,
        rating: updatedUser.rating
      };
    }

    res.json({
      success: true,
      message: 'تم تحديث بيانات المطعم بنجاح',
      restaurant: updatedRestaurant,
      id: id
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Update restaurant error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => `${err.path}: ${err.message}`);
      return res.status(400).json({
        success: false,
        message: `خطأ في التحقق من البيانات: ${validationErrors.join(', ')}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'فشل في تحديث المطعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PATCH update restaurant status (admin only)
router.patch('/:id/status', auth, requireAdmin, async (req, res) => {
  const transaction = await (Restaurant?.sequelize || User?.sequelize)?.transaction();
  
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || isNaN(id)) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'معرف المطعم غير صحيح'
      });
    }

    if (!['active', 'pending', 'suspended'].includes(status)) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة. الحالات المسموحة: active, pending, suspended'
      });
    }

    let restaurant = null;
    let user = null;

    // Find restaurant and user
    if (Restaurant) {
      restaurant = await Restaurant.findByPk(id, { ...(transaction && { transaction }) });
      if (restaurant && restaurant.user_id) {
        user = await User.findByPk(restaurant.user_id, { ...(transaction && { transaction }) });
      }
    }
    
    if (!restaurant && User) {
      user = await User.findOne({
        where: { 
          id: id,
          role: 'restaurant'
        },
        ...(transaction && { transaction })
      });
    }

    if (!restaurant && !user) {
      if (transaction) await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }

    // Update restaurant status
    if (restaurant) {
      await restaurant.update({ status }, { ...(transaction && { transaction }) });
    }

    // Update user verification status
    if (user) {
      await user.update(
        { 
          isVerified: status === 'active',
          isActive: status !== 'suspended'
        },
        { ...(transaction && { transaction }) }
      );
    }

    if (transaction) await transaction.commit();

    res.json({
      success: true,
      message: 'تم تحديث حالة المطعم بنجاح',
      restaurant: {
        id: id,
        status: status
      }
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Update restaurant status error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة المطعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE restaurant (admin only)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  const transaction = await (Restaurant?.sequelize || User?.sequelize)?.transaction();
  
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'معرف المطعم غير صحيح'
      });
    }

    let restaurant = null;
    let user = null;
    let restaurantName = 'Unknown';

    // Find restaurant and user
    if (Restaurant) {
      restaurant = await Restaurant.findByPk(id, { ...(transaction && { transaction }) });
      if (restaurant) {
        restaurantName = restaurant.name;
        if (restaurant.user_id) {
          user = await User.findByPk(restaurant.user_id, { ...(transaction && { transaction }) });
        }
      }
    }
    
    if (!restaurant && User) {
      user = await User.findOne({
        where: { 
          id: id,
          role: 'restaurant'
        },
        ...(transaction && { transaction })
      });
      if (user) {
        restaurantName = user.name;
      }
    }

    if (!restaurant && !user) {
      if (transaction) await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }

    // Delete restaurant record
    if (restaurant) {
      await restaurant.destroy({ ...(transaction && { transaction }) });
    }

    // Delete associated user
    if (user) {
      await user.destroy({ ...(transaction && { transaction }) });
    }

    if (transaction) await transaction.commit();

    res.json({
      success: true,
      message: `تم حذف المطعم "${restaurantName}" بنجاح`
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Delete restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف المطعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET restaurant statistics (admin only)
router.get('/admin/stats', auth, requireAdmin, async (req, res) => {
  try {
    let totalRestaurants = 0;
    let activeRestaurants = 0;
    let pendingRestaurants = 0;
    let suspendedRestaurants = 0;
    let cuisineStats = [];

    // Get stats from Restaurant table if available
    if (Restaurant) {
      try {
        totalRestaurants = await Restaurant.count();
        activeRestaurants = await Restaurant.count({ where: { status: 'active' } });
        pendingRestaurants = await Restaurant.count({ where: { status: 'pending' } });
        suspendedRestaurants = await Restaurant.count({ where: { status: 'suspended' } });

        cuisineStats = await Restaurant.findAll({
          attributes: [
            'cuisine_type',
            [Restaurant.sequelize.fn('COUNT', Restaurant.sequelize.col('id')), 'count']
          ],
          group: ['cuisine_type'],
          order: [[Restaurant.sequelize.fn('COUNT', Restaurant.sequelize.col('id')), 'DESC']]
        });
      } catch (restaurantError) {
        console.log('Restaurant stats error, trying User table:', restaurantError.message);
      }
    }

    // Fallback to User table stats if Restaurant table unavailable or empty
    if ((totalRestaurants === 0) && User) {
      try {
        totalRestaurants = await User.count({ where: { role: 'restaurant' } });
        activeRestaurants = await User.count({ where: { role: 'restaurant', isVerified: true } });
        pendingRestaurants = await User.count({ where: { role: 'restaurant', isVerified: false } });
        suspendedRestaurants = await User.count({ where: { role: 'restaurant', isActive: false } });

        const userCuisineStats = await User.findAll({
          attributes: [
            'cuisine_type',
            [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
          ],
          where: { role: 'restaurant' },
          group: ['cuisine_type'],
          order: [[User.sequelize.fn('COUNT', User.sequelize.col('id')), 'DESC']]
        });

        cuisineStats = userCuisineStats;
      } catch (userError) {
        console.log('User stats error:', userError.message);
      }
    }

    res.json({
      success: true,
      stats: {
        total: totalRestaurants,
        active: activeRestaurants,
        pending: pendingRestaurants,
        suspended: suspendedRestaurants,
        cuisineDistribution: cuisineStats.map(stat => ({
          cuisine_type: stat.cuisine_type || stat.dataValues?.cuisine_type,
          count: parseInt(stat.dataValues?.count || stat.count || 0)
        }))
      }
    });

  } catch (error) {
    console.error('Get restaurant stats error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب إحصائيات المطاعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;