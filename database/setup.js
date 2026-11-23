// database/setup.js
// Setup script. Run it with:  npm run setup-db
//
// What it does (every step is safe to run again; it never deletes your data):
//   1. Creates the database (restaurant_db) if it does not exist yet.
//   2. Creates the tables from schema.sql.
//   3. Adds the sample categories and food items from seed.sql (only if there are no categories yet).
//   4. Adds the extra sample dishes and photos (only the ones that are missing).
//   5. Adds the sample dining tables (only if there are none).
//   6. Adds about two weeks of sample orders (only if there are no orders yet).

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { calculateOrderTotals, PROMO_CODES } = require('../config/pricing');
const { EXTRA_DISHES, DISH_PHOTOS, TABLES, RESERVED_TABLES, buildSampleOrders } = require('./sampleData');

const databaseName = process.env.DB_NAME || 'restaurant_db';

// Where the dish photos are stored (served by the React app at /images/menu/...)
const PHOTO_FOLDER = path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'menu');

// Step 1: Create the database if it is missing.
// We connect to the default "postgres" database first, because we cannot
// connect to restaurant_db before it exists.
async function createDatabaseIfMissing() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  await client.connect();

  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

  if (result.rowCount === 0) {
    // A database name cannot be passed as a $1 parameter,
    // so we escape it safely with escapeIdentifier().
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(databaseName)}`);
    console.log(`Created database "${databaseName}"`);
  } else {
    console.log(`Database "${databaseName}" already exists`);
  }

  await client.end();
}

// Steps 2 and 3: Create tables and add the sample menu.
async function createTablesAndMenu(pool) {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schemaSql);
  console.log('Tables are ready: categories, food_items, restaurant_tables, orders, order_items');

  const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM categories');

  if (countResult.rows[0].total === 0) {
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await pool.query(seedSql);
    console.log('Sample categories and food items added');
  } else {
    console.log('Categories already exist, seed.sql was skipped');
  }
}

// Step 4: Extra dishes and photos.
async function addExtraDishesAndPhotos(pool) {
  let added = 0;
  for (const dish of EXTRA_DISHES) {
    // Only add the dish if its category exists and no dish with this name exists yet
    const result = await pool.query(
      // (::text and ::numeric tell PostgreSQL the type of each value, because $1 is used twice)
      `INSERT INTO food_items (name, description, category_id, price, is_available)
       SELECT $1::text, $2::text, categories.id, $4::numeric, TRUE
       FROM categories
       WHERE categories.name = $3::text
         AND NOT EXISTS (SELECT 1 FROM food_items WHERE LOWER(name) = LOWER($1::text))`,
      [dish.name, dish.description, dish.category, dish.price]
    );
    added += result.rowCount;
  }
  console.log(added > 0 ? `${added} extra sample dishes added` : 'Extra sample dishes already exist');

  let photos = 0;
  for (const [dishName, fileName] of Object.entries(DISH_PHOTOS)) {
    if (!fs.existsSync(path.join(PHOTO_FOLDER, fileName))) continue;

    // Only fill in a photo where the dish has none, so your own pictures are never replaced
    const result = await pool.query(
      `UPDATE food_items SET image_url = $1
       WHERE name = $2 AND (image_url IS NULL OR image_url = '')`,
      [`/images/menu/${fileName}`, dishName]
    );
    photos += result.rowCount;
  }
  console.log(photos > 0 ? `Photos added to ${photos} dishes` : 'No new dish photos to add');
}

// Step 5: Dining tables.
async function addTables(pool) {
  const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM restaurant_tables');
  if (countResult.rows[0].total > 0) {
    console.log('Dining tables already exist, sample tables were skipped');
    return;
  }

  for (const table of TABLES) {
    const status = RESERVED_TABLES.includes(table.name) ? 'reserved' : 'available';
    await pool.query(
      'INSERT INTO restaurant_tables (name, seats, area, status) VALUES ($1, $2, $3, $4)',
      [table.name, table.seats, table.area, status]
    );
  }
  console.log(`${TABLES.length} sample dining tables added`);
}

// Step 6: Sample orders.
async function addOrders(pool) {
  const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM orders');
  if (countResult.rows[0].total > 0) {
    console.log('Orders already exist, sample orders were skipped');
    return;
  }

  const dishes = (await pool.query('SELECT id, name, price FROM food_items')).rows;
  const tables = (await pool.query('SELECT id, name FROM restaurant_tables')).rows;
  if (dishes.length === 0 || tables.length === 0) {
    console.log('No dishes or tables yet, sample orders were skipped');
    return;
  }

  const orders = buildSampleOrders(dishes, tables);

  for (const order of orders) {
    const totals = calculateOrderTotals(order.lines, order.promo_code ? PROMO_CODES[order.promo_code] : 0);

    const orderResult = await pool.query(
      `INSERT INTO orders
         (customer_name, order_type, table_id, status, subtotal, discount, tax, total, promo_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [
        order.customer_name,
        order.order_type,
        order.table_id,
        order.status,
        totals.subtotal,
        totals.discount,
        totals.tax,
        totals.total,
        order.promo_code,
        order.created_at,
      ]
    );

    for (const line of order.lines) {
      await pool.query(
        `INSERT INTO order_items (order_id, food_item_id, item_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderResult.rows[0].id, line.food_item_id, line.item_name, line.unit_price, line.quantity]
      );
    }
  }

  // Tables with an order still in the kitchen have guests sitting at them
  await pool.query(
    `UPDATE restaurant_tables SET status = 'occupied'
     WHERE id IN (SELECT table_id FROM orders
                  WHERE table_id IS NOT NULL AND status IN ('pending', 'preparing', 'ready'))`
  );

  console.log(`${orders.length} sample orders added`);
}

async function setup() {
  try {
    await createDatabaseIfMissing();

    // Load the shared connection pool (it connects to restaurant_db)
    const pool = require('../config/db');

    await createTablesAndMenu(pool);
    await addExtraDishesAndPhotos(pool);
    await addTables(pool);
    await addOrders(pool);

    await pool.end();
    console.log('Database setup complete!');
  } catch (error) {
    console.error('Database setup failed:', error.message);
    console.error('Check that PostgreSQL is running and the values in your .env file are correct.');
    process.exit(1);
  }
}

setup();
