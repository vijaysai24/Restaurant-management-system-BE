// controllers/foodItemController.js
// Business logic for food items (Create, Read, Update, Delete).
//
// All SQL queries use placeholders ($1, $2, ...) to prevent SQL injection.

const pool = require('../config/db');

// The highest price we accept for one food item (in rupees)
const MAX_PRICE = 100000;

// Common SELECT used by "get all" and "get one".
// It joins the categories table so every food item also has its category name.
const SELECT_FOOD_ITEMS = `
  SELECT food_items.*, categories.name AS category_name
  FROM food_items
  JOIN categories ON categories.id = food_items.category_id
`;

// Checks the food item data sent from the form.
// Returns an error message if something is wrong, otherwise returns null.
function validateFoodItem(data) {
  const { name, category_id, price } = data;

  if (!name || name.trim() === '') {
    return 'Food name is required';
  }
  if (name.trim().length > 150) {
    return 'Food name must be 150 characters or less';
  }
  if (!category_id) {
    return 'Please select a category';
  }
  if (price === undefined || price === null || price === '') {
    return 'Price is required';
  }
  if (isNaN(price) || Number(price) < 0) {
    return 'Price must be a valid number (0 or more)';
  }
  if (Number(price) > MAX_PRICE) {
    return `Price cannot be more than ${MAX_PRICE}`;
  }
  return null;
}

// Converts the request body into the exact values we save in the database.
function getFoodItemValues(data) {
  return [
    data.name.trim(),
    data.description ? data.description.trim() : '',
    Number(data.category_id),
    Number(data.price),
    data.image_url ? data.image_url.trim() : null, // image is optional
    data.is_available !== false, // available by default, unless false is sent
  ];
}

// GET /api/food-items
// Returns all food items, newest first.
async function getAllFoodItems(req, res) {
  try {
    const result = await pool.query(
      `${SELECT_FOOD_ITEMS} ORDER BY food_items.created_at DESC, food_items.id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching food items:', error.message);
    res.status(500).json({ message: 'Failed to fetch food items' });
  }
}

// GET /api/food-items/:id
// Returns one food item.
async function getFoodItemById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(`${SELECT_FOOD_ITEMS} WHERE food_items.id = $1`, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching food item:', error.message);
    res.status(500).json({ message: 'Failed to fetch food item' });
  }
}

// POST /api/food-items
// Adds a new food item.
async function createFoodItem(req, res) {
  try {
    const validationError = validateFoodItem(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const result = await pool.query(
      `INSERT INTO food_items (name, description, category_id, price, image_url, is_available)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      getFoodItemValues(req.body)
    );

    res.status(201).json({ message: 'Food item added successfully', foodItem: result.rows[0] });
  } catch (error) {
    // 23503 is the PostgreSQL error code for "foreign key does not exist"
    if (error.code === '23503') {
      return res.status(400).json({ message: 'The selected category does not exist' });
    }
    console.error('Error adding food item:', error.message);
    res.status(500).json({ message: 'Failed to add food item' });
  }
}

// PUT /api/food-items/:id
// Updates an existing food item (also used to enable/disable availability).
async function updateFoodItem(req, res) {
  try {
    const { id } = req.params;

    const validationError = validateFoodItem(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const result = await pool.query(
      `UPDATE food_items
       SET name = $1, description = $2, category_id = $3, price = $4, image_url = $5, is_available = $6
       WHERE id = $7
       RETURNING *`,
      [...getFoodItemValues(req.body), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    res.json({ message: 'Food item updated successfully', foodItem: result.rows[0] });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ message: 'The selected category does not exist' });
    }
    console.error('Error updating food item:', error.message);
    res.status(500).json({ message: 'Failed to update food item' });
  }
}

// DELETE /api/food-items/:id
// Deletes a food item.
async function deleteFoodItem(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM food_items WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    res.json({ message: 'Food item deleted successfully' });
  } catch (error) {
    console.error('Error deleting food item:', error.message);
    res.status(500).json({ message: 'Failed to delete food item' });
  }
}

module.exports = {
  getAllFoodItems,
  getFoodItemById,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
};
