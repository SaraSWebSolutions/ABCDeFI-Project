import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export function setupICOEndpoints(app: express.Express) {
  type StageId = 'private' | 'presale' | 'public';
  type StageStatus = 'Pending' | 'Live' | 'Paused' | 'Ended' | 'Filled';

  interface StageConfig {
    id: StageId;
    name: string;
    tokenPrice: number;
    bonusPct: number;
    capUSD: number;
    raisedUSD: number;
    tokensAllocated: number;
    tokensSold: number;
    status: StageStatus;
    startDate: string;
    endDate: string;
    cliffDays: number;
    durationDays: number;
  }

  interface PurchaseRecord {
    id: string;
    walletAddress: string;
    phase: StageId;
    amountUSD: number;
    tokensPurchased: number;
    bonusTokens: number;
    referralCode?: string;
    referralBonusTokens: number;
    totalTokens: number;
    txHash: string;
    createdAt: string;
    status: 'Pending' | 'Confirmed' | 'Failed';
  }

  interface ReferralRecord {
    referrerAddress: string;
    referralCode: string;
    createdAt: string;
    totalReferredUSD: number;
    totalReferralBonusTokens: number;
  }

  interface VestingSchedule {
    walletAddress: string;
    totalTokens: number;
    cliffDays: number;
    durationDays: number;
    startDate: string;
    claimedTokens: number;
    createdAt: string;
  }

  const ICO_PURCHASES: PurchaseRecord[] = [];
  const ICO_REFERRALS: ReferralRecord[] = [];
  const ICO_VESTING: VestingSchedule[] = [];
  // persistence file
  const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
  const DATA_FILE = path.join(DATA_DIR, 'ico-data.json');

  function ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (err) {
      console.warn('Failed to ensure data dir:', err);
    }
  }

  function saveData() {
    try {
      ensureDataDir();
      const payload = {
        purchases: ICO_PURCHASES,
        referrals: ICO_REFERRALS,
        vesting: ICO_VESTING,
        stages: ICO_CONFIG.stages.map((s) => ({ id: s.id, raisedUSD: s.raisedUSD, tokensSold: s.tokensSold, status: s.status })),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save ICO data:', err);
    }
  }

  function loadData() {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.purchases)) {
        parsed.purchases.forEach((p: PurchaseRecord) => ICO_PURCHASES.push(p));
      }
      if (Array.isArray(parsed.referrals)) {
        parsed.referrals.forEach((r: ReferralRecord) => ICO_REFERRALS.push(r));
      }
      if (Array.isArray(parsed.vesting)) {
        parsed.vesting.forEach((v: VestingSchedule) => ICO_VESTING.push(v));
      }
      if (Array.isArray(parsed.stages)) {
        parsed.stages.forEach((s: any) => {
          const stage = ICO_CONFIG.stages.find((st) => st.id === s.id);
          if (stage) {
            stage.raisedUSD = s.raisedUSD ?? stage.raisedUSD;
            stage.tokensSold = s.tokensSold ?? stage.tokensSold;
            stage.status = s.status ?? stage.status;
          }
        });
      }
    } catch (err) {
      console.error('Failed to load ICO data:', err);
    }
  }

  const ICO_CONFIG = {
    referralBonusPct: 5,
    stages: [
      {
        id: 'private' as StageId,
        name: 'Private Sale',
        tokenPrice: 0.02,
        bonusPct: 30,
        capUSD: 250000,
        raisedUSD: 0,
        tokensAllocated: 12500000,
        tokensSold: 0,
        status: 'Live' as StageStatus,
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        cliffDays: 30,
        durationDays: 180,
      },
      {
        id: 'presale' as StageId,
        name: 'Presale',
        tokenPrice: 0.04,
        bonusPct: 15,
        capUSD: 500000,
        raisedUSD: 0,
        tokensAllocated: 7500000,
        tokensSold: 0,
        status: 'Pending' as StageStatus,
        startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 31).toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
        cliffDays: 15,
        durationDays: 120,
      },
      {
        id: 'public' as StageId,
        name: 'Public Sale',
        tokenPrice: 0.08,
        bonusPct: 5,
        capUSD: 1000000,
        raisedUSD: 0,
        tokensAllocated: 5000000,
        tokensSold: 0,
        status: 'Pending' as StageStatus,
        startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 61).toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 91).toISOString(),
        cliffDays: 0,
        durationDays: 60,
      },
    ] as StageConfig[],
    allocations: [
      { label: 'Founder', pct: 55 },
      { label: 'ICO', pct: 20 },
      { label: 'Partnerships', pct: 10 },
      { label: 'Finance', pct: 9 },
      { label: 'Advisors', pct: 2 },
      { label: 'Reserve', pct: 2 },
      { label: 'Contingency', pct: 2 },
    ],
  };

  loadData();

  function findStage(phase: StageId) {
    return ICO_CONFIG.stages.find((stage) => stage.id === phase);
  }

  function createReferralCode(walletAddress: string) {
    return `REF-${walletAddress.slice(2, 8).toUpperCase()}-${Date.now().toString(36).slice(-5)}`;
  }

  app.get('/api/ico/config', (req: Request, res: Response) => {
    res.json({ config: ICO_CONFIG });
  });

  app.get('/api/ico/overview', (req: Request, res: Response) => {
    const totalRaised = ICO_PURCHASES.reduce((sum, p) => sum + p.amountUSD, 0);
    const totalTokens = ICO_PURCHASES.reduce((sum, p) => sum + p.totalTokens, 0);
    const currentPhase = ICO_CONFIG.stages.find((s) => s.status === 'Live') || ICO_CONFIG.stages[0];
    const totalReferralBonus = ICO_PURCHASES.reduce((sum, p) => sum + p.referralBonusTokens, 0);

    res.json({
      totalRaised,
      totalTokens,
      totalPurchases: ICO_PURCHASES.length,
      totalReferralBonus,
      currentPhase,
      config: ICO_CONFIG,
    });
  });

  app.post('/api/ico/purchase', (req: Request, res: Response) => {
    const { walletAddress, phase, amountUSD, referralCode } = req.body;
    if (!walletAddress || !phase || !amountUSD) {
      return res.status(400).json({ error: 'walletAddress, phase, and amountUSD are required.' });
    }

    const stage = findStage(phase);
    if (!stage || stage.status !== 'Live') {
      return res.status(400).json({ error: 'Phase not available for purchase.' });
    }

    if (amountUSD <= 0) {
      return res.status(400).json({ error: 'amountUSD must be greater than 0.' });
    }

    if (stage.raisedUSD + amountUSD > stage.capUSD) {
      return res.status(400).json({ error: 'Stage cap exceeded.' });
    }

    const tokensPurchased = Math.floor(amountUSD / stage.tokenPrice);
    if (tokensPurchased <= 0) {
      return res.status(400).json({ error: 'Amount too small for purchase.' });
    }

    const bonusTokens = Math.floor((tokensPurchased * stage.bonusPct) / 100);
    const referralBonusTokens = referralCode ? Math.floor((tokensPurchased * ICO_CONFIG.referralBonusPct) / 100) : 0;
    const totalTokens = tokensPurchased + bonusTokens + referralBonusTokens;

    if (stage.tokensSold + totalTokens > stage.tokensAllocated) {
      return res.status(400).json({ error: 'Stage token allocation exceeded.' });
    }

    const purchase: PurchaseRecord = {
      id: `ico_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      walletAddress,
      phase,
      amountUSD,
      tokensPurchased,
      bonusTokens,
      referralCode,
      referralBonusTokens,
      totalTokens,
      txHash: `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      status: 'Confirmed',
    };

    stage.raisedUSD += amountUSD;
    stage.tokensSold += totalTokens;

    ICO_PURCHASES.unshift(purchase);

    if (referralCode) {
      const referral = ICO_REFERRALS.find((entry) => entry.referralCode === referralCode);
      if (referral) {
        referral.totalReferredUSD += amountUSD;
        referral.totalReferralBonusTokens += referralBonusTokens;
      }
    }

    ICO_VESTING.push({
      walletAddress,
      totalTokens,
      cliffDays: stage.cliffDays,
      durationDays: stage.durationDays,
      startDate: new Date().toISOString(),
      claimedTokens: 0,
      createdAt: new Date().toISOString(),
    });

    // persist after state change
    saveData();

    res.json({ purchase, message: 'Purchase recorded successfully.' });
  });

  app.post('/api/ico/referral', (req: Request, res: Response) => {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required to create a referral code.' });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const referralCode = createReferralCode(normalizedAddress);
    const referral: ReferralRecord = {
      referrerAddress: normalizedAddress,
      referralCode,
      createdAt: new Date().toISOString(),
      totalReferredUSD: 0,
      totalReferralBonusTokens: 0,
    };

    ICO_REFERRALS.push(referral);
    saveData();
    res.json({ referral, message: 'Referral code created.' });
  });

  app.get('/api/ico/referrals/:address', (req: Request, res: Response) => {
    const walletAddress = req.params.address.toLowerCase();
    const referrals = ICO_REFERRALS.filter((entry) => entry.referrerAddress === walletAddress);
    res.json({ referrals });
  });

  app.get('/api/ico/vesting/:address', (req: Request, res: Response) => {
    const walletAddress = req.params.address.toLowerCase();
    const vestingSchedules = ICO_VESTING.filter((entry) => entry.walletAddress.toLowerCase() === walletAddress);
    res.json({ vestingSchedules });
  });

  app.get('/api/ico/purchases/:address', (req: Request, res: Response) => {
    const walletAddress = req.params.address.toLowerCase();
    const purchases = ICO_PURCHASES.filter((p) => p.walletAddress.toLowerCase() === walletAddress);
    res.json({ purchases });
  });

  app.get('/api/ico/stats', (req: Request, res: Response) => {
    const totalRaised = ICO_PURCHASES.reduce((sum, p) => sum + p.amountUSD, 0);
    const totalTokens = ICO_PURCHASES.reduce((sum, p) => sum + p.totalTokens, 0);
    const currentPhase = ICO_CONFIG.stages.find((s) => s.status === 'Live') || ICO_CONFIG.stages[0];
    const totalReferralBonus = ICO_PURCHASES.reduce((sum, p) => sum + p.referralBonusTokens, 0);
    const totalVestingRecords = ICO_VESTING.length;

    res.json({
      totalRaised,
      totalTokens,
      totalPurchases: ICO_PURCHASES.length,
      totalReferralBonus,
      totalVestingRecords,
      currentPhase,
      stageSummary: ICO_CONFIG.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        status: stage.status,
        raisedUSD: stage.raisedUSD,
        tokensSold: stage.tokensSold,
        capUSD: stage.capUSD,
        tokensAllocated: stage.tokensAllocated,
      })),
    });
  });

  app.post('/api/ico/admin/update-stage', (req: Request, res: Response) => {
    const { phase, status } = req.body;
    const stage = findStage(phase);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found.' });
    }
    if (!['Pending', 'Live', 'Paused', 'Ended', 'Filled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    stage.status = status as StageStatus;
    saveData();
    res.json({ message: `Stage ${phase} updated to ${status}.`, stage });
  });

  // Admin: export ICO data
  app.get('/api/ico/admin/export', (req: Request, res: Response) => {
    try {
      ensureDataDir();
      if (!fs.existsSync(DATA_FILE)) {
        return res.json({ purchases: ICO_PURCHASES, referrals: ICO_REFERRALS, vesting: ICO_VESTING, stages: ICO_CONFIG.stages });
      }
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      console.error('Export failed', err);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // Admin: import ICO data (replace current state)
  app.post('/api/ico/admin/import', (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (!payload) return res.status(400).json({ error: 'Missing JSON payload' });

      // validate arrays
      if (Array.isArray(payload.purchases)) {
        ICO_PURCHASES.length = 0;
        payload.purchases.forEach((p: PurchaseRecord) => ICO_PURCHASES.push(p));
      }
      if (Array.isArray(payload.referrals)) {
        ICO_REFERRALS.length = 0;
        payload.referrals.forEach((r: ReferralRecord) => ICO_REFERRALS.push(r));
      }
      if (Array.isArray(payload.vesting)) {
        ICO_VESTING.length = 0;
        payload.vesting.forEach((v: VestingSchedule) => ICO_VESTING.push(v));
      }
      if (Array.isArray(payload.stages)) {
        payload.stages.forEach((s: any) => {
          const stage = ICO_CONFIG.stages.find((st) => st.id === s.id);
          if (stage) {
            stage.raisedUSD = s.raisedUSD ?? stage.raisedUSD;
            stage.tokensSold = s.tokensSold ?? stage.tokensSold;
            stage.status = s.status ?? stage.status;
          }
        });
      }

      saveData();
      res.json({ message: 'Import applied successfully.' });
    } catch (err) {
      console.error('Import failed', err);
      res.status(500).json({ error: 'Import failed' });
    }
  });
}
