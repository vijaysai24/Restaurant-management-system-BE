// controllers/categoryController.js
// Business logic for food categories (Create, Read, Update, Delete).
//
// Every function receives:
//   req - the request from the frontend (URL params, body data)
//   res - used to send the response back
//
// All SQL queries use placeholders ($1, $2, ...) and pass the values separately.
// The user's input is never joined into the SQL text, which prevents SQL injection.

const pool = require('../config/db');

// Checks the category name sent from the form.
// Returns an error message if something is wrong, otherwise returns null.
function validateCategory(name) {
  if (!name || name.trim() === '') {
    return 'Category name is required';
  }
  if (name.trim().length > 100) {
    return 'Category name must be 100 characters or less';
  }
  return null;
}

// GET /api/categories
// Returns all categories, along with how many food items each one has.
async function getAllCategories(req, res) {
  try {
    // LEFT JOIN keeps categories that have no food items (their count will be 0)
    const result = await pool.query(`
      SELECT categories.*, COUNT(food_items.id)::int AS item_count
      FROM categories
      LEFT JOIN food_items ON food_items.category_id = categories.id
      GROUP BY categories.id
      ORDER BY categories.name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
}

// POST /api/categories
// Adds a new category.
async function createCategory(req, res) {
  try {
    const { name, description } = req.body;

    const validationError = validateCategory(name);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const result = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name.trim(), description ? description.trim() : '']
    );

    res.status(201).json({ message: 'Category added successfully', category: result.rows[0] });
  } catch (error) {
    // 23505 is the PostgreSQL error code for "this value must be unique"
    if (error.code === '23505') {
      return res.status(400).json({ message: 'A category with this name already exists' });
    }
    console.error('Error adding category:', error.message);
    res.status(500).json({ message: 'Failed to add category' });
  }
}

// PUT /api/categories/:id
// Updates the name and description of an existing category.
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const validationError = validateCategory(name);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const result = await pool.query(
      'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name.trim(), description ? description.trim() : '', id]
    );

    // rowCount is 0 when no category has this id
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category updated successfully', category: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'A category with this name already exists' });
    }
    console.error('Error updating category:', error.message);
    res.status(500).json({ message: 'Failed to update category' });
  }
}

// DELETE /api/categories/:id
// Deletes a category, but only if no food items are using it.
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;

    // First check whether any food items belong to this category
    const itemResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM food_items WHERE category_id = $1',
      [id]
    );
    const itemCount = itemResult.rows[0].total;

    if (itemCount > 0) {
      return res.status(400).json({
        message: `This category has ${itemCount} food item(s). Delete them or move them to another category first.`,
      });
    }

    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error.message);
    res.status(500).json({ message: 'Failed to delete category' });
  }
}

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
