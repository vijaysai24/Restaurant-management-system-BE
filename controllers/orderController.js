// controllers/orderController.js
// Business logic for customer orders: list them, place a new order from the
// Point of Sale, and move an order through the kitchen (pending -> preparing -> ready -> completed).
//
// Prices are always read from the database here. The browser only sends
// which dishes and how many, so nobody can change a price from the frontend.

const pool = require('../config/db');
const { TAX_RATE, PROMO_CODES, calculateOrderTotals } = require('../config/pricing');

const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery'];
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const ACTIVE_STATUSES = ['pending', 'preparing', 'ready'];

// Which status an order may move to from its current status
const NEXT_STATUSES = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Every order comes back with its table name and its list of dishes (as a JSON array).
const SELECT_ORDERS = `
  SELECT orders.*,
         restaurant_tables.name AS table_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', order_items.id,
               'food_item_id', order_items.food_item_id,
               'name', order_items.item_name,
               'unit_price', order_items.unit_price,
               'quantity', order_items.quantity,
               'image_url', food_items.image_url
             ) ORDER BY order_items.id
           ) FILTER (WHERE order_items.id IS NOT NULL),
           '[]'
         ) AS items
  FROM orders
  LEFT JOIN restaurant_tables ON restaurant_tables.id = orders.table_id
  LEFT JOIN order_items ON order_items.order_id = orders.id
  LEFT JOIN food_items ON food_items.id = order_items.food_item_id
`;

const GROUP_ORDERS = 'GROUP BY orders.id, restaurant_tables.name';

// GET /api/orders?status=active&limit=50
// status can be one of ORDER_STATUSES, or "active" for pending + preparing + ready.
async function getAllOrders(req, res) {
  try {
    const { status } = req.query;
    const limit = Math.min(Number(req.query.limit) || 200, 500);

    let where = '';
    const values = [];

    if (status === 'active') {
      values.push(ACTIVE_STATUSES);
      where = 'WHERE orders.status = ANY($1)';
    } else if (status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Unknown order status' });
      }
      values.push(status);
      where = 'WHERE orders.status = $1';
    }

    values.push(limit);
    const result = await pool.query(
      `${SELECT_ORDERS} ${where} ${GROUP_ORDERS}
       ORDER BY orders.created_at DESC, orders.id DESC
       LIMIT $${values.length}`,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
}

// GET /api/orders/counts
// How many orders are in each status, e.g. { pending: 2, preparing: 1, ..., active: 4 }
async function getOrderCounts(req, res) {
  try {
    const result = await pool.query('SELECT status, COUNT(*)::int AS total FROM orders GROUP BY status');

    const counts = { pending: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 };
    result.rows.forEach((row) => {
      counts[row.status] = row.total;
    });
    counts.active = counts.pending + counts.preparing + counts.ready;
    counts.all = counts.active + counts.completed + counts.cancelled;

    res.json(counts);
  } catch (error) {
    console.error('Error counting orders:', error.message);
    res.status(500).json({ message: 'Failed to count orders' });
  }
}

// GET /api/orders/pricing
// Tells the Point of Sale which tax rate to show in its bill preview.
function getPricing(req, res) {
  res.json({ tax_rate: TAX_RATE });
}

// GET /api/orders/promo/WELCOME10
// Checks a promo code before the order is placed.
function checkPromoCode(req, res) {
  const code = String(req.params.code || '').trim().toUpperCase();
  const percent = PROMO_CODES[code];

  if (!percent) {
    return res.status(404).json({ message: 'This promo code is not valid' });
  }
  res.json({ code, percent, message: `${percent}% off applied` });
}

// GET /api/orders/:id
async function getOrderById(req, res) {
  try {
    const result = await pool.query(`${SELECT_ORDERS} WHERE orders.id = $1 ${GROUP_ORDERS}`, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error.message);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
}

// Checks the order sent from the Point of Sale.
// Returns an error message if something is wrong, otherwise returns null.
function validateOrder(data) {
  const { order_type, table_id, items, customer_name } = data;

  if (!ORDER_TYPES.includes(order_type)) {
    return 'Please choose an order type';
  }
  if (order_type === 'dine_in' && !table_id) {
    return 'Please choose a table for a dine-in order';
  }
  if (customer_name && String(customer_name).trim().length > 100) {
    return 'Customer name must be 100 characters or less';
  }
  if (!Array.isArray(items) || items.length === 0) {
    return 'Add at least one dish to the order';
  }
  if (items.length > 50) {
    return 'An order can have at most 50 different dishes';
  }
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(Number(item.food_item_id)) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return 'Each dish needs a quantity between 1 and 100';
    }
  }
  return null;
}

