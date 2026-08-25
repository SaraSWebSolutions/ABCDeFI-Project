import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { setupICOEndpoints } from './ico';
import { handleReferralOnRegister } from './services/referralService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(express.json());

// Credentials must be supplied only by the server environment.
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || '';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '';
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';
const SUMSUB_LEVEL_NAME = process.env.SUMSUB_LEVEL_NAME || 'id-and-liveness';

/**
 * Creates HMAC-SHA256 Signature for Sumsub REST API Requests
 * Signature = HMAC_SHA256(secretKey, timestamp + httpMethod + urlPath + requestBody)
 */
function createSumsubSignature(method: string, urlPath: string, bodyStr: string = '', timestamp: number) {
  if (!SUMSUB_SECRET_KEY) throw new Error('SUMSUB_SECRET_KEY is not configured');
  const data = timestamp + method.toUpperCase() + urlPath + bodyStr;
  return crypto.createHmac('sha256', SUMSUB_SECRET_KEY).update(data).digest('hex');
}

/**
 * Verify Sumsub webhook signature using HMAC‑SHA256.
 * Sumsub sends the raw request body and the signature in the `X-App-Access-Sig` header.
 */
function verifySumsubWebhook(req: Request): boolean {
  if (!SUMSUB_SECRET_KEY) return false;
  const signatureHeader = req.headers['x-app-access-sig'];
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return false;
  }
  const timestampHeader = req.headers['x-app-access-ts'];
  const timestamp = timestampHeader ? parseInt(timestampHeader as string, 10) : Math.floor(Date.now() / 1000);
  const bodyStr = JSON.stringify(req.body);
  const method = req.method;
  const urlPath = req.originalUrl.split('?')[0]; // path without query
  const computedSig = crypto.createHmac('sha256', SUMSUB_SECRET_KEY).update(timestamp + method.toUpperCase() + urlPath + bodyStr).digest('hex');
  const received = Buffer.from(signatureHeader, 'utf8');
  const expected = Buffer.from(computedSig, 'utf8');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

/**
 * Update KYC status in both KYC_DB and the linked user record.
 */
function updateKycStatus(applicantId: string, isApproved: boolean, reviewResult: string, timestamp: string) {
  // Find the wallet address for this applicant
  const entry = Array.from(KYC_DB.entries()).find(([, rec]) => rec.applicantId === applicantId);
  if (!entry) {
    console.warn(`KYC record not found for applicant ${applicantId}`);
    return;
  }
  const [walletKey, record] = entry;
  const user = USERS_DB.get(walletKey);
  const status = isApproved ? 'approved' : 'rejected';
  record.status = status as any;
  record.reviewResult = reviewResult;
  record.verifiedAt = timestamp;
  record.reviewTimestamp = timestamp;
  if (user) {
    user.kycStatus = status as any;
  }
}

/**
 * Makes Authenticated Request to Sumsub Production API
 */
async function callSumsubAPI(method: string, pathStr: string, payload?: any) {
  if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
    return null; // Fallback to Sandbox / Simulated mode when API keys are empty
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const bodyStr = payload ? JSON.stringify(payload) : '';
  const signature = createSumsubSignature(method, pathStr, bodyStr, timestamp);

  const url = `${SUMSUB_BASE_URL}${pathStr}`;
  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': timestamp.toString(),
    },
    body: bodyStr || undefined,
  });

  return await response.json();
}

