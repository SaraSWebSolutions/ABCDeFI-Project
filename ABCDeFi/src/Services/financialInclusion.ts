// ============================================================================
// Financial Inclusion Scoring Engine
// Pillars: Participation (250), Learning (250), Contributions (250), Reputation (250)
// Total Score Range: 0 to 1000
// ============================================================================

export interface FinancialInclusionProfile {
  userAddress: string;
  participationScore: number; // Max 250 (Governance votes, referrals, tx count)
  learningScore: number;      // Max 250 (University courses, exam scores, credits)
  contributionScore: number;  // Max 250 (Liquidity provision, peer loan funding)
  reputationScore: number;    // Max 250 (Soulbound NFT level, credit history)
  totalInclusionScore: number;// Max 1000
  inclusionTier: 'Basic' | 'Silver Member' | 'Gold Ambassador' | 'Platinum Founding Fellow';
  unlockedPrivileges: string[];
  lastUpdated: string;
}

export const CURRENT_USER_INCLUSION_PROFILE: FinancialInclusionProfile = {
  userAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  participationScore: 215,
  learningScore: 230,
  contributionScore: 195,
  reputationScore: 240,
  totalInclusionScore: 880,
  inclusionTier: 'Platinum Founding Fellow',
  unlockedPrivileges: [
    '0% Interest Protocol Loans',
    'VIP Zero Origination Fee',
    'Priority Staking Pool Allocation',
    'University Certificate NFT Minting',
    'Governance Proposal Voting Rights',
  ],
  lastUpdated: 'Just now',
};

/**
 * Calculates Financial Inclusion Tier and unlocks based on total score (0 - 1000)
 */
export function calculateInclusionTier(totalScore: number): {
  tier: 'Basic' | 'Silver Member' | 'Gold Ambassador' | 'Platinum Founding Fellow';
  privileges: string[];
} {
  if (totalScore >= 850) {
    return {
      tier: 'Platinum Founding Fellow',
      privileges: [
        '0% Interest Protocol Loans',
        'VIP Zero Origination Fee',
        'Priority Staking Pool Allocation',
        'University Certificate NFT Minting',
        'Governance Proposal Voting Rights',
      ],
    };
  } else if (totalScore >= 700) {
    return {
      tier: 'Gold Ambassador',
      privileges: [
        '50% Discounted Protocol Fees',
        'Priority Staking Pool Allocation',
        'University Certificate NFT Minting',
      ],
    };
  } else if (totalScore >= 500) {
    return {
      tier: 'Silver Member',
      privileges: [
        '25% Discounted Protocol Fees',
        'University Certificate NFT Minting',
      ],
    };
  } else {
    return {
      tier: 'Basic',
      privileges: ['Standard Protocol Access'],
    };
  }
}
