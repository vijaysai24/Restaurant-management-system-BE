// routes/orderRoutes.js
// Connects each order URL to the controller function that handles it.
// These paths are added after "/api/orders" (see server.js).
// The fixed paths (/counts, /pricing, /promo) must come before "/:id",
// otherwise Express would treat the word "counts" as an order id.

const express = require('express');
const {
  getAllOrders,
  getOrderCounts,
  getPricing,
  checkPromoCode,
  getOrderById,
  createOrder,
  updateOrderStatus,
} = require('../controllers/orderController');

const router = express.Router();

router.get('/', getAllOrders);                   // GET   /api/orders?status=active
router.get('/counts', getOrderCounts);           // GET   /api/orders/counts
router.get('/pricing', getPricing);              // GET   /api/orders/pricing
router.get('/promo/:code', checkPromoCode);      // GET   /api/orders/promo/WELCOME10
router.get('/:id', getOrderById);                // GET   /api/orders/5
router.post('/', createOrder);                   // POST  /api/orders
router.patch('/:id/status', updateOrderStatus);  // PATCH /api/orders/5/status

module.exports = router;
