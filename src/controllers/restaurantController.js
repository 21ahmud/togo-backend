const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

const getAllRestaurants = async (req, res) => {
  try {
    console.log('Fetching all restaurants...');
    
    // Try to get restaurants from both Restaurant table and Users table with restaurant role
    let allRestaurants = [];
    
    // First, get from Restaurant table
    try {
      const restaurants = await Restaurant.findAll({
        order: [['createdAt', 'DESC']]
      });
      console.log(`Found ${restaurants.length} restaurants from Restaurant table`);
      allRestaurants = [...restaurants];
    } catch (restaurantError) {
      console.error('Error fetching from Restaurant table:', restaurantError);
    }
    
    // Also get restaurant users from User table
    try {
      const restaurantUsers = await User.findAll({
        where: { role: 'restaurant' },
        order: [['createdAt', 'DESC']]
      });
      
      console.log(`Found ${restaurantUsers.length} restaurant users from User table`);
      
      // Convert user records to restaurant format for consistency
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
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        source: 'user' // Mark the source for debugging
      }));
      
      // Merge restaurants, avoiding duplicates by email
      userRestaurants.forEach(userRestaurant => {
        const existing = allRestaurants.find(r => r.email === userRestaurant.email);
        if (!existing) {
          allRestaurants.push(userRestaurant);
        }
      });
      
    } catch (userError) {
      console.error('Error fetching restaurant users:', userError);
    }
    
    console.log(`Total restaurants found: ${allRestaurants.length}`);
    
    res.json({
      success: true,
      restaurants: allRestaurants
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المطاعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getRestaurantById = async (req, res) => {
  try {
    let restaurant = await Restaurant.findByPk(req.params.id);
    
    // If not found in Restaurant table, try User table
    if (!restaurant) {
      const user = await User.findOne({
        where: { 
          id: req.params.id,
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
    }
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }
    
    res.json({
      success: true,
      restaurant: restaurant
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المطعم'
    });
  }
};

const createRestaurant = async (req, res) => {
  const transaction = await (Restaurant.sequelize || User.sequelize).transaction();
  
  try {
    const {
      name, owner, email, password, phone, license_number,
      status, image_url, description, restaurant_location,
      cuisine_type, delivery_fee
    } = req.body;

    console.log('Creating restaurant with data:', { 
      name, owner, email, phone, cuisine_type, 
      hasLocation: !!restaurant_location 
    });

    // Validate required fields
    if (!name || !owner || !email || !password || !phone || !license_number || !cuisine_type || !restaurant_location) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول المطلوبة يجب ملؤها',
        errors: ['الاسم والمالك والبريد الإلكتروني وكلمة المرور والهاتف ورقم الترخيص ونوع المأكولات والموقع مطلوبة']
      });
    }

    // Normalize email and license number for consistency
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedLicense = license_number.trim();

    // Check for existing user with same email in User table
    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
      transaction
    });

    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'هذا البريد الإلكتروني مسجل بالفعل'
      });
    }

    // Check for existing restaurant with same license number in Restaurant table
    let existingRestaurant = null;
    try {
      existingRestaurant = await Restaurant.findOne({
        where: { license_number: normalizedLicense },
        transaction
      });
    } catch (err) {
      console.log('Restaurant table check failed, continuing...');
    }

    if (existingRestaurant) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'رقم الترخيص مستخدم بالفعل'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user account first
    const userData = {
      name: owner.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: 'restaurant',
      isActive: true,
      isVerified: status === 'active',
      online: false,
      totalOrders: 0,
      rating: 5.0,
      // Store restaurant-specific data in user record as backup
      license: normalizedLicense,
      cuisine_type: cuisine_type.trim(),
      delivery_fee: parseFloat(delivery_fee) || 0,
      location: restaurant_location,
      image_url: image_url || null,
      description: description || null
    };

    console.log('Creating user with data:', { 
      ...userData, 
      password: '[HIDDEN]' 
    });

    const user = await User.create(userData, { 
      transaction,
      hooks: false // Skip password hashing hook since we already hashed it
    });

    console.log('User created successfully:', user.id);

    // Try to create restaurant record if Restaurant table exists
    let restaurant = null;
    try {
      const restaurantData = {
        name: name.trim(),
        owner: owner.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        license_number: normalizedLicense,
        status: status || 'pending',
        image_url: image_url || null,
        description: description || null,
        restaurant_location: restaurant_location,
        cuisine_type: cuisine_type.trim(),
        delivery_fee: parseFloat(delivery_fee) || 0,
        user_id: user.id,
        rating: 5.0
      };

      restaurant = await Restaurant.create(restaurantData, { transaction });
      console.log('Restaurant record created successfully:', restaurant.id);
      
    } catch (restaurantCreateError) {
      console.log('Restaurant table creation failed, but user was created:', restaurantCreateError.message);
      // Continue without restaurant record - user record has all the data
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      id: restaurant ? restaurant.id : user.id,
      restaurant: restaurant || {
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
        rating: user.rating,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      },
      message: 'تم إضافة المطعم بنجاح'
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating restaurant:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: error.errors.map(err => err.message)
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      const constraintError = error.errors[0];
      let message = 'البيانات مستخدمة بالفعل';
      
      if (constraintError && constraintError.path === 'email') {
        message = 'البريد الإلكتروني مستخدم بالفعل';
      } else if (constraintError && constraintError.path === 'license_number') {
        message = 'رقم الترخيص مستخدم بالفعل';
      }
      
      return res.status(400).json({
        success: false,
        message: message
      });
    }

    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة المطعم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateRestaurant = async (req, res) => {
  const transaction = await (Restaurant.sequelize || User.sequelize).transaction();
  
  try {
    const {
      name, owner, email, phone, license_number, status,
      image_url, description, restaurant_location, 
      cuisine_type, delivery_fee
    } = req.body;

    const restaurantId = req.params.id;

    // Find restaurant in Restaurant table or User table
    let restaurant = null;
    let user = null;
    
    try {
      restaurant = await Restaurant.findByPk(restaurantId, { transaction });
      if (restaurant && restaurant.user_id) {
        user = await User.findByPk(restaurant.user_id, { transaction });
      }
    } catch (err) {
      console.log('Restaurant table not available, checking User table...');
    }
    
    if (!restaurant) {
      user = await User.findOne({
        where: { 
          id: restaurantId,
          role: 'restaurant'
        },
        transaction
      });
      
      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'المطعم غير موجود'
        });
      }
    }

    // Check for conflicts with other restaurants/users
    if (email || license_number) {
      const normalizedEmail = email ? email.toLowerCase().trim() : null;
      const normalizedLicense = license_number ? license_number.trim() : null;
      
      // Check User table for email conflicts
      if (normalizedEmail) {
        const existingUser = await User.findOne({
          where: {
            email: normalizedEmail,
            id: { [Op.ne]: restaurantId }
          },
          transaction
        });
        
        if (existingUser) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'البريد الإلكتروني مستخدم بالفعل'
          });
        }
      }
      
      // Check Restaurant table for license conflicts if table exists
      if (normalizedLicense && Restaurant) {
        try {
          const existingRestaurant = await Restaurant.findOne({
            where: {
              license_number: normalizedLicense,
              id: { [Op.ne]: restaurantId }
            },
            transaction
          });
          
          if (existingRestaurant) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: 'رقم الترخيص مستخدم بالفعل'
            });
          }
        } catch (err) {
          console.log('Restaurant table check failed during update');
        }
      }
    }

    // Update restaurant record if exists
    if (restaurant) {
      const restaurantUpdateData = {
        ...(name && { name: name.trim() }),
        ...(owner && { owner: owner.trim() }),
        ...(email && { email: email.toLowerCase().trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(license_number && { license_number: license_number.trim() }),
        ...(status && { status }),
        ...(image_url !== undefined && { image_url }),
        ...(description !== undefined && { description }),
        ...(restaurant_location && { restaurant_location }),
        ...(cuisine_type && { cuisine_type: cuisine_type.trim() }),
        ...(delivery_fee !== undefined && { delivery_fee: parseFloat(delivery_fee) || 0 })
      };

      await restaurant.update(restaurantUpdateData, { transaction });
    }

    // Update user record
    if (user) {
      const userUpdateData = {
        ...(owner && { name: owner.trim() }),
        ...(email && { email: email.toLowerCase().trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(license_number && { license: license_number.trim() }),
        ...(status && { isVerified: status === 'active' }),
        ...(image_url !== undefined && { image_url }),
        ...(description !== undefined && { description }),
        ...(restaurant_location && { location: restaurant_location }),
        ...(cuisine_type && { cuisine_type: cuisine_type.trim() }),
        ...(delivery_fee !== undefined && { delivery_fee: parseFloat(delivery_fee) || 0 })
      };

      await user.update(userUpdateData, { transaction });
    }

    await transaction.commit();

    res.json({
      success: true,
      id: restaurantId,
      message: 'تم تحديث المطعم بنجاح'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating restaurant:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني أو رقم الترخيص مستخدم بالفعل'
      });
    }

    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث المطعم'
    });
  }
};

