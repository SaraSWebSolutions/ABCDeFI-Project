const express = require('express');

const router = express.Router();

const unavailable = (_req, res) => res.status(503).json({
  success: false,
  message: 'This legacy presale API is disabled. Use the canonical deployed Presale contract and authenticated KYC provider flow.',
});

router.get('/stats', unavailable);
router.get('/whitelist/:address', unavailable);
router.post('/whitelist', unavailable);
router.get('/kyc/:address', unavailable);
router.post('/kyc/submit', unavailable);
router.post('/referral/generate', unavailable);

module.exports = router;
