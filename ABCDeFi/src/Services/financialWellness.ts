// ============================================================================
// Financial Wellness Metrics Engine
// Features: Savings, Investments, Loans, Learning Progress, Financial Goals
// ============================================================================

export interface FinancialGoal {
  id: string;
  title: string;
  category: 'Savings' | 'Loan Repayment' | 'Education' | 'Reputation';
  targetAmountUSD: number;
  currentAmountUSD: number;
  progressPct: number;
  targetDate: string;
  completed: boolean;
}

export interface FinancialWellnessOverview {
  wellnessScore: number; // 0 - 100 Health Rating
  assetsUSD: number;
  liabilitiesUSD: number;
  netWorthUSD: number;
  savingsUSD: number;
  investmentsUSD: number;
  loansUSD: number;
  stakingABCD: number;
  healthFactor: number;
  learningProgressPct: number;
  creditHoursEarned: number;
  creditScore: number;
  goals: FinancialGoal[];
}

export const USER_WELLNESS_DATA: FinancialWellnessOverview = {
  wellnessScore: 92, // Excellent Health
  assetsUSD: 43000,
  liabilitiesUSD: 3000,
  netWorthUSD: 40000,
  savingsUSD: 14500,
  investmentsUSD: 28500,
  loansUSD: 3000,
  stakingABCD: 12500,
  healthFactor: 2.45,
  learningProgressPct: 85,
  creditHoursEarned: 36,
  creditScore: 785,
  goals: [
    {
      id: 'g-1',
      title: 'Build $20,000 Liquid Savings Reserve',
      category: 'Savings',
      targetAmountUSD: 20000,
      currentAmountUSD: 14500,
      progressPct: 72.5,
      targetDate: '2026-12-31',
      completed: false,
    },
    {
      id: 'g-2',
      title: 'Complete Loan #101 Repayment',
      category: 'Loan Repayment',
      targetAmountUSD: 3000,
      currentAmountUSD: 2400,
      progressPct: 80.0,
      targetDate: '2026-09-15',
      completed: false,
    },
    {
      id: 'g-3',
      title: 'Earn Platinum Soulbound Reputation NFT',
      category: 'Reputation',
      targetAmountUSD: 850,
      currentAmountUSD: 880,
      progressPct: 100.0,
      targetDate: '2026-07-30',
      completed: true,
    },
  ],
};