const deleteRestaurant = async (req, res) => {
  const transaction = await (Restaurant.sequelize || User.sequelize).transaction();
  
  try {
    const restaurantId = req.params.id;
    
    // Find and delete from Restaurant table if exists
    let restaurant = null;
    try {
      restaurant = await Restaurant.findByPk(restaurantId, { transaction });
      if (restaurant) {
        await restaurant.destroy({ transaction });
      }
    } catch (err) {
      console.log('Restaurant table not available for deletion');
    }

    // Find and delete from User table
    const user = await User.findOne({
      where: { 
        id: restaurantId,
        role: 'restaurant'
      },
      transaction
    });

    if (user) {
      await user.destroy({ transaction });
    }

    if (!restaurant && !user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'تم حذف المطعم بنجاح'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف المطعم'
    });
  }
};

const updateRestaurantStatus = async (req, res) => {
  const transaction = await (Restaurant.sequelize || User.sequelize).transaction();
  
  try {
    const { status } = req.body;
    const restaurantId = req.params.id;
    
    if (!['active', 'pending', 'suspended'].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة'
      });
    }

    // Update Restaurant table if exists
    let restaurant = null;
    try {
      restaurant = await Restaurant.findByPk(restaurantId, { transaction });
      if (restaurant) {
        await restaurant.update({ status }, { transaction });
      }
    } catch (err) {
      console.log('Restaurant table not available for status update');
    }

    // Update User table
    const user = await User.findOne({
      where: { 
        id: restaurantId,
        role: 'restaurant'
      },
      transaction
    });

    if (user) {
      await user.update({ 
        isVerified: status === 'active',
        isActive: status !== 'suspended'
      }, { transaction });
    }

    if (!restaurant && !user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'المطعم غير موجود'
      });
    }

    await transaction.commit();
    
    res.json({
      success: true,
      id: restaurantId,
      message: 'تم تحديث حالة المطعم بنجاح'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating restaurant status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة المطعم'
    });
  }
};

module.exports = {
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  updateRestaurantStatus
};