// ============================================================================
// Bonus Engine — Multi-Type Bonus Calculation with 1.5% Supply Cap
// Whitepaper: Volume, Age, Referral, Financial Professional, Credit Report, Loyalty
// ============================================================================

export type BonusType =
  | 'volume'
  | 'age'
  | 'referral'
  | 'financial_professional'
  | 'credit_report'
  | 'loyalty';

export interface BonusRule {
  id: string;
  type: BonusType;
  label: string;
  description: string;
  bonusBps: number;           // basis points bonus (100 = 1%)
  fixedAmount?: number;       // optional fixed token amount
  isActive: boolean;
  requiresVerification: boolean;
  icon: string;
}

export interface BonusCalculation {
  bonusType: BonusType;
  label: string;
  eligible: boolean;
  reason: string;
  bonusTokens: number;
  bonusBps: number;
}

export interface UserBonusClaim {
  id: string;
  walletAddress: string;
  userName: string;
  purchaseAmountTokens: number;
  bonusBreakdown: BonusCalculation[];
  totalBonusTokens: number;
  claimedAt: string;
  txHash: string;
  status: 'pending' | 'approved' | 'distributed' | 'rejected';
}

export interface BonusPoolStatus {
  totalCapTokens: number;           // 1.5% of total supply = 15,000,000
  totalDistributedTokens: number;
  remainingTokens: number;
  capReached: boolean;
  utilizationPercent: number;
  claimsCount: number;
  byType: Record<BonusType, number>;
}

// ============================================================================
// Constants
// ============================================================================

const TOTAL_SUPPLY = 1_000_000_000;
const BONUS_CAP_BPS = 150;  // 1.5% of total supply
const BPS_DENOMINATOR = 10_000;
const BONUS_CAP_TOKENS = (TOTAL_SUPPLY * BONUS_CAP_BPS) / BPS_DENOMINATOR; // 15,000,000

// ============================================================================
// Bonus Rules (Whitepaper-compliant)
// ============================================================================

export const BONUS_RULES: BonusRule[] = [
  {
    id: 'vol-tier1',
    type: 'volume',
    label: 'Volume Tier 1: 10M+ ABCD',
    description: 'Purchase 10,000,000+ tokens → 300,000 ABCD bonus (3%)',
    bonusBps: 300,
    fixedAmount: 300_000,
    isActive: true,
    requiresVerification: false,
    icon: '📊',
  },
  {
    id: 'vol-tier2',
    type: 'volume',
    label: 'Volume Tier 2: 50M+ ABCD',
    description: 'Purchase 50,000,000+ tokens → 1,500,000 ABCD bonus (3%)',
    bonusBps: 300,
    fixedAmount: 1_500_000,
    isActive: true,
    requiresVerification: false,
    icon: '📈',
  },
  {
    id: 'age-18-25',
    type: 'age',
    label: 'Young Investor (18-25)',
    description: 'Verified age 18-25 receives extra 2% bonus on purchase',
    bonusBps: 200,
    isActive: true,
    requiresVerification: true,
    icon: '🎓',
  },
  {
    id: 'age-51-plus',
    type: 'age',
    label: 'Senior Investor (51+)',
    description: 'Verified age 51+ receives extra 1.5% bonus on purchase',
    bonusBps: 150,
    isActive: true,
    requiresVerification: true,
    icon: '👴',
  },
  {
    id: 'referral-bonus',
    type: 'referral',
    label: 'Referral Bonus',
    description: 'Referred users receive 1% extra bonus on first purchase',
    bonusBps: 100,
    isActive: true,
    requiresVerification: false,
    icon: '🤝',
  },
  {
    id: 'fin-pro',
    type: 'financial_professional',
    label: 'Financial Professional',
    description: 'Verified financial professionals receive 2.5% bonus',
    bonusBps: 250,
    isActive: true,
    requiresVerification: true,
    icon: '💼',
  },
  {
    id: 'credit-report',
    type: 'credit_report',
    label: 'Credit Report Submission',
    description: 'Users who submit credit report receive 1% bonus',
    bonusBps: 100,
    isActive: true,
    requiresVerification: true,
    icon: '📋',
  },
  {
    id: 'loyalty',
    type: 'loyalty',
    label: 'Returning Purchaser',
    description: 'Users with 2+ purchases receive 0.5% loyalty bonus',
    bonusBps: 50,
    isActive: true,
    requiresVerification: false,
    icon: '⭐',
  },
];

// ============================================================================
// Mutable State
// ============================================================================

const distributionByType: Record<BonusType, number> = {
  volume: 1_800_000,
  age: 45_000,
  referral: 125_000,
  financial_professional: 62_500,
  credit_report: 18_750,
  loyalty: 8_200,
};

let totalDistributed = Object.values(distributionByType).reduce((a, b) => a + b, 0);

