// routes/tableRoutes.js
// Connects each dining table URL to the controller function that handles it.
// These paths are added after "/api/tables" (see server.js).

const express = require('express');
const {
  getAllTables,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
} = require('../controllers/tableController');

const router = express.Router();

router.get('/', getAllTables);                   // GET    /api/tables
router.post('/', createTable);                   // POST   /api/tables
router.put('/:id', updateTable);                 // PUT    /api/tables/5
router.patch('/:id/status', updateTableStatus);  // PATCH  /api/tables/5/status
router.delete('/:id', deleteTable);              // DELETE /api/tables/5

module.exports = router;
