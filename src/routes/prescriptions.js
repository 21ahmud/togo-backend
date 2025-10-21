const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/prescriptions - Get all prescriptions (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Only admin and pharmacy owners can see prescriptions
    if (req.user.role !== 'admin' && req.user.role !== 'pharmacy') {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح بالوصول'
      });
    }

    let whereClause = {};
    
    // If pharmacy user, only show their prescriptions
    if (req.user.role === 'pharmacy') {
      whereClause.pharmacyEmail = req.user.email;
    }

    const prescriptions = await Prescription.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      prescriptions: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرجاع الروشتات',
      error: error.message
    });
  }
});

// GET /api/prescriptions/pharmacy/:pharmacyId - Get prescriptions for a specific pharmacy
router.get('/pharmacy/:pharmacyId', authenticateToken, async (req, res) => {
  try {
    const pharmacyId = parseInt(req.params.pharmacyId);
    
    // Check if user has permission to view this pharmacy's prescriptions
    if (req.user.role !== 'admin' && req.user.id !== pharmacyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح بالوصول'
      });
    }

    // FIXED: Corrected the where clause structure
    const whereClause = {
      pharmacyId: pharmacyId
    };

    const pharmacyPrescriptions = await Prescription.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      prescriptions: pharmacyPrescriptions,
      count: pharmacyPrescriptions.length
    });
  } catch (error) {
    console.error('Error fetching pharmacy prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرجاع الروشتات',
      error: error.message
    });
  }
});

// POST /api/prescriptions - Create new prescription
router.post('/', async (req, res) => {
  try {
    const {
      pharmacyId,
      pharmacyName,
      pharmacyEmail,
      customerName,
      customerPhone,
      customerAddress,
      notes,
      imageBase64,
      userLocation,
      distance,
      estimatedDeliveryFee,
      pharmacy_location,
      delivery_fee
    } = req.body;

    // Validate required fields
    if (!pharmacyId || !pharmacyName || !customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة مفقودة'
      });
    }

    // Create new prescription in database
    const newPrescription = await Prescription.create({
      pharmacyId,
      pharmacyName,
      pharmacyEmail,
      customerName,
      customerPhone,
      customerAddress,
      notes: notes || null,
      imageBase64: imageBase64 || null,
      status: 'pending',
      type: 'prescription',
      userLocation,
      distance,
      estimatedDeliveryFee: delivery_fee || estimatedDeliveryFee,
      pharmacyLocation: pharmacy_location
    });

    console.log('New prescription created in database:', {
      id: newPrescription.id,
      pharmacyName,
      customerName,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'تم إرسال الروشتة بنجاح',
      prescription: newPrescription
    });

  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إرسال الروشتة',
      error: error.message
    });
  }
});

// GET /api/prescriptions/:id - Get specific prescription
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prescriptionId = parseInt(req.params.id);
    const prescription = await Prescription.findByPk(prescriptionId);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'الروشتة غير موجودة'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && 
        (req.user.role !== 'pharmacy' || prescription.pharmacyEmail !== req.user.email)) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح بالوصول'
      });
    }

    res.json({
      success: true,
      prescription
    });

  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرجاع الروشتة',
      error: error.message
    });
  }
});

// PUT /api/prescriptions/:id - Update prescription status
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const prescriptionId = parseInt(req.params.id);
    const { status, productPrice, proposedPrice, deliveryFee, estimatedDeliveryTime } = req.body;

    const prescription = await Prescription.findByPk(prescriptionId);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'الروشتة غير موجودة'
      });
    }

    // Only pharmacy or admin can update status
    if (req.user.role !== 'admin' && 
        (req.user.role !== 'pharmacy' || prescription.pharmacyEmail !== req.user.email)) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح بالوصول'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'accepted', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة'
      });
    }

    // Update prescription in database
    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (productPrice !== undefined && status === 'accepted') {
      updateData.productPrice = productPrice;
    }

    if (proposedPrice !== undefined && status === 'accepted') {
      updateData.proposedPrice = proposedPrice;
    }

    if (deliveryFee !== undefined && status === 'accepted') {
      updateData.deliveryFee = deliveryFee;
    }

    if (estimatedDeliveryTime !== undefined && status === 'accepted') {
      updateData.estimatedDeliveryTime = estimatedDeliveryTime;
    }

    await prescription.update(updateData);

    console.log('Prescription status updated in database:', {
      id: prescriptionId,
      status,
      productPrice,
      proposedPrice
    });

    res.json({
      success: true,
      message: 'تم تحديث حالة الروشتة',
      prescription
    });

  } catch (error) {
    console.error('Error updating prescription status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة الروشتة',
      error: error.message
    });
  }
});

// PUT /api/prescriptions/:id/status - Update prescription status (legacy endpoint)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const prescriptionId = parseInt(req.params.id);
    const { status, price, notes } = req.body;

    const prescription = await Prescription.findByPk(prescriptionId);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'الروشتة غير موجودة'
      });
    }

    // Only pharmacy or admin can update status
    if (req.user.role !== 'admin' && 
        (req.user.role !== 'pharmacy' || prescription.pharmacyEmail !== req.user.email)) {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح بالوصول'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'accepted', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة'
      });
    }

    // Update prescription
    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (price !== undefined && status === 'accepted') {
      updateData.productPrice = price;
    }

    if (notes) {
      updateData.pharmacyNotes = notes;
    }

    await prescription.update(updateData);

    console.log('Prescription status updated:', {
      id: prescriptionId,
      status,
      price
    });

    res.json({
      success: true,
      message: 'تم تحديث حالة الروشتة',
      prescription
    });

  } catch (error) {
    console.error('Error updating prescription status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة الروشتة',
      error: error.message
    });
  }
});

// DELETE /api/prescriptions/:id - Delete prescription (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const prescriptionId = parseInt(req.params.id);
    const prescription = await Prescription.findByPk(prescriptionId);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'الروشتة غير موجودة'
      });
    }

    await prescription.destroy();

    res.json({
      success: true,
      message: 'تم حذف الروشتة'
    });

  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الروشتة',
      error: error.message
    });
  }
});

module.exports = router;