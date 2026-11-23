// routes/foodItemRoutes.js
// Connects each food item URL to the controller function that handles it.
// These paths are added after "/api/food-items" (see server.js).

const express = require('express');
const {
  getAllFoodItems,
  getFoodItemById,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
} = require('../controllers/foodItemController');

const router = express.Router();

router.get('/', getAllFoodItems);        // GET    /api/food-items
router.get('/:id', getFoodItemById);     // GET    /api/food-items/5
router.post('/', createFoodItem);        // POST   /api/food-items
router.put('/:id', updateFoodItem);      // PUT    /api/food-items/5
router.delete('/:id', deleteFoodItem);   // DELETE /api/food-items/5

module.exports = router;