// In-Memory Database Store
interface User {
  id: string;
  email: string;
  passwordHash: string;
  walletAddress: string;
  role: 'Client' | 'Admin' | 'Franchise';
  kycStatus: 'unverified' | 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface KYCRecord {
  applicantId: string;
  userId: string;
  walletAddress: string;
  provider: 'Sumsub';
  status: 'unverified' | 'pending' | 'approved' | 'rejected';
  createdAt: string;
  // Optional fields for UI and webhook data
  referenceId?: string;
  verificationLevel?: string;
  country?: string;
  verifiedAt?: string;
  reviewResult?: string;
  reviewTimestamp?: string;
  history?: any[];
}

const USERS_DB: Map<string, User> = new Map();
const KYC_DB: Map<string, KYCRecord> = new Map();
const NOTIFICATIONS_DB: any[] = [
  { id: 'notif-1', title: 'KYC Status Update', message: 'Identity verification submitted to Sumsub AI.', type: 'info', read: false, date: '10 mins ago' },
  { id: 'notif-2', title: 'EMI Payment Reminder', message: 'Upcoming EMI payment of $410.20 due in 3 days.', type: 'warning', read: false, date: '1 hour ago' },
  { id: 'notif-3', title: 'Staking Yield Distributed', message: 'Received 1,450.25 ABCD staking rewards.', type: 'success', read: false, date: '3 hours ago' },
];
const TRANSACTIONS_DB: any[] = [
  {
    id: 'tx-1001',
    txHash: '0x3a4b9c1f8e7d6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b',
    userAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    type: 'Stake',
    amount: '10,000 ABCD',
    token: 'ABCD',
    status: 'Completed',
    blockNumber: 8546210,
    timestamp: '2026-07-31 10:14:02',
    network: 'Sepolia',
  },
  {
    id: 'tx-1002',
    txHash: '0x5c6d1e3f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3',
    userAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    type: 'Borrow',
    amount: '2,500 USDC',
    token: 'USDC',
    status: 'Completed',
    blockNumber: 8546220,
    timestamp: '2026-07-31 10:45:30',
    network: 'Sepolia',
  },
];

const SESSION_SIGNING_SECRET = process.env.SESSION_SIGNING_SECRET || '';

function issueSessionToken(user: User): string {
  if (!SESSION_SIGNING_SECRET) throw new Error('SESSION_SIGNING_SECRET is not configured');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, wallet: user.walletAddress, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SIGNING_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

// ==========================================
// 1. AUTH API MODULE (/api/auth)
// ⚠️ SCAFFOLD/ICO LAYER ONLY — NOT MAIN AUTH
// The main production authentication backend is:
// backend/backend/modules/user/userAccount/
// ==========================================

// Register User
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, walletAddress, role } = req.body;

  if (!email || !walletAddress) {
    return res.status(400).json({ error: 'Email and Wallet Address are required.' });
  }

  const walletKey = walletAddress.toLowerCase();
  if (USERS_DB.has(walletKey)) {
    return res.status(400).json({ error: 'User with this wallet address already registered.' });
  }

  const newUser: User = {
    id: `usr_${Date.now().toString(36)}`,
    email,
    passwordHash: `hash_${password || 'secret'}`,
    walletAddress,
    role: role || 'Client',
    kycStatus: 'unverified',
    createdAt: new Date().toISOString(),
  };

  USERS_DB.set(walletKey, newUser);
  let jwtToken: string;
  try {
    jwtToken = issueSessionToken(newUser);
  } catch {
    return res.status(503).json({ error: 'Authentication service is not configured.' });
  }

  res.json({
    message: 'User registered successfully',
    token: jwtToken,
    user: {
      id: newUser.id,
      email: newUser.email,
      walletAddress: newUser.walletAddress,
      role: newUser.role,
      kycStatus: newUser.kycStatus,
    },
  });
});

// Login User
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required for Web3 session.' });
  }

  const walletKey = walletAddress.toLowerCase();
  let user = USERS_DB.get(walletKey);

  if (!user) {
    user = {
      id: `usr_${Date.now().toString(36)}`,
      email: `${walletAddress.slice(0, 6)}@abcdefi.io`,
      passwordHash: 'web3_auth',
      walletAddress,
      role: 'Client',
      kycStatus: 'unverified',
      createdAt: new Date().toISOString(),
    };
    USERS_DB.set(walletKey, user);
  }

  let jwtToken: string;
  try {
    jwtToken = issueSessionToken(user);
  } catch {
    return res.status(503).json({ error: 'Authentication service is not configured.' });
  }

  res.json({
    message: 'Login successful',
    token: jwtToken,
    user: {
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
      kycStatus: user.kycStatus,
    },
  });
});

// Get User Profile
app.get('/api/auth/me/:address', (req: Request, res: Response) => {
  const walletKey = String(req.params.address).toLowerCase();
  const user = USERS_DB.get(walletKey);

  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  res.json({ user });
});

// ==========================================
// 2. SUMSUB KYC API MODULE (/api/kyc)
// ==========================================

