const express = require('express');
const router = express.Router();
const { getStats } = require('../utils/stats');

// GET /api/stats — umumiy statistika
router.get('/', (req, res) => {
  res.json({ success: true, stats: getStats() });
});

module.exports = router;
