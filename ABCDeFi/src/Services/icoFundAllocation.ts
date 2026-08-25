// ============================================================================
// ICO Fund Allocation Engine + Promotion Allocation Wallet
// Whitepaper: Auto-distribute ICO proceeds by defined percentages
// ============================================================================

export interface AllocationWallet {
  id: string;
  label: string;
  address: string;
  percentageBps: number;       // basis points (100 = 1%)
  allocatedUSD: number;
  distributedUSD: number;
  status: 'pending' | 'distributed' | 'locked';
}

export interface FundDistributionRecord {
  id: string;
  totalRaisedUSD: number;
  wallets: AllocationWallet[];
  distributedAt: string;
  txHash: string;
  phase: 'private' | 'presale' | 'public' | 'all';
}

export interface PromotionPool {
  totalAllocatedTokens: number;    // 0.05% of ICO token allocation
  totalDistributedTokens: number;
  remainingTokens: number;
  isActive: boolean;
  rewardPercentageBps: number;     // 5 BPS = 0.05%
  rewards: PromotionReward[];
}

export interface PromotionReward {
  id: string;
  referrerAddress: string;
  referrerName: string;
  purchaserAddress: string;
  purchaseAmountUSD: number;
  rewardTokens: number;
  awardedAt: string;
  txHash: string;
  status: 'pending' | 'claimed' | 'expired';
}

export interface ICOAnalyticsSummary {
  totalRaisedUSD: number;
  totalTokensSold: number;
  totalBonusDistributed: number;
  totalPromotionRewards: number;
  totalReserveTransfers: number;
  bonusPoolRemaining: number;
  promotionPoolRemaining: number;
  fundDistributions: number;
  activePhase: string;
}

// ============================================================================
// Whitepaper Fund Allocation Percentages
// ============================================================================

const WHITEPAPER_ALLOCATION_BPS = {
  founder:     5500,  // 55%
  ico:         2000,  // 20%
  marketing:   1000,  // 10%
  finance:      900,  //  9%
  advisors:     200,  //  2%
  reserve:      200,  //  2%
  contingency:  200,  //  2%
};

const ALLOCATION_WALLETS: AllocationWallet[] = [
  {
    id: 'founder',
    label: 'Founder & Team',
    address: '0x1111...F001',
    percentageBps: WHITEPAPER_ALLOCATION_BPS.founder,
    allocatedUSD: 0,
    distributedUSD: 0,
    status: 'pending',
  },
  {
    id: 'ico',
    label: 'ICO Token Pool',
    address: '0x2222...IC01',
    percentageBps: WHITEPAPER_ALLOCATION_BPS.ico,
    allocatedUSD: 0,
    distributedUSD: 0,
    status: 'pending',
  },
  {
    id: 'marketing',
    label: 'Marketing & Growth',
    address: '0x3333...MK01',
    percentageBps: WHITEPAPER_ALLOCATION_BPS.marketing,
    allocatedUSD: 0,
    distributedUSD: 0,
    status: 'pending',
  },
  {
    id: 'finance',
    label: 'Finance & Operations',
    address: '0x4444...FN01',
    percentageBps: WHITEPAPER_ALLOCATION_BPS.finance,
    allocatedUSD: 0,
    distributedUSD: 0,
    status: 'pending',
  },
  {
    id: 'advisors',
    label: 'Advisors',
    address: '0x5555...AD01',
    percentageBps: WHITEPAPER_ALLOCATION_BPS.advisors,
    allocatedUSD: 0,
    distributedUSD: 0,
    status: 'pending',
  },
  {
    id: 'reserve',
    label: 'Reserve Pool',
    address: '0x6666...RS01',
    percentageBps: WHITEPAPER_ALLOCATION_BPS.reserve,
    allocatedUSD: 0,
    distributedUSD: 0,
    status: 'pending',
  },
  {
    id: 'contingency',
    label: 'Contingency Fund',
    address: '0x7777...CT01',
    percentageBps: WHITEPAPER_ALLOCATION_BPS.contingency,
    allocatedUSD: 0,
    distributedUSD: 0,
    status: 'pending',
  },
];

