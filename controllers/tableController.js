// controllers/tableController.js
// Business logic for the dining tables (the floor plan):
// list them with their current bill, add, edit, change status and delete.

const pool = require('../config/db');
const { ACTIVE_STATUSES } = require('./orderController');

const TABLE_STATUSES = ['available', 'occupied', 'reserved'];

// Checks the table data sent from the form.
// Returns an error message if something is wrong, otherwise returns null.
function validateTable(data) {
  const { name, seats, area } = data;

  if (!name || String(name).trim() === '') {
    return 'Table name is required';
  }
  if (String(name).trim().length > 50) {
    return 'Table name must be 50 characters or less';
  }
  if (!Number.isInteger(Number(seats)) || Number(seats) < 1 || Number(seats) > 50) {
    return 'Seats must be a whole number between 1 and 50';
  }
  if (area && String(area).trim().length > 50) {
    return 'Area must be 50 characters or less';
  }
  return null;
}

// How many active orders are using a table right now
async function countActiveOrders(tableId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS total FROM orders WHERE table_id = $1 AND status = ANY($2)',
    [tableId, ACTIVE_STATUSES]
  );
  return result.rows[0].total;
}

// GET /api/tables
// Every table, with its active orders: how many, the running bill and when the guests sat down.
async function getAllTables(req, res) {
  try {
    const result = await pool.query(
      `SELECT restaurant_tables.*,
              active.order_count,
              active.current_total,
              active.seated_at
       FROM restaurant_tables
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS order_count,
                COALESCE(SUM(orders.total), 0) AS current_total,
                MIN(orders.created_at) AS seated_at
         FROM orders
         WHERE orders.table_id = restaurant_tables.id AND orders.status = ANY($1)
       ) AS active ON true
       ORDER BY restaurant_tables.area, LENGTH(restaurant_tables.name), restaurant_tables.name`,
      [ACTIVE_STATUSES]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tables:', error.message);
    res.status(500).json({ message: 'Failed to fetch tables' });
  }
}

// POST /api/tables
async function createTable(req, res) {
  try {
    const validationError = validateTable(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { name, seats, area } = req.body;
    const result = await pool.query(
      'INSERT INTO restaurant_tables (name, seats, area) VALUES ($1, $2, $3) RETURNING *',
      [String(name).trim(), Number(seats), area ? String(area).trim() : 'Main hall']
    );
    res.status(201).json({ message: 'Table added successfully', table: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'A table with this name already exists' });
    }
    console.error('Error creating table:', error.message);
    res.status(500).json({ message: 'Failed to add table' });
  }
}

// PUT /api/tables/:id   (name, seats and area; the status has its own route)
async function updateTable(req, res) {
  try {
    const validationError = validateTable(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { name, seats, area } = req.body;
    const result = await pool.query(
      'UPDATE restaurant_tables SET name = $1, seats = $2, area = $3 WHERE id = $4 RETURNING *',
      [String(name).trim(), Number(seats), area ? String(area).trim() : 'Main hall', req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    res.json({ message: 'Table updated successfully', table: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'A table with this name already exists' });
    }
    console.error('Error updating table:', error.message);
    res.status(500).json({ message: 'Failed to update table' });
  }
}

// PATCH /api/tables/:id/status
// Body: { status: 'reserved' }
async function updateTableStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!TABLE_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Unknown table status' });
    }

    // A table with guests still eating cannot be marked free
    if (status !== 'occupied') {
      const activeOrders = await countActiveOrders(id);
      if (activeOrders > 0) {
        return res.status(400).json({
          message: `This table still has ${activeOrders} active order(s). Complete or cancel them first.`,
        });
      }
    }

    const result = await pool.query('UPDATE restaurant_tables SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    res.json({ message: `${result.rows[0].name} is now ${status}`, table: result.rows[0] });
  } catch (error) {
    console.error('Error updating table status:', error.message);
    res.status(500).json({ message: 'Failed to update table' });
  }
}

// DELETE /api/tables/:id
async function deleteTable(req, res) {
  try {
    const { id } = req.params;

    const activeOrders = await countActiveOrders(id);
    if (activeOrders > 0) {
      return res.status(400).json({
        message: `This table has ${activeOrders} active order(s). Complete or cancel them first.`,
      });
    }

    const result = await pool.query('DELETE FROM restaurant_tables WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    console.error('Error deleting table:', error.message);
    res.status(500).json({ message: 'Failed to delete table' });
  }
}

module.exports = {
  getAllTables,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
};
