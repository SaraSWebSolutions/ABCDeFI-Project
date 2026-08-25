const { getWalletNonce, verifyAndLinkWallet, getWalletStatus } = require('./wallet.controller');
const auth = require('../../../middleware/authMiddleware');
const express = require('express');

const router = express.Router();

// Request a nonce for wallet signature verification
router.post('/nonce', auth, getWalletNonce);

// Verify signed nonce and bind wallet to user account
router.post('/verify', auth, verifyAndLinkWallet);

// Canonical backend source for the wallet-link state shown in the frontend.
router.get('/status', auth, getWalletStatus);

module.exports = router;