// ============================================================================
// Mutable State
// ============================================================================

const BPS_DENOMINATOR = 10_000;
const TOTAL_SUPPLY = 1_000_000_000;
const ICO_TOKEN_ALLOCATION = TOTAL_SUPPLY * 0.20;  // 200M ABCD for ICO
const PROMOTION_POOL_BPS = 5; // 0.05% of ICO allocation

let distributionHistory: FundDistributionRecord[] = [];

let promotionPool: PromotionPool = {
  totalAllocatedTokens: Math.floor(ICO_TOKEN_ALLOCATION * (PROMOTION_POOL_BPS / BPS_DENOMINATOR)), // 10,000 ABCD
  totalDistributedTokens: 0,
  remainingTokens: Math.floor(ICO_TOKEN_ALLOCATION * (PROMOTION_POOL_BPS / BPS_DENOMINATOR)),
  isActive: true,
  rewardPercentageBps: PROMOTION_POOL_BPS,
  rewards: [],
};

// Seed some initial data
const seedDistribution: FundDistributionRecord = {
  id: 'dist-001',
  totalRaisedUSD: 4_020_000,
  wallets: ALLOCATION_WALLETS.map((w) => ({
    ...w,
    allocatedUSD: (4_020_000 * w.percentageBps) / BPS_DENOMINATOR,
    distributedUSD: (4_020_000 * w.percentageBps) / BPS_DENOMINATOR,
    status: 'distributed' as const,
  })),
  distributedAt: '2026-07-15 14:30:00',
  txHash: '0xa1b2c3d4e5f6789012345678',
  phase: 'all',
};
distributionHistory.push(seedDistribution);

// Seed promotion rewards
promotionPool.rewards = [
  {
    id: 'promo-001',
    referrerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    referrerName: 'Alex Rivers',
    purchaserAddress: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    purchaseAmountUSD: 10_000,
    rewardTokens: 62.5,   // 10000 * 0.0005 * (1/0.08) tokens at public price
    awardedAt: '2026-07-20 09:15:00',
    txHash: '0xpr0m001abc',
    status: 'claimed',
  },
  {
    id: 'promo-002',
    referrerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    referrerName: 'Liam Vance',
    purchaserAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    purchaseAmountUSD: 5_000,
    rewardTokens: 31.25,
    awardedAt: '2026-07-22 16:45:00',
    txHash: '0xpr0m002def',
    status: 'pending',
  },
];
promotionPool.totalDistributedTokens = 93.75;
promotionPool.remainingTokens = promotionPool.totalAllocatedTokens - 93.75;

// ============================================================================
// Fund Distribution Engine
// ============================================================================

/**
 * Distribute ICO funds according to whitepaper percentages.
 */
export function distributeICOFunds(
  totalRaisedUSD: number,
  phase: FundDistributionRecord['phase'] = 'all'
): FundDistributionRecord {
  const wallets: AllocationWallet[] = ALLOCATION_WALLETS.map((w) => ({
    ...w,
    allocatedUSD: (totalRaisedUSD * w.percentageBps) / BPS_DENOMINATOR,
    distributedUSD: (totalRaisedUSD * w.percentageBps) / BPS_DENOMINATOR,
    status: 'distributed' as const,
  }));

  const record: FundDistributionRecord = {
    id: `dist-${String(distributionHistory.length + 1).padStart(3, '0')}`,
    totalRaisedUSD,
    wallets,
    distributedAt: new Date().toISOString(),
    txHash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
    phase,
  };

  distributionHistory.push(record);
  return record;
}

/**
 * Get all historical fund distributions.
 */
export function getDistributionHistory(): FundDistributionRecord[] {
  return [...distributionHistory];
}

/**
 * Get the allocation wallets with current balances.
 */
export function getAllocationWallets(): AllocationWallet[] {
  if (distributionHistory.length > 0) {
    return distributionHistory[distributionHistory.length - 1].wallets;
  }
  return ALLOCATION_WALLETS;
}

