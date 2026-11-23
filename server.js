// server.js
// Entry point of the backend.
// It creates the Express app, adds middleware, connects the routes and starts the server.

// Load settings (database password, port, ...) from the .env file into process.env
require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const categoryRoutes = require('./routes/categoryRoutes');
const foodItemRoutes = require('./routes/foodItemRoutes');
const orderRoutes = require('./routes/orderRoutes');
const tableRoutes = require('./routes/tableRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware (runs before every route) ----------

// Allow the React app, which runs on a different port, to call this API
app.use(cors());

// Read JSON data from the request body and make it available as req.body
app.use(express.json());

// ---------- Routes ----------

// A simple check to confirm the API is running
app.get('/', (req, res) => {
  res.json({ message: 'Restaurant Management System API is running' });
});

app.use('/api/categories', categoryRoutes);
app.use('/api/food-items', foodItemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/reports', reportRoutes);

// Any URL that did not match a route above
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Catches unexpected errors, for example invalid JSON sent in the request body.
// Express knows this is an error handler because it has 4 parameters.
app.use((error, req, res, next) => {
  console.error('Unexpected error:', error.message);
  const status = error.status || 500;
  res.status(status).json({
    message: status === 400 ? 'Invalid data sent to the server' : 'Something went wrong on the server',
  });
});

// ---------- Start the server ----------

app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  // Check the database connection once, so problems are visible straight away
  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL database');
  } catch (error) {
    console.error('Could not connect to PostgreSQL:', error.message);
    console.error('Check the database settings in your .env file.');
  }
});