const claimsHistory: UserBonusClaim[] = [
  {
    id: 'bc-001',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    userName: 'Alex Rivers',
    purchaseAmountTokens: 10_000_000,
    bonusBreakdown: [
      { bonusType: 'volume', label: 'Volume Tier 1', eligible: true, reason: 'Purchased 10M+ ABCD', bonusTokens: 300_000, bonusBps: 300 },
      { bonusType: 'referral', label: 'Referral Bonus', eligible: true, reason: 'Referred by Master Satoshi', bonusTokens: 100_000, bonusBps: 100 },
    ],
    totalBonusTokens: 400_000,
    claimedAt: '2026-07-18 10:30:00',
    txHash: '0xbc001aabb',
    status: 'distributed',
  },
  {
    id: 'bc-002',
    walletAddress: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    userName: 'Elena Rostova',
    purchaseAmountTokens: 50_000_000,
    bonusBreakdown: [
      { bonusType: 'volume', label: 'Volume Tier 2', eligible: true, reason: 'Purchased 50M+ ABCD', bonusTokens: 1_500_000, bonusBps: 300 },
      { bonusType: 'financial_professional', label: 'Financial Professional', eligible: true, reason: 'Verified CFA credential', bonusTokens: 62_500, bonusBps: 250 },
    ],
    totalBonusTokens: 1_562_500,
    claimedAt: '2026-07-20 14:15:00',
    txHash: '0xbc002ccdd',
    status: 'distributed',
  },
  {
    id: 'bc-003',
    walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    userName: 'Liam Vance',
    purchaseAmountTokens: 500_000,
    bonusBreakdown: [
      { bonusType: 'age', label: 'Young Investor (18-25)', eligible: true, reason: 'Age verified: 23', bonusTokens: 10_000, bonusBps: 200 },
      { bonusType: 'credit_report', label: 'Credit Report', eligible: true, reason: 'Credit report submitted', bonusTokens: 5_000, bonusBps: 100 },
    ],
    totalBonusTokens: 15_000,
    claimedAt: '2026-07-25 08:40:00',
    txHash: '0xbc003eeff',
    status: 'approved',
  },
];

// ============================================================================
// Core Bonus Calculation
// ============================================================================

export interface UserBonusProfile {
  walletAddress: string;
  kycVerified: boolean;
  ageVerified: boolean;
  ageBracket?: '18-25' | '26-35' | '36-50' | '51+';
  professionalVerified: boolean;
  creditReportSubmitted: boolean;
  referralCode?: string;
  purchaseCount: number;
}

/**
 * Calculate all eligible bonuses for a user based on their profile and purchase amount.
 */
export function calculateTotalBonus(
  purchaseAmountTokens: number,
  profile: UserBonusProfile
): BonusCalculation[] {
  const results: BonusCalculation[] = [];

  for (const rule of BONUS_RULES) {
    if (!rule.isActive) continue;

    const calc: BonusCalculation = {
      bonusType: rule.type,
      label: rule.label,
      eligible: false,
      reason: '',
      bonusTokens: 0,
      bonusBps: rule.bonusBps,
    };

    switch (rule.type) {
      case 'volume': {
        const minAmount = rule.id === 'vol-tier2' ? 50_000_000 : 10_000_000;
        if (purchaseAmountTokens >= minAmount) {
          calc.eligible = true;
          calc.reason = `Purchased ${(purchaseAmountTokens / 1_000_000).toFixed(1)}M+ ABCD`;
          calc.bonusTokens = rule.fixedAmount || (purchaseAmountTokens * rule.bonusBps) / BPS_DENOMINATOR;
        } else {
          calc.reason = `Requires ${(minAmount / 1_000_000).toFixed(0)}M+ ABCD purchase`;
        }
        break;
      }

      case 'age': {
        if (!profile.ageVerified) {
          calc.reason = 'Age verification required';
        } else if (rule.id === 'age-18-25' && profile.ageBracket === '18-25') {
          calc.eligible = true;
          calc.reason = `Age verified: ${profile.ageBracket}`;
          calc.bonusTokens = (purchaseAmountTokens * rule.bonusBps) / BPS_DENOMINATOR;
        } else if (rule.id === 'age-51-plus' && profile.ageBracket === '51+') {
          calc.eligible = true;
          calc.reason = `Age verified: ${profile.ageBracket}`;
          calc.bonusTokens = (purchaseAmountTokens * rule.bonusBps) / BPS_DENOMINATOR;
        } else {
          calc.reason = `Age bracket ${profile.ageBracket || 'unknown'} not eligible for this tier`;
        }
        break;
      }

      case 'referral': {
        if (profile.referralCode) {
          calc.eligible = true;
          calc.reason = `Referred by ${profile.referralCode}`;
          calc.bonusTokens = (purchaseAmountTokens * rule.bonusBps) / BPS_DENOMINATOR;
        } else {
          calc.reason = 'No referral code provided';
        }
        break;
      }

      case 'financial_professional': {
        if (profile.professionalVerified) {
          calc.eligible = true;
          calc.reason = 'Verified financial professional';
          calc.bonusTokens = (purchaseAmountTokens * rule.bonusBps) / BPS_DENOMINATOR;
        } else {
          calc.reason = 'Professional credential verification required';
        }
        break;
      }

      case 'credit_report': {
        if (profile.creditReportSubmitted) {
          calc.eligible = true;
          calc.reason = 'Credit report submitted';
          calc.bonusTokens = (purchaseAmountTokens * rule.bonusBps) / BPS_DENOMINATOR;
        } else {
          calc.reason = 'Credit report not submitted';
        }
        break;
      }

      case 'loyalty': {
        if (profile.purchaseCount >= 2) {
          calc.eligible = true;
          calc.reason = `${profile.purchaseCount} previous purchases`;
          calc.bonusTokens = (purchaseAmountTokens * rule.bonusBps) / BPS_DENOMINATOR;
        } else {
          calc.reason = 'Requires 2+ previous purchases';
        }
        break;
      }
    }

    results.push(calc);
  }

  // Apply 1.5% cap check
  const totalBonus = results.filter((r) => r.eligible).reduce((s, r) => s + r.bonusTokens, 0);
  const poolRemaining = BONUS_CAP_TOKENS - totalDistributed;

  if (totalBonus > poolRemaining) {
    // Scale down proportionally
    const scale = poolRemaining / totalBonus;
    for (const r of results) {
      if (r.eligible) {
        r.bonusTokens = Math.floor(r.bonusTokens * scale);
        r.reason += ` (scaled to ${(scale * 100).toFixed(1)}% — pool cap)`;
      }
    }
  }

  return results;
}

