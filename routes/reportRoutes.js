// routes/reportRoutes.js
// Sales reports. These paths are added after "/api/reports" (see server.js).

const express = require('express');
const { getSalesSummary } = require('../controllers/reportController');

const router = express.Router();

router.get('/summary', getSalesSummary);  // GET /api/reports/summary?days=7

module.exports = router;
