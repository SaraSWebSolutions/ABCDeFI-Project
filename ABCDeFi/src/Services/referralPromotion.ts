// ============================================================================
// Referral Promotion Engine
// Whitepaper: 0.05% ICO reward from promotion allocation pool
// When User B buys using User A's referral, User A gets 0.05% from promo pool
// ============================================================================

import {
  awardPromotionReward,
  getPromotionPool,
  type PromotionReward,
} from './icoFundAllocation';

export interface ReferralLink {
  code: string;
  ownerAddress: string;
  ownerName: string;
  createdAt: string;
  totalReferrals: number;
  totalRewardTokens: number;
  isActive: boolean;
}

export interface ReferralPurchaseEvent {
  id: string;
  referrerAddress: string;
  purchaserAddress: string;
  purchaseAmountUSD: number;
  purchaseTokens: number;
  promotionReward: PromotionReward | null;
  timestamp: string;
}

// ============================================================================
// State
// ============================================================================

const referralLinks: ReferralLink[] = [
  {
    code: 'ALEX-REF-2026',
    ownerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    ownerName: 'Alex Rivers',
    createdAt: '2026-06-01',
    totalReferrals: 5,
    totalRewardTokens: 62.5,
    isActive: true,
  },
  {
    code: 'LIAM-REF-2026',
    ownerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    ownerName: 'Liam Vance',
    createdAt: '2026-06-15',
    totalReferrals: 3,
    totalRewardTokens: 31.25,
    isActive: true,
  },
  {
    code: 'ELENA-REF-2026',
    ownerAddress: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    ownerName: 'Elena Rostova',
    createdAt: '2026-07-01',
    totalReferrals: 8,
    totalRewardTokens: 95.0,
    isActive: true,
  },
  {
    code: 'SATOSHI-REF-2026',
    ownerAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    ownerName: 'Master Satoshi',
    createdAt: '2026-05-20',
    totalReferrals: 12,
    totalRewardTokens: 187.5,
    isActive: true,
  },
];

const purchaseEvents: ReferralPurchaseEvent[] = [];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate a new referral link for a user.
 */
export function createReferralLink(
  ownerAddress: string,
  ownerName: string
): ReferralLink {
  const code = `${ownerName.split(' ')[0].toUpperCase()}-REF-${new Date().getFullYear()}`;

  // Check if link already exists
  const existing = referralLinks.find(
    (l) => l.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()
  );
  if (existing) return existing;

  const link: ReferralLink = {
    code,
    ownerAddress,
    ownerName,
    createdAt: new Date().toISOString(),
    totalReferrals: 0,
    totalRewardTokens: 0,
    isActive: true,
  };

  referralLinks.push(link);
  return link;
}

/**
 * Process a referral purchase: awards 0.05% promo reward to referrer.
 * The reward comes from the promotion pool, NOT from the buyer's tokens.
 */
export function processReferralPurchase(
  referralCode: string,
  purchaserAddress: string,
  purchaseAmountUSD: number,
  purchaseTokens: number,
  tokenPrice: number = 0.08
): ReferralPurchaseEvent | null {
  // Find the referral link
  const link = referralLinks.find(
    (l) => l.code === referralCode && l.isActive
  );
  if (!link) return null;

  // Prevent self-referral
  if (link.ownerAddress.toLowerCase() === purchaserAddress.toLowerCase()) {
    return null;
  }

  // Award promotion reward from pool
  const promoReward = awardPromotionReward(
    link.ownerAddress,
    link.ownerName,
    purchaserAddress,
    purchaseAmountUSD,
    tokenPrice
  );

  // Update referral link stats
  link.totalReferrals += 1;
  if (promoReward) {
    link.totalRewardTokens += promoReward.rewardTokens;
  }

  const event: ReferralPurchaseEvent = {
    id: `rpe-${String(purchaseEvents.length + 1).padStart(3, '0')}`,
    referrerAddress: link.ownerAddress,
    purchaserAddress,
    purchaseAmountUSD,
    purchaseTokens,
    promotionReward: promoReward,
    timestamp: new Date().toISOString(),
  };

  purchaseEvents.push(event);
  return event;
}

/**
 * Get referral promotion history for a specific address.
 */
export function getReferralPromotionHistory(
  address: string
): ReferralPurchaseEvent[] {
  return purchaseEvents.filter(
    (e) => e.referrerAddress.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get all referral links.
 */
export function getAllReferralLinks(): ReferralLink[] {
  return [...referralLinks];
}

/**
 * Get a referral link by code.
 */
export function getReferralLinkByCode(code: string): ReferralLink | undefined {
  return referralLinks.find((l) => l.code === code);
}

/**
 * Admin: Toggle a referral link active/inactive.
 */
export function toggleReferralLink(code: string, active: boolean): boolean {
  const link = referralLinks.find((l) => l.code === code);
  if (!link) return false;
  link.isActive = active;
  return true;
}

/**
 * Get the remaining promotion pool balance.
 */
export function getPromotionPoolRemaining(): number {
  return getPromotionPool().remainingTokens;
}

/**
 * Get all purchase events.
 */
export function getAllPurchaseEvents(): ReferralPurchaseEvent[] {
  return [...purchaseEvents];
}