/**
 * Claim bonuses — records the claim and deducts from pool.
 */
export function claimBonus(
  walletAddress: string,
  userName: string,
  purchaseAmountTokens: number,
  bonusBreakdown: BonusCalculation[]
): UserBonusClaim | null {
  const eligible = bonusBreakdown.filter((b) => b.eligible);
  if (eligible.length === 0) return null;

  const totalBonus = eligible.reduce((s, b) => s + b.bonusTokens, 0);
  const remaining = BONUS_CAP_TOKENS - totalDistributed;

  if (remaining <= 0) return null;

  const actualBonus = Math.min(totalBonus, remaining);

  const claim: UserBonusClaim = {
    id: `bc-${String(claimsHistory.length + 1).padStart(3, '0')}`,
    walletAddress,
    userName,
    purchaseAmountTokens,
    bonusBreakdown: eligible,
    totalBonusTokens: actualBonus,
    claimedAt: new Date().toISOString(),
    txHash: `0x${Math.random().toString(16).substring(2, 14)}`,
    status: 'pending',
  };

  totalDistributed += actualBonus;

  // Update per-type tracking
  for (const b of eligible) {
    distributionByType[b.bonusType] = (distributionByType[b.bonusType] || 0) + b.bonusTokens;
  }

  claimsHistory.push(claim);
  return claim;
}

/**
 * Admin: Approve or reject a bonus claim.
 */
export function updateClaimStatus(
  claimId: string,
  status: 'approved' | 'distributed' | 'rejected'
): boolean {
  const claim = claimsHistory.find((c) => c.id === claimId);
  if (!claim) return false;

  if (status === 'rejected' && claim.status !== 'distributed') {
    // Refund to pool
    totalDistributed -= claim.totalBonusTokens;
    for (const b of claim.bonusBreakdown) {
      distributionByType[b.bonusType] = Math.max(0, (distributionByType[b.bonusType] || 0) - b.bonusTokens);
    }
  }

  claim.status = status;
  return true;
}

/**
 * Admin: Toggle a bonus rule active/inactive.
 */
export function toggleBonusRule(ruleId: string, active: boolean): boolean {
  const rule = BONUS_RULES.find((r) => r.id === ruleId);
  if (!rule) return false;
  rule.isActive = active;
  return true;
}

// ============================================================================
// View Functions
// ============================================================================

export function getBonusPoolStatus(): BonusPoolStatus {
  return {
    totalCapTokens: BONUS_CAP_TOKENS,
    totalDistributedTokens: totalDistributed,
    remainingTokens: BONUS_CAP_TOKENS - totalDistributed,
    capReached: totalDistributed >= BONUS_CAP_TOKENS,
    utilizationPercent: (totalDistributed / BONUS_CAP_TOKENS) * 100,
    claimsCount: claimsHistory.length,
    byType: { ...distributionByType },
  };
}

export function getBonusRules(): BonusRule[] {
  return [...BONUS_RULES];
}

export function getClaimsHistory(): UserBonusClaim[] {
  return [...claimsHistory];
}

export function getClaimsByWallet(walletAddress: string): UserBonusClaim[] {
  return claimsHistory.filter(
    (c) => c.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
}

export { BONUS_CAP_TOKENS, TOTAL_SUPPLY };
