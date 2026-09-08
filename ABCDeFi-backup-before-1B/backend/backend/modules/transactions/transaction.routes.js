const express = require('express');
const auth = require('../../middleware/authMiddleware');
const { getCurrentWalletHistory } = require('./transaction.controller');

const router = express.Router();

// The requested wallet must be the authenticated user's explicitly verified
// wallet. This endpoint never accepts an arbitrary address for account history.
router.get('/', auth, getCurrentWalletHistory);

module.exports = router;
