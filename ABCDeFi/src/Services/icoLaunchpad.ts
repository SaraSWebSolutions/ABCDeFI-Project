// ==========================================
// Step 20: ICO Launchpad — Service Layer
// ==========================================

export interface SalePhase {
  id: 'private' | 'presale' | 'public';
  name: string;
  label: string;
  icon: string;
  color: string;
  tokenPrice: number;        // USD per ABCD
  hardCap: number;           // USD
  softCap: number;           // USD
  minBuy: number;            // USD
  maxBuy: number;            // USD
  totalTokens: number;       // ABCD
  soldTokens: number;        // ABCD
  raised: number;            // USD
  startsAt: string;
  endsAt: string;
  status: 'Upcoming' | 'Live' | 'Ended' | 'Filled';
  bonus: number;             // % bonus tokens
  whitelist: boolean;        // requires whitelist
}

export interface TokenAllocation {
  label: string;
  pct: number;
  tokens: string;
  color: string;
  lockup: string;
}

export interface VestingSchedule {
  category: string;
  cliff: string;
  duration: string;
  tgeUnlock: number;        // % unlocked at TGE
  icon: string;
}

export interface UserContribution {
  phase: SalePhase['id'];
  amountUSD: number;
  tokensPurchased: number;
  bonusTokens: number;
  txHash: string;
  purchasedAt: string;
  claimedAt?: string;
}

export const SALE_PHASES: SalePhase[] = [
  {
    id: 'private',
    name: 'Private Sale',
    label: 'Phase 1',
    icon: '🔒',
    color: 'from-purple-700/30 to-indigo-900/30 border-purple-500/40',
    tokenPrice: 0.02,
    hardCap: 500_000,
    softCap: 100_000,
    minBuy: 10_000,
    maxBuy: 100_000,
    totalTokens: 25_000_000,
    soldTokens: 25_000_000,
    raised: 500_000,
    startsAt: 'Jan 15, 2026',
    endsAt: 'Feb 28, 2026',
    status: 'Filled',
    bonus: 30,
    whitelist: true,
  },
  {
    id: 'presale',
    name: 'Presale',
    label: 'Phase 2',
    icon: '⚡',
    color: 'from-amber-700/30 to-orange-900/30 border-amber-500/40',
    tokenPrice: 0.04,
    hardCap: 1_500_000,
    softCap: 500_000,
    minBuy: 500,
    maxBuy: 50_000,
    totalTokens: 37_500_000,
    soldTokens: 31_200_000,
    raised: 1_248_000,
    startsAt: 'Mar 15, 2026',
    endsAt: 'May 30, 2026',
    status: 'Ended',
    bonus: 15,
    whitelist: false,
  },
  {
    id: 'public',
    name: 'Public Sale',
    label: 'Phase 3',
    icon: '🌍',
    color: 'from-emerald-700/30 to-teal-900/30 border-emerald-500/40',
    tokenPrice: 0.08,
    hardCap: 4_000_000,
    softCap: 1_000_000,
    minBuy: 50,
    maxBuy: 25_000,
    totalTokens: 50_000_000,
    soldTokens: 28_400_000,
    raised: 2_272_000,
    startsAt: 'Jul 1, 2026',
    endsAt: 'Sep 30, 2026',
    status: 'Live',
    bonus: 5,
    whitelist: false,
  },
];

export const TOKEN_ALLOCATIONS: TokenAllocation[] = [
  { label: 'Founder Allocation',    pct: 55, tokens: '550,000,000,000,000', color: '#2563eb', lockup: '12-month cliff, 36-month linear vest' },
  { label: 'ICO Sale Module',       pct: 20, tokens: '200,000,000,000,000', color: '#059669', lockup: 'Stage 1 -> Stage 2 -> Stage 3 (Auto Rollover)' },
  { label: 'Partnerships & Mktg',   pct: 10, tokens: '100,000,000,000,000', color: '#ea580c', lockup: 'Linear 24-month marketing release' },
  { label: 'Finance Resource',      pct: 9,  tokens: '90,000,000,000,000',  color: '#0891b2', lockup: 'Loans, Liquidity & Emergency Lending' },
  { label: 'Advisors',              pct: 2,  tokens: '20,000,000,000,000',  color: '#7c3aed', lockup: '6-month cliff, 18-month vest' },
  { label: 'Contingency Fund',      pct: 2,  tokens: '20,000,000,000,000',  color: '#dc2626', lockup: 'Multisig Emergency Vault' },
  { label: 'Protocol Reserve',      pct: 2,  tokens: '20,000,000,000,000',  color: '#6366f1', lockup: 'Recycle Unsold ICO & Unused Bonus' },
];

export const VESTING_SCHEDULES: VestingSchedule[] = [
  { category: 'Private Sale',        cliff: '6 months',  duration: '24 months', tgeUnlock: 0,   icon: '🔒' },
  { category: 'Presale',             cliff: '3 months',  duration: '18 months', tgeUnlock: 10,  icon: '⚡' },
  { category: 'Public Sale',         cliff: 'None',      duration: '12 months', tgeUnlock: 25,  icon: '🌍' },
  { category: 'Team & Advisors',     cliff: '12 months', duration: '36 months', tgeUnlock: 0,   icon: '👥' },
  { category: 'Ecosystem & Rewards', cliff: 'None',      duration: '48 months', tgeUnlock: 5,   icon: '🌐' },
  { category: 'Liquidity',           cliff: '12 months', duration: '12 months', tgeUnlock: 0,   icon: '💧' },
];

export const USER_CONTRIBUTIONS: UserContribution[] = [
  {
    phase: 'public',
    amountUSD: 2000,
    tokensPurchased: 25_000,
    bonusTokens: 1_250,
    txHash: '0x7f3c...4a2b',
    purchasedAt: 'Jul 15, 2026',
  },
];

export const TOTAL_SUPPLY = 1_000_000_000_000_000; // 1 Quadrillion ABCD

// Summary Stats
export const ICO_STATS = {
  totalRaised: SALE_PHASES.reduce((s, p) => s + p.raised, 0),
  totalParticipants: 12_847,
  tokensSold: SALE_PHASES.reduce((s, p) => s + p.soldTokens, 0),
  launchPrice: 0.12,          // Expected listing price
  currentPhase: 'public' as SalePhase['id'],
};

import { buyTokens as presaleBuyTokens } from './presale';
import { getSigner } from './wallet';
import { parseEther } from 'ethers';

// Service functions
export async function buyTokens(phaseId: SalePhase['id'], ethAmount: string): Promise<UserContribution> {
  const receipt = await presaleBuyTokens(ethAmount);
  if (!receipt?.hash) throw new Error('Presale transaction did not return a transaction hash');
  const phase = SALE_PHASES.find((p) => p.id === phaseId);
  if (!phase) throw new Error(`Unknown presale phase: ${phaseId}`);
  return {
    phase: phaseId,
    amountUSD: 0,
    tokensPurchased: 0,
    bonusTokens: 0,
    txHash: receipt.hash,
    purchasedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  };
}
