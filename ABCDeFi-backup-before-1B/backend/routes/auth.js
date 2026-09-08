// ============================================================================
// ⚠️ UI DEVELOPMENT MOCK — NOT FOR PRODUCTION
// The real production authentication router is in:
// backend/backend/modules/user/userAccount/userAccount.routes.js
// ============================================================================

import express from 'express';
import workflow from '../services/lendingWorkflow.cjs';

const router = express.Router();
const { createUserProfile, getUserProfile } = workflow;

/**
 * Phase 1 — Authentication APIs
 * POST /auth/login
 * POST /auth/register
 * GET /auth/me
 */

router.post('/login', (req, res) => {
  const { email, walletAddress, password } = req.body;
  if (!email && !walletAddress) {
    return res.status(400).json({ success: false, message: 'Email or wallet address required' });
  }

  if (!password && !walletAddress) {
    return res.status(400).json({ success: false, message: 'Password required for email login' });
  }

  const user = getUserProfile(walletAddress || email) || createUserProfile({ email, walletAddress, name: req.body.name || 'ABCDeFi User' });
  const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ email: user.email, address: user.walletAddress, iat: Date.now() })).toString('base64')}.abcDeFiSignatureToken`;

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      kycStatus: user.kycStatus,
      creditScore: user.creditScore,
      reputation: user.reputation,
      country: user.country,
      amlStatus: user.kycStatus === 'approved' ? 'Passed' : 'Pending',
    },
  });
});

router.post('/register', (req, res) => {
  const { email, password, name, walletAddress, country } = req.body;
  if (!email || !walletAddress) {
    return res.status(400).json({ success: false, message: 'Email and wallet address are required' });
  }

  const user = createUserProfile({ email, password, name, walletAddress, country });
  res.json({
    success: true,
    message: 'User registered successfully. Proceed to KYC.',
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      country: user.country,
      kycStatus: user.kycStatus,
    },
  });
});

router.get('/me', (req, res) => {
  const walletAddress = req.query.walletAddress || req.headers['x-wallet-address'];
  const user = walletAddress ? getUserProfile(walletAddress) : null;

  res.json({
    success: true,
    user: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      country: user.country,
      kycStatus: user.kycStatus,
      creditScore: user.creditScore,
      reputation: user.reputation,
    } : {
      name: 'Dinesh Kumar',
      email: 'dinesh@abcdefi.io',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      country: 'India',
      kycStatus: 'approved',
    },
  });
});

export default router;
