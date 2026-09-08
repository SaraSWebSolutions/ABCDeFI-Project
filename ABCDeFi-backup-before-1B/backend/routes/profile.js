import express from 'express';

const router = express.Router();

/**
 * Phase 6 — Profile APIs
 * GET  /api/profile/me           — Fetch authenticated user profile
 * PUT  /api/profile/update       — Update display name / avatar
 * GET  /api/profile/kyc-status   — KYC verification status
 * GET  /api/profile/activity     — Recent on-chain activity
 */

/**
 * GET /api/profile/me
 * Returns full user profile including KYC, wallet, and eLIC details
 */
router.get('/me', (req, res) => {
  res.json({
    success: true,
    data: {
      userId: 'USR-10042',
      name: 'Dinesh Kumar',
      email: 'd.kumar@example.com',
      avatar: null,
      country: 'India',
      nationality: 'Indian',
      registeredAt: '2026-07-01T09:15:00Z',
      wallet: {
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        connected: true,
        network: 'Ethereum Sepolia',
      },
      kyc: {
        status: 'Approved',          // Pending | In Review | Approved | Rejected
        provider: 'Sumsub',
        completedAt: '2026-07-02T11:00:00Z',
        nationalId: 'XXXX-XXXX-8921',
        dob: '14-Mar-1990',
        address: '123 Tech Park, Block C, Bangalore, Karnataka, India 560001',
      },
      aml: {
        status: 'Cleared',
        checkedAt: '2026-07-02T11:05:00Z',
        riskLevel: 'Low',
      },
      financials: {
        onChainScore: 720,
        riskProfile: 'Medium Risk',
        totalLoans: 8,
        activeLoans: 1,
        defaults: 0,
        repaymentRate: 100,
        totalLent: 5000,
        monthlyIncome: 2000,
        currency: 'ABCD',
      },
      legion: {
        rank: 'ABCD Master',
        level: 4,
        referrals: 12,
        teamSize: 48,
        commissionRate: '8%',
      },
    },
  });
});

/**
 * PUT /api/profile/update
 * Update user display name or avatar
 * Body: { name?, avatar? }
 */
router.put('/update', (req, res) => {
  const { name, avatar } = req.body;

  if (!name && !avatar) {
    return res.status(400).json({ success: false, message: 'Provide at least name or avatar to update' });
  }

  return res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      name: name || 'Dinesh Kumar',
      avatar: avatar || null,
      updatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/profile/kyc-status
 * Returns detailed KYC verification status for the user
 */
router.get('/kyc-status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'Approved',
      provider: 'Sumsub',
      steps: [
        { step: 'Identity Document', status: 'Passed', completedAt: '2026-07-02T10:45:00Z' },
        { step: 'Face Match / Selfie', status: 'Passed', completedAt: '2026-07-02T10:47:00Z' },
        { step: 'Liveness Check', status: 'Passed', completedAt: '2026-07-02T10:48:00Z' },
        { step: 'AML Screening', status: 'Passed', completedAt: '2026-07-02T11:05:00Z' },
      ],
      verifiedFields: {
        fullName: 'Dinesh Kumar',
        dob: '14-Mar-1990',
        nationality: 'Indian',
        documentType: 'National ID Card',
        documentNumber: 'XXXX-XXXX-8921',
        address: '123 Tech Park, Block C, Bangalore, Karnataka, India 560001',
      },
      completedAt: '2026-07-02T11:05:00Z',
    },
  });
});

/**
 * GET /api/profile/activity
 * Returns user's recent on-chain and platform activity
 */
router.get('/activity', (req, res) => {
  res.json({
    success: true,
    data: {
      totalTransactions: 23,
      activity: [
        {
          id: 'TXN-001',
          type: 'EMI Payment',
          description: 'Monthly EMI for LOAN-1001',
          amount: 87.5,
          currency: 'ABCD',
          status: 'Confirmed',
          date: '2026-07-31T09:00:00Z',
          txHash: '0xdef789...abc123',
        },
        {
          id: 'TXN-002',
          type: 'Collateral Lock',
          description: '2 ETH locked as collateral for LOAN-1001',
          amount: 2,
          currency: 'ETH',
          status: 'Confirmed',
          date: '2026-07-14T15:30:00Z',
          txHash: '0x123abc...def789',
        },
        {
          id: 'TXN-003',
          type: 'KYC Bonus',
          description: 'KYC completion reward',
          amount: 50,
          currency: 'ABCD',
          status: 'Claimed',
          date: '2026-07-02T11:10:00Z',
          txHash: '0xabc456...789def',
        },
        {
          id: 'TXN-004',
          type: 'ICO Purchase',
          description: 'Stage 1 ABCD token purchase',
          amount: 1000,
          currency: 'ABCD',
          status: 'Confirmed',
          date: '2026-07-01T10:00:00Z',
          txHash: '0x789def...abc456',
        },
      ],
    },
  });
});

export default router;
