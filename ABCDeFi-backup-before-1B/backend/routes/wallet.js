import express from 'express';

const router = express.Router();

/**
 * Phase 2 & 3 — Wallet APIs
 * GET /api/wallet
 * POST /api/wallet/deposit
 * POST /api/wallet/withdraw
 */

router.get('/', (req, res) => {
  res.json({
    success: true,
    balances: {
      abcd: 1250,
      eth: 3.0,
      usdc: 800,
      nftsCount: 4,
    },
    usdTotal: 24850,
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  });
});

router.post('/deposit', (req, res) => {
  const { token = 'ABCD', amount = 0, wallet } = req.body;
  res.json({
    success: true,
    message: `Deposited ${amount} ${token} from ${wallet || 'connected wallet'}`,
    txHash: `0x${Math.random().toString(16).substring(2, 42)}`,
  });
});

router.post('/withdraw', (req, res) => {
  const { token = 'ABCD', amount = 0, destination } = req.body;
  res.json({
    success: true,
    message: `Withdrew ${amount} ${token} to ${destination || 'destination wallet'}`,
    txHash: `0x${Math.random().toString(16).substring(2, 42)}`,
  });
});

export default router;
