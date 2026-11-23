// controllers/reportController.js
// Sales numbers for the dashboard and the Sales Reports page.
// Everything is calculated in SQL with GROUP BY, straight from the orders table.
// Cancelled orders never count as sales.

const pool = require('../config/db');

// pg returns NUMERIC columns as text (to keep exact decimals). This turns them into numbers.
function toNumber(value) {
  return Number(value) || 0;
}

// GET /api/reports/summary?days=7
// The period is "today and the days before it", e.g. days=7 is the last 7 days including today.
// The previous period (the 7 days before that) is returned too, so the page can show changes.
async function getSalesSummary(req, res) {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 365);

  // Orders that count as sales inside the chosen period
  const IN_PERIOD = `orders.status <> 'cancelled' AND orders.created_at >= CURRENT_DATE - ($1::int - 1)`;

  try {
    const [totals, previous, cancelled, itemsSold, daily, items, byCategory, byType, byHour] = await Promise.all([
      // Revenue and number of orders in this period
      pool.query(
        `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders WHERE ${IN_PERIOD}`,
        [days]
      ),

      // The same numbers for the period just before it
      pool.query(
        `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders
         WHERE status <> 'cancelled'
           AND created_at >= CURRENT_DATE - ($1::int * 2 - 1)
           AND created_at < CURRENT_DATE - ($1::int - 1)`,
        [days]
      ),

      // Cancelled orders in this period
      pool.query(
        `SELECT COUNT(*)::int AS total FROM orders
         WHERE status = 'cancelled' AND created_at >= CURRENT_DATE - ($1::int - 1)`,
        [days]
      ),

      // Number of dishes sold
      pool.query(
        `SELECT COALESCE(SUM(order_items.quantity), 0)::int AS total
         FROM order_items JOIN orders ON orders.id = order_items.order_id
         WHERE ${IN_PERIOD}`,
        [days]
      ),

      // One row per day, including days with no orders (generate_series makes the list of days)
      pool.query(
        `SELECT TO_CHAR(day, 'YYYY-MM-DD') AS date,
                COUNT(orders.id)::int AS orders,
                COALESCE(SUM(orders.total), 0) AS revenue
         FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day') AS day
         LEFT JOIN orders ON orders.created_at::date = day::date AND orders.status <> 'cancelled'
         GROUP BY day
         ORDER BY day`,
        [days]
      ),

      // Every dish sold in the period, best sellers first
      pool.query(
        `SELECT order_items.food_item_id,
                order_items.item_name AS name,
                food_items.image_url,
                categories.name AS category_name,
                SUM(order_items.quantity)::int AS quantity,
                SUM(order_items.quantity * order_items.unit_price) AS revenue
         FROM order_items
         JOIN orders ON orders.id = order_items.order_id
         LEFT JOIN food_items ON food_items.id = order_items.food_item_id
         LEFT JOIN categories ON categories.id = food_items.category_id
         WHERE ${IN_PERIOD}
         GROUP BY order_items.food_item_id, order_items.item_name, food_items.image_url, categories.name
         ORDER BY quantity DESC, revenue DESC`,
        [days]
      ),

      // Sales per category (dishes that were deleted later are grouped as "Other")
      pool.query(
        `SELECT COALESCE(categories.name, 'Other') AS name,
                SUM(order_items.quantity)::int AS quantity,
                SUM(order_items.quantity * order_items.unit_price) AS revenue
         FROM order_items
         JOIN orders ON orders.id = order_items.order_id
         LEFT JOIN food_items ON food_items.id = order_items.food_item_id
         LEFT JOIN categories ON categories.id = food_items.category_id
         WHERE ${IN_PERIOD}
         GROUP BY COALESCE(categories.name, 'Other')
         ORDER BY revenue DESC`,
        [days]
      ),

      // Dine-in vs takeaway vs delivery
      pool.query(
        `SELECT order_type, COUNT(*)::int AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders WHERE ${IN_PERIOD}
         GROUP BY order_type
         ORDER BY orders DESC`,
        [days]
      ),

      // Busiest hours of the day
      pool.query(
        `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS orders
         FROM orders WHERE ${IN_PERIOD}
         GROUP BY hour
         ORDER BY hour`,
        [days]
      ),
    ]);

    const revenue = toNumber(totals.rows[0].revenue);
    const orderCount = totals.rows[0].orders;

    res.json({
      days,
      totals: {
        revenue,
        orders: orderCount,
        average_order_value: orderCount > 0 ? Math.round((revenue / orderCount) * 100) / 100 : 0,
        items_sold: itemsSold.rows[0].total,
        cancelled: cancelled.rows[0].total,
      },
      previous: {
        revenue: toNumber(previous.rows[0].revenue),
        orders: previous.rows[0].orders,
      },
      daily: daily.rows.map((row) => ({ date: row.date, orders: row.orders, revenue: toNumber(row.revenue) })),
      items: items.rows.map((row) => ({ ...row, revenue: toNumber(row.revenue) })),
      by_category: byCategory.rows.map((row) => ({ ...row, revenue: toNumber(row.revenue) })),
      by_type: byType.rows.map((row) => ({ ...row, revenue: toNumber(row.revenue) })),
      by_hour: byHour.rows,
    });
  } catch (error) {
    console.error('Error building sales summary:', error.message);
    res.status(500).json({ message: 'Failed to load the sales report' });
  }
}

module.exports = { getSalesSummary };
