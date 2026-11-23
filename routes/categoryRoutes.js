// routes/categoryRoutes.js
// Connects each category URL to the controller function that handles it.
// These paths are added after "/api/categories" (see server.js).

const express = require('express');
const {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');

const router = express.Router();

router.get('/', getAllCategories);       // GET    /api/categories
router.post('/', createCategory);        // POST   /api/categories
router.put('/:id', updateCategory);      // PUT    /api/categories/5
router.delete('/:id', deleteCategory);   // DELETE /api/categories/5

module.exports = router;