/**
 * Get the whitepaper allocation percentages.
 */
export function getWhitepaperAllocations() {
  return { ...WHITEPAPER_ALLOCATION_BPS };
}

// ============================================================================
// Promotion Pool Engine
// ============================================================================

/**
 * Award a promotion reward to a referrer when their referral purchases tokens.
 * Reward comes from the promotion pool, NOT from the purchaser's tokens.
 */
export function awardPromotionReward(
  referrerAddress: string,
  referrerName: string,
  purchaserAddress: string,
  purchaseAmountUSD: number,
  tokenPrice: number = 0.08
): PromotionReward | null {
  if (!promotionPool.isActive || promotionPool.remainingTokens <= 0) {
    return null;
  }

  // 0.05% of purchase amount in USD, converted to tokens
  const rewardUSD = purchaseAmountUSD * (PROMOTION_POOL_BPS / BPS_DENOMINATOR);
  const rewardTokens = rewardUSD / tokenPrice;

  // Check if pool has enough
  if (rewardTokens > promotionPool.remainingTokens) {
    // Award whatever remains
    const finalReward: PromotionReward = {
      id: `promo-${String(promotionPool.rewards.length + 1).padStart(3, '0')}`,
      referrerAddress,
      referrerName,
      purchaserAddress,
      purchaseAmountUSD,
      rewardTokens: promotionPool.remainingTokens,
      awardedAt: new Date().toISOString(),
      txHash: `0x${Math.random().toString(16).substring(2, 14)}`,
      status: 'pending',
    };
    promotionPool.totalDistributedTokens += promotionPool.remainingTokens;
    promotionPool.remainingTokens = 0;
    promotionPool.isActive = false;
    promotionPool.rewards.push(finalReward);
    return finalReward;
  }

  const reward: PromotionReward = {
    id: `promo-${String(promotionPool.rewards.length + 1).padStart(3, '0')}`,
    referrerAddress,
    referrerName,
    purchaserAddress,
    purchaseAmountUSD,
    rewardTokens,
    awardedAt: new Date().toISOString(),
    txHash: `0x${Math.random().toString(16).substring(2, 14)}`,
    status: 'pending',
  };

  promotionPool.totalDistributedTokens += rewardTokens;
  promotionPool.remainingTokens -= rewardTokens;
  promotionPool.rewards.push(reward);

  return reward;
}

/**
 * Get current promotion pool status.
 */
export function getPromotionPool(): PromotionPool {
  return { ...promotionPool, rewards: [...promotionPool.rewards] };
}

/**
 * Toggle promotion pool active/inactive.
 */
export function togglePromotionPool(active: boolean): void {
  promotionPool.isActive = active;
}

// ============================================================================
// ICO Analytics Summary
// ============================================================================

export function getICOAnalytics(): ICOAnalyticsSummary {
  const totalDistributed = distributionHistory.reduce((s, d) => s + d.totalRaisedUSD, 0);
  return {
    totalRaisedUSD: totalDistributed,
    totalTokensSold: 84_600_000,  // from icoLaunchpad data
    totalBonusDistributed: 0,     // will be populated by bonusEngine
    totalPromotionRewards: promotionPool.totalDistributedTokens,
    totalReserveTransfers: 0,     // will be populated by reserveAccounting
    bonusPoolRemaining: 15_000_000,  // 1.5% cap placeholder
    promotionPoolRemaining: promotionPool.remainingTokens,
    fundDistributions: distributionHistory.length,
    activePhase: 'public',
  };
}

/**
 * Export a formatted ICO report.
 */
export function exportICOReport(): string {
  const analytics = getICOAnalytics();
  const pool = getPromotionPool();
  return JSON.stringify({
    reportDate: new Date().toISOString(),
    analytics,
    promotionPool: {
      allocated: pool.totalAllocatedTokens,
      distributed: pool.totalDistributedTokens,
      remaining: pool.remainingTokens,
      rewardCount: pool.rewards.length,
    },
    distributions: distributionHistory.length,
  }, null, 2);
}
