const express = require('express');
const auth = require('../../middleware/authMiddleware');
const { getDashboardSummary } = require('./dashboard.controller');

const router = express.Router();
router.get('/summary', auth, getDashboardSummary);

module.exports = router;
