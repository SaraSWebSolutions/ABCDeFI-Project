// ============================================================================
// ⚠️ UI DEVELOPMENT MOCK SERVER — NOT FOR PRODUCTION
// The real production authentication and user backend is in:
// backend/backend/
// ============================================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import presaleRouter from './routes/presale.js';
import aiRouter from './routes/ai.js';
import authRouter from './routes/auth.js';
import kycRouter from './routes/kyc.js';
import loanRouter from './routes/loan.js';
import marketplaceRouter from './routes/marketplace.js';
import portfolioRouter from './routes/portfolio.js';
import nftRouter from './routes/nft.js';
import reportsRouter from './routes/reports.js';
import rewardRouter from './routes/reward.js';
import profileRouter from './routes/profile.js';
import notificationsRouter from './routes/notifications.js';
import walletRouter from './routes/wallet.js';
import { startEventListener } from './services/eventListener.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'ABCDeFi Backend API', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/presale', presaleRouter);
app.use('/api/ai', aiRouter);
app.use('/auth', authRouter);
app.use('/api/auth', authRouter);
app.use('/kyc', kycRouter);
app.use('/api/kyc', kycRouter);
app.use('/loan', loanRouter);
app.use('/api/loan', loanRouter);
app.use('/marketplace', marketplaceRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/portfolio', portfolioRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/nfts', nftRouter);
app.use('/api/nfts', nftRouter);
app.use('/reports', reportsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/reward', rewardRouter);
app.use('/api/profile', profileRouter);
app.use('/notifications', notificationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/wallet', walletRouter);
app.use('/api/wallet', walletRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 ABCDeFi Backend Server running on port ${PORT}`);
  console.log(`==================================================`);

  // Optionally initialize event listener if RPC URL is provided
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const addresses = {
    Presale: process.env.PRESALE_ADDRESS || '',
    StakingPool: process.env.STAKING_ADDRESS || '',
    TokenVesting: process.env.VESTING_ADDRESS || '',
  };

  try {
    startEventListener(rpcUrl, addresses);
  } catch (err) {
    console.error('Failed to start event listener:', err.message);
  }
});
