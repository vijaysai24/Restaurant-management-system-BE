// config/pricing.js
// Money rules for orders, kept in one place so the order controller,
// the sample data script and the frontend (through GET /api/orders/pricing) all agree.

// GST charged on restaurant food in India: 5%
const TAX_RATE = 0.05;

// Promo codes customers can use at the Point of Sale: code -> percent off
const PROMO_CODES = {
  WELCOME10: 10,
  FEAST15: 15,
};

// Rounds money to 2 decimal places: 10.005 -> 10.01
function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

// Works out the bill for a list of order lines.
//   lines           - [{ unit_price, quantity }, ...]
//   discountPercent - for example 10 for 10% off (0 when there is no promo code)
// The discount is taken off first, then GST is added on the discounted amount.
function calculateOrderTotals(lines, discountPercent = 0) {
  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + Number(line.unit_price) * line.quantity, 0)
  );
  const discount = roundMoney((subtotal * discountPercent) / 100);
  const tax = roundMoney((subtotal - discount) * TAX_RATE);
  const total = roundMoney(subtotal - discount + tax);

  return { subtotal, discount, tax, total };
}

module.exports = { TAX_RATE, PROMO_CODES, roundMoney, calculateOrderTotals };