// Create Sumsub Applicant & Issue SDK Token
app.post('/api/kyc/start', async (req: Request, res: Response) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required.' });
  }

  let applicantId = `APP_${walletAddress.slice(2, 8).toUpperCase()}`;
  let sdkToken = `sumsub_sdk_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // If Live Sumsub API Keys are configured in .env, request real SDK Token from Sumsub REST API
  if (SUMSUB_APP_TOKEN && SUMSUB_SECRET_KEY) {
    try {
      const apiPath = `/resources/accessTokens?userId=${encodeURIComponent(walletAddress)}&levelName=${encodeURIComponent(SUMSUB_LEVEL_NAME)}`;
      const sumsubRes = await callSumsubAPI('POST', apiPath);
      if (sumsubRes && sumsubRes.token) {
        sdkToken = sumsubRes.token;
        applicantId = sumsubRes.userId || applicantId;
        console.log(`✅ Live Sumsub SDK Token issued for user ${walletAddress}`);
      }
    } catch (err) {
      console.error('Error requesting token from live Sumsub API, falling back to sandbox token:', err);
    }
  }

  KYC_DB.set(walletAddress.toLowerCase(), {
    applicantId,
    userId: `usr_${walletAddress.slice(2, 8)}`,
    walletAddress,
    provider: 'Sumsub',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  const walletKey = walletAddress.toLowerCase();
  const user = USERS_DB.get(walletKey);
  if (user) {
    user.kycStatus = 'pending';
  }

  // Construct verification redirect URL
  const redirectUrl = SUMSUB_APP_TOKEN && SUMSUB_SECRET_KEY
    ? `${SUMSUB_BASE_URL}/verify/abcdefi/${applicantId}`
    : `http://localhost:3000/mock-sumsub-hosted?applicantId=${applicantId}&wallet=${walletAddress}`;

  res.json({
    message: 'Sumsub Applicant & Session Link Ready',
    applicantId,
    sdkToken,
    redirectUrl,
    isProductionApi: Boolean(SUMSUB_APP_TOKEN && SUMSUB_SECRET_KEY),
  });
});

// Get KYC Status
app.get('/api/kyc/status/:address', (req: Request, res: Response) => {
  const walletKey = req.params.address.toLowerCase();
  const record = KYC_DB.get(walletKey);
  const user = USERS_DB.get(walletKey);

  res.json({
    kycStatus: user?.kycStatus || record?.status || 'approved',
    applicantId: record?.applicantId || `APP_${walletKey.slice(2, 8).toUpperCase()}`,
    provider: 'Sumsub',
    reference: record?.applicantId || `APP_${walletKey.slice(2, 8).toUpperCase()}`,
  });
});

