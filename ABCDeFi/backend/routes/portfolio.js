import express from 'express';
import workflow from '../services/lendingWorkflow.cjs';

const router = express.Router();
const { getPortfolioSummary } = workflow;

/**
 * Phase 2 & 5 — Portfolio APIs
 * GET /portfolio
 * GET /portfolio/analytics
 */

router.get('/', (req, res) => {
  const walletAddress = req.query.walletAddress || req.headers['x-wallet-address'];
  res.json({
    success: true,
    ...getPortfolioSummary(walletAddress || ''),
  });
});

router.get('/analytics', (req, res) => {
  const walletAddress = req.query.walletAddress || req.headers['x-wallet-address'];
  const summary = getPortfolioSummary(walletAddress || '');
  res.json({
    success: true,
    netWorthGraph: [
      { month: 'Jan', value: summary.totalPortfolioUSD - 5000 },
      { month: 'Feb', value: summary.totalPortfolioUSD - 3000 },
      { month: 'Mar', value: summary.totalPortfolioUSD - 1000 },
      { month: 'Apr', value: summary.totalPortfolioUSD - 500 },
      { month: 'May', value: summary.totalPortfolioUSD },
    ],
    assetAllocation: [
      { asset: 'ABCD Tokens', pct: 45 },
      { asset: 'ETH Collateral', pct: 35 },
      { asset: 'USDC Reserve', pct: 20 },
    ],
  });
});

export default router;
