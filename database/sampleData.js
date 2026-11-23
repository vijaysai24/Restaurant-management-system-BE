// database/sampleData.js
// Sample data used by "npm run setup-db" so the demo has something to show.
// Nothing here is real: the dishes, tables, customers and orders are examples.

// Dishes added on top of the 11 in seed.sql, so the Point of Sale menu looks full
const EXTRA_DISHES = [
  { name: 'Tandoori Chicken', category: 'Starters', price: 340, description: 'Chicken marinated in yogurt and spices, roasted in the tandoor' },
  { name: 'Hara Bhara Kebab', category: 'Starters', price: 190, description: 'Spinach, pea and potato patties served with mint chutney' },
  { name: 'Palak Paneer', category: 'Main Course', price: 240, description: 'Cottage cheese cubes in a smooth, lightly spiced spinach gravy' },
  { name: 'Chicken Biryani', category: 'Main Course', price: 300, description: 'Basmati rice layered with spiced chicken and slow-cooked dum style' },
  { name: 'Laccha Paratha', category: 'Breads', price: 70, description: 'Flaky, layered whole-wheat bread from the tandoor' },
  { name: 'Rasmalai', category: 'Desserts', price: 120, description: 'Soft cheese dumplings in chilled saffron milk (2 pcs)' },
  { name: 'Fresh Lime Soda', category: 'Beverages', price: 80, description: 'Fresh lime with chilled soda, sweet or salted' },
  { name: 'Cold Coffee', category: 'Beverages', price: 140, description: 'Chilled coffee blended with milk and a scoop of ice cream' },
];

// Photo for each sample dish. The files live in frontend/public/images/menu/
// (see CREDITS.md there). A photo is only used if its file exists.
const DISH_PHOTOS = {
  'Paneer Tikka': 'paneer-tikka.jpg',
  'Veg Spring Rolls': 'veg-spring-rolls.jpg',
  'Chicken 65': 'chicken-65.jpg',
  'Tandoori Chicken': 'tandoori-chicken.jpg',
  'Hara Bhara Kebab': 'hara-bhara-kebab.jpg',
  'Butter Chicken': 'butter-chicken.jpg',
  'Veg Biryani': 'veg-biryani.jpg',
  'Dal Makhani': 'dal-makhani.jpg',
  'Palak Paneer': 'palak-paneer.jpg',
  'Chicken Biryani': 'chicken-biryani.jpg',
  'Butter Naan': 'butter-naan.jpg',
  'Garlic Naan': 'garlic-naan.jpg',
  'Laccha Paratha': 'laccha-paratha.jpg',
  'Gulab Jamun': 'gulab-jamun.jpg',
  'Rasmalai': 'rasmalai.jpg',
  'Masala Chai': 'masala-chai.jpg',
  'Mango Lassi': 'mango-lassi.jpg',
  'Fresh Lime Soda': 'fresh-lime-soda.jpg',
  'Cold Coffee': 'cold-coffee.jpg',
};

// The dining room
const TABLES = [
  { name: 'T1', seats: 2, area: 'Main hall' },
  { name: 'T2', seats: 4, area: 'Main hall' },
  { name: 'T3', seats: 4, area: 'Main hall' },
  { name: 'T4', seats: 6, area: 'Main hall' },
  { name: 'T5', seats: 2, area: 'Main hall' },
  { name: 'T6', seats: 4, area: 'Main hall' },
  { name: 'T7', seats: 2, area: 'Terrace' },
  { name: 'T8', seats: 4, area: 'Terrace' },
  { name: 'T9', seats: 4, area: 'Terrace' },
  { name: 'P1', seats: 12, area: 'Private room' },
];

// Tables that are booked for later today
const RESERVED_TABLES = ['T4', 'P1'];

const CUSTOMER_NAMES = [
  'Aarav Sharma', 'Priya Nair', 'Rohan Mehta', 'Ananya Iyer', 'Kabir Singh', 'Meera Joshi',
  'Vikram Rao', 'Sneha Kulkarni', 'Arjun Das', 'Isha Kapoor', 'Rahul Verma', 'Nisha Patel',
  'Aditya Menon', 'Pooja Reddy', 'Karan Malhotra', 'Divya Pillai',
];

