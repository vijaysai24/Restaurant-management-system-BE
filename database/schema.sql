-- ============================================================
-- Restaurant Management System - Database Tables
-- ============================================================
-- Run automatically by "npm run setup-db".
-- You can also paste this into pgAdmin's Query Tool and run it.
--
-- "IF NOT EXISTS" means running this file again will NOT delete your data.

-- One category (for example "Desserts") can have many food items.
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,               -- auto-increasing number: 1, 2, 3...
  name        VARCHAR(100) NOT NULL UNIQUE,     -- two categories cannot have the same name
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Every food item belongs to exactly one category.
CREATE TABLE IF NOT EXISTS food_items (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  description  TEXT,

  -- Foreign key: must match an id in the categories table.
  -- ON DELETE RESTRICT stops a category from being deleted while it still has food items.
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,

  price        NUMERIC(10, 2) NOT NULL CHECK (price >= 0),  -- e.g. 249.50
  image_url    TEXT,                                        -- optional link to a picture
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Restaurant operations: tables, orders and the dishes in each order
-- ============================================================

-- Dining tables. Named "restaurant_tables" because TABLE is a SQL keyword.
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL UNIQUE,                   -- e.g. "T1"
  seats      INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 50),
  area       VARCHAR(50) NOT NULL DEFAULT 'Main hall',      -- e.g. "Terrace"
  status     VARCHAR(20) NOT NULL DEFAULT 'available'
             CHECK (status IN ('available', 'occupied', 'reserved')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per customer order. Money is calculated by the server, never trusted from the browser.
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(100),                               -- empty for walk-in customers
  order_type    VARCHAR(20) NOT NULL
                CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),

  -- ON DELETE SET NULL: deleting a table keeps its old orders
  table_id      INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL,

  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal      NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  discount      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax           NUMERIC(10, 2) NOT NULL CHECK (tax >= 0),
  total         NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  promo_code    VARCHAR(30),
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The dishes inside an order. The name and price are copied at the time of ordering,
-- so old orders stay correct even if a dish is renamed, repriced or deleted later.
CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_item_id INTEGER REFERENCES food_items(id) ON DELETE SET NULL,
  item_name    VARCHAR(150) NOT NULL,
  unit_price   NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity     INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100)
);

-- Reports filter orders by date, so an index on created_at keeps them fast
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
