// config/db.js
// Creates the connection to the PostgreSQL database.
//
// We use a "pool" instead of a single connection. A pool keeps a few
// connections open and reuses them, which is faster than opening a new
// connection for every request.
//
// The values come from the .env file, so the password is not written in the code.

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'restaurant_db',
});

// If an idle connection breaks (for example, the database restarts),
// log the problem instead of crashing the whole server.
pool.on('error', (error) => {
  console.error('Unexpected database error:', error.message);
});

module.exports = pool;
