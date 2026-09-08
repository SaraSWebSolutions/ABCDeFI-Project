import express from 'express';

const router = express.Router();

// Mock database storage
const whitelistDb = new Map();
const kycDb = new Map();
const referralDb = new Map();
const userPurchasesDb = new Map();

/**
 * GET /api/presale/stats
 * Fetch presale stage metrics and user allocation
 */
router.get('/stats', (req, res) => {
  const wallet = String(req.query.wallet || '').toLowerCase();
  const userAlloc = userPurchasesDb.get(wallet) || { totalTokens: 125000, bonusTokens: 3750 };

  res.json({
    success: true,
    stats: {
      currentStage: 2,
      currentPriceUsd: 0.01,
      nextPriceUsd: 0.015,
      listingTargetUsd: 0.03,
      raisedUsd: 1842500,
      targetUsd: 5000000,
      userAlloc,
    },
  });
});

/**
 * POST /api/presale/buy
 * Execute presale token purchase
 */
router.post('/buy', (req, res) => {
  const { wallet, usdAmount } = req.body;
  const numUsd = Number(usdAmount) || 0;

  if (numUsd <= 0) {
    return res.status(400).json({ success: false, message: 'Valid USD amount required' });
  }

  const currentPrice = 0.01;
  const baseTokens = numUsd / currentPrice;

  let bonusPct = 0;
  if (baseTokens >= 10000000) bonusPct = 0.03;
  if (baseTokens >= 50000000) bonusPct = 0.05;

  const bonusTokens = baseTokens * bonusPct;
  const totalReceived = baseTokens + bonusTokens;

  const normalizedWallet = String(wallet || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8').toLowerCase();
  const existing = userPurchasesDb.get(normalizedWallet) || { totalTokens: 125000, bonusTokens: 3750 };

  const updatedAlloc = {
    totalTokens: existing.totalTokens + totalReceived,
    bonusTokens: existing.bonusTokens + bonusTokens,
  };
  userPurchasesDb.set(normalizedWallet, updatedAlloc);

  return res.json({
    success: true,
    message: `Successfully purchased ${totalReceived.toLocaleString()} ABCD tokens`,
    purchase: {
      usdAmount: numUsd,
      baseTokens,
      bonusTokens,
      totalReceived,
      txHash: `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/presale/whitelist/:address
 * Check whitelist status for a wallet address
 */
router.get('/whitelist/:address', (req, res) => {
  const { address } = req.params;
  const normalized = address.toLowerCase();
  const isWhitelisted = whitelistDb.get(normalized) || false;
  return res.json({ success: true, address, isWhitelisted });
});

/**
 * POST /api/presale/whitelist
 * Admin endpoint to update whitelist addresses
 */
router.post('/whitelist', (req, res) => {
  const { addresses, status } = req.body;
  if (!Array.isArray(addresses)) {
    return res.status(400).json({ success: false, message: 'Addresses must be an array' });
  }

  addresses.forEach((addr) => {
    whitelistDb.set(addr.toLowerCase(), Boolean(status));
  });

  return res.json({
    success: true,
    message: `Updated ${addresses.length} addresses whitelist status to ${Boolean(status)}`,
  });
});

/**
 * GET /api/presale/kyc/:address
 * Fetch user KYC verification status
 */
router.get('/kyc/:address', (req, res) => {
  const { address } = req.params;
  const normalized = address.toLowerCase();
  const kycData = kycDb.get(normalized) || { status: 'NOT_SUBMITTED', tier: 0 };
  return res.json({ success: true, address, kyc: kycData });
});

/**
 * POST /api/presale/kyc/submit
 * Submit user KYC details
 */
router.post('/kyc/submit', (req, res) => {
  const { address, fullName, country, idDocument } = req.body;
  if (!address || !fullName || !country) {
    return res.status(400).json({ success: false, message: 'Missing required KYC fields' });
  }

  const normalized = address.toLowerCase();
  const record = {
    fullName,
    country,
    idDocument: idDocument || 'PENDING_UPLOAD',
    status: 'VERIFIED',
    tier: 1,
    updatedAt: new Date().toISOString(),
  };

  kycDb.set(normalized, record);
  whitelistDb.set(normalized, true); // Auto-whitelist upon verified KYC

  return res.json({ success: true, message: 'KYC verified successfully', kyc: record });
});

/**
 * POST /api/presale/referral/generate
 * Generate referral code for user wallet
 */
router.post('/referral/generate', (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ success: false, message: 'Address required' });
  }

  const normalized = address.toLowerCase();
  let code = referralDb.get(normalized);
  if (!code) {
    code = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    referralDb.set(normalized, code);
  }

  return res.json({ success: true, address, referralCode: code });
});

export default router;