// POST /api/orders
// Body: { customer_name, order_type, table_id, promo_code, notes, items: [{ food_item_id, quantity }] }
async function createOrder(req, res) {
  const validationError = validateOrder(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const { customer_name, order_type, notes } = req.body;
  const tableId = order_type === 'dine_in' ? Number(req.body.table_id) : null;

  // Promo code (optional)
  const promoCode = req.body.promo_code ? String(req.body.promo_code).trim().toUpperCase() : '';
  if (promoCode && !PROMO_CODES[promoCode]) {
    return res.status(400).json({ message: 'This promo code is not valid' });
  }
  const discountPercent = promoCode ? PROMO_CODES[promoCode] : 0;

  // If the same dish was sent twice, add the quantities together
  const quantities = {};
  req.body.items.forEach((item) => {
    const id = Number(item.food_item_id);
    quantities[id] = (quantities[id] || 0) + Number(item.quantity);
  });
  const foodItemIds = Object.keys(quantities).map(Number);

  // A transaction: either everything below is saved, or nothing is
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read the real names and prices from the database
    const foodResult = await client.query(
      'SELECT id, name, price, is_available FROM food_items WHERE id = ANY($1)',
      [foodItemIds]
    );
    if (foodResult.rowCount !== foodItemIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'One of the dishes no longer exists. Please refresh the menu.' });
    }
    const unavailable = foodResult.rows.find((food) => !food.is_available);
    if (unavailable) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `"${unavailable.name}" is not available right now` });
    }

    // Check the table exists ("FOR UPDATE" locks the row until we finish)
    if (tableId) {
      const tableResult = await client.query('SELECT id FROM restaurant_tables WHERE id = $1 FOR UPDATE', [tableId]);
      if (tableResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'The selected table does not exist' });
      }
    }

    const lines = foodResult.rows.map((food) => ({
      food_item_id: food.id,
      item_name: food.name,
      unit_price: Number(food.price),
      quantity: quantities[food.id],
    }));
    const totals = calculateOrderTotals(lines, discountPercent);

    const orderResult = await client.query(
      `INSERT INTO orders (customer_name, order_type, table_id, subtotal, discount, tax, total, promo_code, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        customer_name ? String(customer_name).trim() : null,
        order_type,
        tableId,
        totals.subtotal,
        totals.discount,
        totals.tax,
        totals.total,
        promoCode || null,
        notes ? String(notes).trim() : null,
      ]
    );
    const order = orderResult.rows[0];

    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, food_item_id, item_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, line.food_item_id, line.item_name, line.unit_price, line.quantity]
      );
    }

    // A dine-in order means guests are now sitting at that table
    if (tableId) {
      await client.query("UPDATE restaurant_tables SET status = 'occupied' WHERE id = $1", [tableId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: `Order #${order.id} placed successfully`, order });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error.message);
    res.status(500).json({ message: 'Failed to place the order' });
  } finally {
    client.release(); // give the connection back to the pool
  }
}

// PATCH /api/orders/:id/status
// Body: { status: 'preparing' }
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Unknown order status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT id, status, table_id FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = current.rows[0];
    if (!NEXT_STATUSES[order.status].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `A ${order.status} order cannot be changed to ${status}` });
    }

    const result = await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    // When an order is finished, free its table if no other active order is using it
    if ((status === 'completed' || status === 'cancelled') && order.table_id) {
      const others = await client.query(
        'SELECT COUNT(*)::int AS total FROM orders WHERE table_id = $1 AND status = ANY($2)',
        [order.table_id, ACTIVE_STATUSES]
      );
      if (others.rows[0].total === 0) {
        await client.query("UPDATE restaurant_tables SET status = 'available' WHERE id = $1", [order.table_id]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Order #${id} is now ${status}`, order: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating order status:', error.message);
    res.status(500).json({ message: 'Failed to update the order' });
  } finally {
    client.release();
  }
}

module.exports = {
  ACTIVE_STATUSES,
  getAllOrders,
  getOrderCounts,
  getPricing,
  checkPromoCode,
  getOrderById,
  createOrder,
  updateOrderStatus,
};
