import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// Import Lending & AI services from backend codebase
import lendingWorkflow from './backend/services/lendingWorkflow.js';
import * as aiService from './backend/services/aiService.js';
import connectDb from './backend/backend/config/db.js';
import UserRouter from './backend/backend/modules/user/userAccount/userAccount.routes.js';
import NFTRouter from './backend/backend/modules/nft/nft.routes.js';
import MarketplaceRouter from './backend/routes/marketplace.js';
import NotificationRouter from './backend/routes/notifications.js';
import { syncService } from './backend/services/syncService.js';

connectDb();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(express.json());

// Initialize Gemini API if key is present
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({ apiKey: key });
    }
  }
  return aiClient;
}

// In-memory presale state
const presaleState = {
  totalTokensForSale: 500000000, // 500M ABCD
  tokensSold: 184250000,
  raisedUsd: 1842500,
  targetUsd: 5000000,
  currentPriceUsd: 0.01,
  nextStagePriceUsd: 0.015,
  currentTier: 'Tier 2 (3% Volume Bonus)',
  userPurchases: new Map<string, { totalTokens: number; bonusTokens: number; spentUsd: number; claimed: boolean }>(),
};

// In-memory staking state
const stakingPools = [
  { id: 'pool-30', durationDays: 30, apy: 5, totalStaked: 1250000, lockPeriodMonths: 1 },
  { id: 'pool-90', durationDays: 90, apy: 12, totalStaked: 4800000, lockPeriodMonths: 3 },
  { id: 'pool-180', durationDays: 180, apy: 25, totalStaked: 12400000, lockPeriodMonths: 6 },
  { id: 'pool-365', durationDays: 365, apy: 40, totalStaked: 28900000, lockPeriodMonths: 12 },
];
const userStakes = new Map<string, Array<{ id: string; poolId: string; amount: number; stakedAt: string; lockedUntil: string; rewardsClaimed: number }>>();

// In-memory NFT marketplace state
const nftMarketplaceListings = [
  {
    id: 'nft-101',
    name: 'ABCDeFi Founder Guru NFT #001',
    category: 'Guru NFT',
    priceAbcd: 50000,
    priceUsd: 500,
    owner: '0x71C765...d897',
    rarity: 'Legendary',
    perks: ['20% Fee Reduction', 'Priority Loan Approvals', 'DAO Voting Weight 3x'],
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'nft-102',
    name: 'Reputation Score Badge (Score 780)',
    category: 'Reputation NFT',
    priceAbcd: 25000,
    priceUsd: 250,
    owner: '0x3A2190...81e2',
    rarity: 'Epic',
    perks: ['Low Collateral Threshold (70% LTV)', 'Discounted Interest Rates'],
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'nft-103',
    name: 'Barter RWA Asset #842 (Commercial Real Estate Vault)',
    category: 'Barter NFT',
    priceAbcd: 150000,
    priceUsd: 1500,
    owner: '0xF49012...12a4',
    rarity: 'Mythic',
    perks: ['Backed by $2,500 Collateral Property Vault', 'Secondary Loan Trading Rights'],
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop',
  },
];

