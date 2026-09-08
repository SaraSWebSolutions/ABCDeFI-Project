import express from 'express';

const router = express.Router();

/**
 * Phase 6 — Reward & Bonus APIs
 * GET  /api/reward/status        — Check if user has claimed ICO bonus
 * POST /api/reward/claim         — Claim ICO referral / staking bonus
 * GET  /api/reward/leaderboard   — Top earners leaderboard
 * GET  /api/reward/history       — User reward transaction history
 */

// Mock reward pool
const mockRewards = {
  pool: 500000,
  distributed: 128450,
  topEarners: [
    { rank: 1, name: 'Dinesh K.', wallet: '0x7099...79C8', earned: 4250, badge: '🥇' },
    { rank: 2, name: 'Elena R.', wallet: '0x3C44...93BC', earned: 3800, badge: '🥈' },
    { rank: 3, name: 'Arjun M.', wallet: '0xdF3d...B592', earned: 3120, badge: '🥉' },
    { rank: 4, name: 'Priya S.', wallet: '0x7099...aB12', earned: 2900, badge: '⭐' },
    { rank: 5, name: 'Rafael T.', wallet: '0x5a22...cC99', earned: 2650, badge: '⭐' },
  ],
};

/**
 * GET /api/reward/status
 * Returns whether KYC bonus has been claimed and available rewards
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      kycBonusClaimed: false,
      kycBonusAmount: 50,        // ABCD tokens for completing KYC
      referralBonusAvailable: 120,
      stakingRewardsPending: 87.5,
      totalClaimable: 257.5,
      currency: 'ABCD',
      nextClaimDate: null,       // null means claimable now
    },
  });
});

/**
 * POST /api/reward/claim
 * Claim available bonus rewards
 * Body: { type: 'kyc' | 'referral' | 'staking', walletAddress }
 */
router.post('/claim', (req, res) => {
  const { type, walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ success: false, message: 'Wallet address required' });
  }

  const claimAmounts = {
    kyc: 50,
    referral: 120,
    staking: 87.5,
  };

  const amount = claimAmounts[type] || 0;
  if (!amount) {
    return res.status(400).json({ success: false, message: 'Invalid reward type' });
  }

  return res.json({
    success: true,
    message: `${type.toUpperCase()} reward of ${amount} ABCD claimed successfully`,
    data: {
      type,
      amount,
      currency: 'ABCD',
      walletAddress,
      txHash: `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`,
      claimedAt: new Date().toISOString(),
      status: 'Confirmed',
    },
  });
});

/**
 * GET /api/reward/leaderboard
 * Returns top earners in the ABCDeFi ecosystem
 */
router.get('/leaderboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalPool: mockRewards.pool,
      distributed: mockRewards.distributed,
      remaining: mockRewards.pool - mockRewards.distributed,
      leaderboard: mockRewards.topEarners,
      lastUpdated: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/reward/history
 * Returns user's reward transaction history
 */
router.get('/history', (req, res) => {
  res.json({
    success: true,
    data: {
      totalEarned: 257.5,
      currency: 'ABCD',
      history: [
        {
          id: 'RWD-001',
          type: 'KYC Bonus',
          amount: 50,
          status: 'Claimed',
          date: '2026-07-01T10:23:00Z',
          txHash: '0xabc123...def456',
        },
        {
          id: 'RWD-002',
          type: 'Staking Reward',
          amount: 87.5,
          status: 'Pending Claim',
          date: '2026-07-15T08:00:00Z',
          txHash: null,
        },
        {
          id: 'RWD-003',
          type: 'Referral Bonus',
          amount: 120,
          status: 'Pending Claim',
          date: '2026-07-20T14:30:00Z',
          txHash: null,
        },
      ],
    },
  });
});

export default router;
