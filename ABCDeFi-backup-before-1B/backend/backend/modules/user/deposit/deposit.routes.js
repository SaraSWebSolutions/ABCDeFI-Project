const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/authMiddleware');
const depositController = require('./deposit.controller');

// POST /api/deposits
router.post('/', auth, depositController.createDeposit);

// GET /api/deposits
router.get('/', auth, depositController.getDeposits);

module.exports = router;
