const express = require('express');
const router = express.Router();
const restaurantController = require('../../controllers/restaurantController');
const { auth, requireRole, requireAdmin } = require('../../middleware/auth');

router.get('/', requireAdmin, restaurantController.getAllRestaurants);
router.put('/:id', requireAdmin, restaurantController.updateRestaurant);
router.delete('/:id', requireAdmin, restaurantController.deleteRestaurant);
router.patch('/:id/status', requireAdmin, restaurantController.updateRestaurantStatus);

module.exports = router;