// Seed initial loans if empty
try {
  const existingMarket = lendingWorkflow.getMarketplaceLoans();
  if (existingMarket.length === 0) {
    const demoWallet = '0x71c7656ec7ab88b098defb751b7401b5f6d8d897';
    lendingWorkflow.completeKyc(demoWallet, 'approved');
    
    lendingWorkflow.createLoanRequest({
      borrowerWallet: demoWallet,
      email: 'alex@abcdefi.io',
      name: 'Alex Vance',
      country: 'United States',
      amount: 10000,
      interestRate: 8.5,
      durationMonths: 12,
      collateral: '4.5 ETH',
      collateralValueUSD: 14000,
      ltv: 71.4,
      purpose: 'Liquidity for DeFi Yield Arbitrage',
    });

    lendingWorkflow.createLoanRequest({
      borrowerWallet: '0x3a219018428a9b19e081e2478f1211100f281200',
      email: 'sarah@abcdefi.io',
      name: 'Sarah Chen',
      country: 'Singapore',
      amount: 25000,
      interestRate: 9.0,
      durationMonths: 24,
      collateral: '10.0 ETH',
      collateralValueUSD: 31000,
      ltv: 80.6,
      purpose: 'Business expansion collateral loan',
    });
  }
} catch (e) {
  console.log('Seed loan setup skipped or completed:', e);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User Account & Auth Routes
app.use('/api/user', UserRouter);
app.use('/api/auth', UserRouter);

// Profile & KYC
app.get('/api/user/profile', (req, res) => {
  const wallet = (req.query.wallet as string) || '';
  const profile = lendingWorkflow.getUserProfile(wallet) || lendingWorkflow.createUserProfile({ walletAddress: wallet });
  res.json({ success: true, profile });
});

app.post('/api/kyc/complete', (req, res) => {
  const { wallet, status } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Wallet address required' });
  const updatedUser = lendingWorkflow.completeKyc(wallet, status || 'approved');
  res.json({ success: true, user: updatedUser });
});

// Loans & Lending Marketplace
app.get('/api/loans/marketplace', (req, res) => {
  const loans = lendingWorkflow.getMarketplaceLoans();
  res.json({ success: true, loans });
});

app.post('/api/loans/request', (req, res) => {
  try {
    const loan = lendingWorkflow.createLoanRequest(req.body);
    res.json({ success: true, loan });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/loans/fund', (req, res) => {
  try {
    const { loanId, lenderWallet } = req.body;
    const loan = lendingWorkflow.fundLoan(loanId, lenderWallet || '0xDemoLender');
    res.json({ success: true, loan });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/loans/pay-emi', (req, res) => {
  try {
    const { loanId, amountPaid } = req.body;
    const result = lendingWorkflow.payEmi(loanId, amountPaid);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/loans/history', (req, res) => {
  const wallet = (req.query.wallet as string) || '';
  const history = lendingWorkflow.getLoanHistory(wallet);
  res.json({ success: true, history });
});

app.get('/api/portfolio/summary', (req, res) => {
  const wallet = (req.query.wallet as string) || '';
  const summary = lendingWorkflow.getPortfolioSummary(wallet);
  res.json({ success: true, summary });
});

app.get('/api/reports', (req, res) => {
  const reports = lendingWorkflow.getReports();
  res.json({ success: true, reports });
});

// Presale & ICO
app.get('/api/presale/stats', (req, res) => {
  const wallet = (req.query.wallet as string) || '';
  const userAlloc = presaleState.userPurchases.get(wallet.toLowerCase()) || {
    totalTokens: 0,
    bonusTokens: 0,
    spentUsd: 0,
    claimed: false,
  };
  res.json({
    success: true,
    stats: {
      ...presaleState,
      userAlloc,
    },
  });
});

app.post('/api/presale/buy', (req, res) => {
  const { wallet, usdAmount } = req.body;
  if (!wallet || !usdAmount || Number(usdAmount) <= 0) {
    return res.status(400).json({ error: 'Valid wallet and USD amount required' });
  }
  const usd = Number(usdAmount);
  const baseTokens = usd / presaleState.currentPriceUsd;
  
  // Bonus tier calculation
  let bonusPct = 0;
  if (baseTokens >= 10000000) bonusPct = 0.03; // 3%
  if (baseTokens >= 50000000) bonusPct = 0.05; // 5%

  const bonusTokens = baseTokens * bonusPct;
  const totalReceived = baseTokens + bonusTokens;

  presaleState.tokensSold += totalReceived;
  presaleState.raisedUsd += usd;

  const userKey = wallet.toLowerCase();
  const existing = presaleState.userPurchases.get(userKey) || {
    totalTokens: 0,
    bonusTokens: 0,
    spentUsd: 0,
    claimed: false,
  };

  const updated = {
    totalTokens: existing.totalTokens + totalReceived,
    bonusTokens: existing.bonusTokens + bonusTokens,
    spentUsd: existing.spentUsd + usd,
    claimed: false,
  };

  presaleState.userPurchases.set(userKey, updated);

  res.json({
    success: true,
    purchase: {
      usdSpent: usd,
      baseTokens,
      bonusTokens,
      totalReceived,
      newUserTotal: updated.totalTokens,
    },
  });
});

// Staking Pools
app.get('/api/staking/pools', (req, res) => {
  const wallet = (req.query.wallet as string) || '';
  const userStakesList = userStakes.get(wallet.toLowerCase()) || [];
  res.json({ success: true, pools: stakingPools, userStakes: userStakesList });
});

app.post('/api/staking/stake', (req, res) => {
  const { wallet, poolId, amount } = req.body;
  if (!wallet || !poolId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid staking parameters' });
  }

  const pool = stakingPools.find((p) => p.id === poolId);
  if (!pool) return res.status(400).json({ error: 'Staking pool not found' });

  const numAmount = Number(amount);
  pool.totalStaked += numAmount;

  const now = new Date();
  const lockUntil = new Date(now.getTime() + pool.durationDays * 24 * 60 * 60 * 1000);

  const stakeEntry = {
    id: `stake-${Date.now()}`,
    poolId,
    amount: numAmount,
    stakedAt: now.toISOString(),
    lockedUntil: lockUntil.toISOString(),
    rewardsClaimed: 0,
  };

  const userKey = wallet.toLowerCase();
  const list = userStakes.get(userKey) || [];
  list.push(stakeEntry);
  userStakes.set(userKey, list);

  res.json({ success: true, stake: stakeEntry });
});

// NFT Module Routes
app.use('/api/nfts', (NFTRouter as any).default || NFTRouter);
app.use('/api/marketplace', (MarketplaceRouter as any).default || MarketplaceRouter);
app.use('/api/notifications', (NotificationRouter as any).default || NotificationRouter);

// AI Engine (Credit Score, Fraud Detection, Gemini Copilot)
app.post('/api/ai/credit-score', (req, res) => {
  const scoreResult = aiService.calculateAICreditScore(req.body);
  res.json({ success: true, result: scoreResult });
});

app.post('/api/ai/fraud-check', (req, res) => {
  const fraudResult = aiService.detectFraudAnomalies(req.body);
  res.json({ success: true, result: fraudResult });
});

app.post('/api/ai/copilot', async (req, res) => {
  try {
    const { prompt, userPortfolio } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const client = getGeminiClient();
    if (client) {
      try {
        const geminiRes = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are ABCDeFi AI Copilot, a top-tier decentralized finance advisor on BNB Smart Chain.
User prompt: "${prompt}"
Context: User Portfolio = ${JSON.stringify(userPortfolio || {})}

Provide a clear, structured, actionable response formatted in Markdown. Focus on lending, borrowing LTV ratios, staking APYs, credit scores, and token ICO guidance. Keep tone professional and encouraging.`,
        });

        if (geminiRes.text) {
          return res.json({
            success: true,
            query: prompt,
            response: geminiRes.text,
            timestamp: new Date().toISOString(),
            aiModel: 'Gemini-2.5-Flash (Server-Side)',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini API call fallback to heuristic handler:', geminiError.message);
      }
    }

    // Fallback to internal AI assistant rule engine
    const heuristicResult = await aiService.runAIFinancialAssistant(prompt, userPortfolio);
    res.json({ success: true, ...heuristicResult });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ABCDeFi] Platform Server active on http://0.0.0.0:${PORT}`);

    // Background Synchronization Job (Module 8)
    setInterval(() => {
      syncService.runSyncJob().catch((err) => console.error('Background sync error:', err));
    }, 45000);
  });
}

startServer();