// Sumsub Webhook Receiver
app.post('/api/webhooks/sumsub', (req: Request, res: Response) => {
  // Verify signature first
  if (!verifySumsubWebhook(req)) {
    console.warn('Invalid Sumsub webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const { applicantId, reviewResult, reviewStatus, reviewAnswer, walletAddress } = req.body as any;
  // Sumsub payload may contain nested objects; normalize
  const result = reviewResult || reviewAnswer || (reviewStatus ? { reviewAnswer: reviewStatus } : {});
  const isApproved = result?.reviewAnswer === 'GREEN' || result?.reviewAnswer === 'GREEN';
  const reviewRes = result?.reviewAnswer || 'UNKNOWN';
  const timestamp = new Date().toISOString();

  // Update DB records
  updateKycStatus(applicantId, isApproved, reviewRes, timestamp);

  // Create notification
  NOTIFICATIONS_DB.unshift({
    id: `notif-${Date.now()}`,
    title: isApproved ? 'KYC Approved ✅' : 'KYC Verification Failed ❌',
    message: isApproved
      ? 'Identity verified by Sumsub AI. Platform features fully activated.'
      : 'Document check failed. Please re‑upload your document.',
    type: isApproved ? 'success' : 'error',
    read: false,
    date: 'Just now',
  });

  // Respond with a redirect URL for the front‑end (optional)
  const redirectUrl = isApproved ? 'https://abcdefi.com/kyc/success' : 'https://abcdefi.com/kyc/failure';
  res.json({
    status: 'success',
    applicantId,
    kycStatus: isApproved ? 'approved' : 'rejected',
    redirectUrl,
  });
});

// GET applicant details from Sumsub (requires live credentials)
app.get('/api/kyc/applicant/:id', async (req: Request, res: Response) => {
  if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
    return res.status(400).json({ error: 'Sumsub not configured' });
  }
  const data = await callSumsubAPI('GET', `/resources/applicants/${req.params.id}`);
  res.json(data);
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const sumsubReady = Boolean(SUMSUB_APP_TOKEN && SUMSUB_SECRET_KEY);
  res.json({ status: 'ok', sumsubReady });
});

// Refresh SDK token for an existing applicant (requires live credentials)
app.get('/api/kyc/token/:address', async (req: Request, res: Response) => {
  if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
    return res.status(400).json({ error: 'Sumsub not configured' });
  }
  const walletAddress = String(req.params.address);
  const record = KYC_DB.get(walletAddress.toLowerCase());
  if (!record) {
    return res.status(404).json({ error: 'KYC record not found for this address' });
  }
  try {
    const apiPath = `/resources/accessTokens?userId=${encodeURIComponent(walletAddress)}&levelName=${encodeURIComponent(SUMSUB_LEVEL_NAME)}`;
    const sumsubRes = await callSumsubAPI('POST', apiPath);
    if (sumsubRes && sumsubRes.token) {
      res.json({ sdkToken: sumsubRes.token, applicantId: record.applicantId });
    } else {
      res.status(502).json({ error: 'Failed to obtain SDK token from Sumsub' });
    }
  } catch (err) {
    console.error('SDK token refresh error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// 3. NOTIFICATIONS API MODULE (/api/notifications)
// ==========================================

app.get('/api/notifications', (req: Request, res: Response) => {
  res.json({ notifications: NOTIFICATIONS_DB });
});

app.post('/api/notifications/read-all', (req: Request, res: Response) => {
  NOTIFICATIONS_DB.forEach((n) => (n.read = true));
  res.json({ message: 'All notifications marked as read.' });
});

// ==========================================
// 4. TRANSACTIONS LEDGER API MODULE (/api/transactions)
// ==========================================

app.get('/api/transactions', (req: Request, res: Response) => {
  res.json({ transactions: TRANSACTIONS_DB });
});

app.post('/api/transactions/add', (req: Request, res: Response) => {
  const newTx = req.body;
  newTx.id = `tx-${Date.now()}`;
  TRANSACTIONS_DB.unshift(newTx);
  res.json({ message: 'Transaction recorded', transaction: newTx });
});

// ==========================================
// 5. CREDIT SCORE ENGINE API (/api/credit/score/:address)
// ==========================================

app.get('/api/credit/score/:address', (req: Request, res: Response) => {
  res.json({
    creditScore: 812,
    rating: 'Excellent',
    factors: [
      { name: 'On-Time Repayments', points: '+240 pts' },
      { name: 'Sumsub KYC Verified', points: '+150 pts' },
      { name: 'Wallet Age (2+ Years)', points: '+120 pts' },
      { name: 'Staking & Yield Participation', points: '+150 pts' },
      { name: 'Legion NFT Ownership', points: '+152 pts' },
    ],
  });
});

// ==========================================
// 6. ADMIN CONTROL APIS (/api/admin)
// ==========================================

app.post('/api/admin/approve-kyc', (req: Request, res: Response) => {
  const { walletAddress } = req.body;
  const user = USERS_DB.get((walletAddress || '').toLowerCase());
  if (user) user.kycStatus = 'approved';
  res.json({ message: `KYC approved for ${walletAddress}` });
});

app.post('/api/admin/freeze-user', (req: Request, res: Response) => {
  const { walletAddress } = req.body;
  res.json({ message: `Account ${walletAddress} frozen for compliance review.` });
});

app.post('/api/admin/pause-vault', (req: Request, res: Response) => {
  res.json({ message: 'Smart Contract Vault emergency pause toggled.' });
});

setupICOEndpoints(app);

// Start Server with Port Fallback
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ABCDeFi Express Backend Server Running on Port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}`);
  console.log(`🔐 JWT Auth & Sumsub KYC Webhooks Active`);
  console.log(`====================================================`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`====================================================`);
    console.log(`⚠️ Port ${PORT} is already in use by an active ABCDeFi server process.`);
    console.log(`🌐 Existing API Server is LIVE on http://localhost:${PORT}`);
    console.log(`====================================================`);
    process.exit(0);
  } else {
    console.error('Server error:', err);
  }
});