// How popular each dish is (a higher number is ordered more often)
const POPULARITY = {
  'Butter Chicken': 9, 'Chicken Biryani': 8, 'Paneer Tikka': 7, 'Butter Naan': 9, 'Mango Lassi': 6,
  'Dal Makhani': 6, 'Veg Biryani': 5, 'Garlic Naan': 5, 'Tandoori Chicken': 5, 'Masala Chai': 5,
  'Palak Paneer': 4, 'Gulab Jamun': 4, 'Cold Coffee': 4, 'Veg Spring Rolls': 3, 'Chicken 65': 3,
  'Laccha Paratha': 3, 'Fresh Lime Soda': 3, 'Rasmalai': 2, 'Hara Bhara Kebab': 2,
};

// A tiny random number generator with a fixed starting point,
// so the sample orders are the same every time the setup runs.
function createRandom(seed) {
  let value = seed;
  return function random() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

// Builds about two weeks of sample orders, ending with a few still in the kitchen.
//   dishes - rows from food_items ({ id, name, price })
//   tables - rows from restaurant_tables ({ id, name })
// Returns [{ created_at, customer_name, order_type, table_id, status, promo_code, lines: [...] }]
function buildSampleOrders(dishes, tables) {
  const random = createRandom(42);
  const pick = (list) => list[Math.floor(random() * list.length)];

  // A weighted list: popular dishes appear in it more times
  const weighted = [];
  dishes.forEach((dish) => {
    const weight = POPULARITY[dish.name] || 2;
    for (let i = 0; i < weight; i++) weighted.push(dish);
  });

  const diningTables = tables.filter((table) => !RESERVED_TABLES.includes(table.name));
  const now = new Date();
  const orders = [];

  function makeLines() {
    const lineCount = 1 + Math.floor(random() * 4); // 1 to 4 different dishes
    const lines = [];
    while (lines.length < lineCount) {
      const dish = pick(weighted);
      if (lines.some((line) => line.food_item_id === dish.id)) continue;
      lines.push({
        food_item_id: dish.id,
        item_name: dish.name,
        unit_price: Number(dish.price),
        quantity: 1 + Math.floor(random() * (dish.price < 100 ? 3 : 2)),
      });
    }
    return lines;
  }

  function makeOrder(createdAt, status) {
    const typeRoll = random();
    const orderType = typeRoll < 0.6 ? 'dine_in' : typeRoll < 0.85 ? 'takeaway' : 'delivery';
    return {
      created_at: createdAt,
      customer_name: random() < 0.8 ? pick(CUSTOMER_NAMES) : null,
      order_type: orderType,
      table_id: orderType === 'dine_in' ? pick(diningTables).id : null,
      status,
      promo_code: random() < 0.12 ? 'WELCOME10' : null,
      lines: makeLines(),
    };
  }

  // The 13 days before today: lunch and dinner service, busier at weekends
  for (let daysAgo = 13; daysAgo >= 1; daysAgo--) {
    const day = new Date(now);
    day.setDate(now.getDate() - daysAgo);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const orderCount = (isWeekend ? 6 : 3) + Math.floor(random() * 4);

    for (let i = 0; i < orderCount; i++) {
      const createdAt = new Date(day);
      const hour = random() < 0.45 ? 12 + Math.floor(random() * 3) : 19 + Math.floor(random() * 4);
      createdAt.setHours(hour, Math.floor(random() * 60), 0, 0);
      orders.push(makeOrder(createdAt, random() < 0.08 ? 'cancelled' : 'completed'));
    }
  }

  // Today: orders every 40 minutes up to now. The newest ones are still being worked on.
  const todayStatuses = ['completed', 'completed', 'completed', 'cancelled', 'ready', 'preparing', 'preparing', 'pending', 'pending'];
  todayStatuses.forEach((status, index) => {
    const minutesAgo = (todayStatuses.length - index) * 40 - 25;
    const createdAt = new Date(now.getTime() - minutesAgo * 60 * 1000);
    orders.push(makeOrder(createdAt, status));
  });

  // Two active dine-in orders must not share a table
  const usedTables = new Set();
  orders
    .filter((order) => ['pending', 'preparing', 'ready'].includes(order.status) && order.order_type === 'dine_in')
    .forEach((order) => {
      const freeTable = diningTables.find((table) => !usedTables.has(table.id));
      order.table_id = freeTable ? freeTable.id : null;
      if (!freeTable) order.order_type = 'takeaway';
      usedTables.add(order.table_id);
    });

  return orders;
}

module.exports = { EXTRA_DISHES, DISH_PHOTOS, TABLES, RESERVED_TABLES, buildSampleOrders };
