// ============================================================================
// Dynamic Reserve Allocation & Full Accounting Engine (Whitepaper Specific)
// Flow: Interest ➔ Reserve ➔ Treasury ➔ Lenders ➔ Liquidity / Protocol Income
// ============================================================================

export interface ReserveWalletBalances {
  lendingPoolBalance: string;
  reservePoolBalance: string;
  rewardsPoolBalance: string;
  treasuryWalletBalance: string;
  liquidityPoolBalance: string;
  protocolIncomeBalance: string;
  lastUpdated: string;
}

export interface DynamicReserveWaterfallBreakdown {
  totalInterestPaidUSD: number;
  reserveAllocationUSD: number;   // 25% Reserve Allocation
  treasuryAllocationUSD: number;  // 25% Treasury Allocation
  lendersShareUSD: number;         // 40% Lender Share
  protocolIncomeUSD: number;       // 10% Protocol Income & DEX Liquidity
  txHash: string;
  timestamp: string;
}

export const INITIAL_RESERVE_WALLETS: ReserveWalletBalances = {
  lendingPoolBalance: '7,400,000 USDC',
  reservePoolBalance: '2,800,000 USDC',
  rewardsPoolBalance: '1,250,000 ABCD',
  treasuryWalletBalance: '5,100,000 USDC',
  liquidityPoolBalance: '1,850,000 USDC',
  protocolIncomeBalance: '392,000 USDC',
  lastUpdated: 'Just now',
};

export const RECENT_WATERFALL_ALLOCATIONS: DynamicReserveWaterfallBreakdown[] = [
  {
    totalInterestPaidUSD: 10000,
    reserveAllocationUSD: 2500,
    treasuryAllocationUSD: 2500,
    lendersShareUSD: 4000,
    protocolIncomeUSD: 1000,
    txHash: '0x8f2a9c1e4b85721d',
    timestamp: '2026-07-30 11:30:00',
  },
  {
    totalInterestPaidUSD: 25000,
    reserveAllocationUSD: 6250,
    treasuryAllocationUSD: 6250,
    lendersShareUSD: 10000,
    protocolIncomeUSD: 2500,
    txHash: '0x3c9d7b210f94821a',
    timestamp: '2026-07-29 17:10:00',
  },
];

/**
 * Step 7 & Whitepaper – Dynamic Reserve Allocation Waterfall Engine
 * Flow: Interest ➔ Reserve ➔ Treasury ➔ Lenders ➔ Liquidity / Protocol Income
 */
export function executeDynamicReserveWaterfall(interestPaidUSD: number): DynamicReserveWaterfallBreakdown {
  const reserveAllocationUSD = interestPaidUSD * 0.25;  // 25%
  const treasuryAllocationUSD = interestPaidUSD * 0.25; // 25%
  const lendersShareUSD = interestPaidUSD * 0.40;        // 40%
  const protocolIncomeUSD = interestPaidUSD * 0.10;      // 10%

  const breakdown: DynamicReserveWaterfallBreakdown = {
    totalInterestPaidUSD: interestPaidUSD,
    reserveAllocationUSD,
    treasuryAllocationUSD,
    lendersShareUSD,
    protocolIncomeUSD,
    txHash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
    timestamp: new Date().toLocaleString(),
  };

  RECENT_WATERFALL_ALLOCATIONS.unshift(breakdown);
  return breakdown;
}

// ============================================================================
// Bonus → Reserve Automatic Transfer Logic
// Whitepaper: Unused bonus allocation auto-transfers to Reserve Pool
// ============================================================================

export interface BonusReserveTransfer {
  id: string;
  tokensTransferred: number;
  reason: 'ico_phase_ended' | 'cap_reached' | 'admin_sweep' | 'expiry';
  reasonLabel: string;
  fromPool: 'bonus' | 'promotion';
  toPool: 'reserve';
  triggeredBy: 'automatic' | 'admin';
  txHash: string;
  timestamp: string;
}

const reserveTransfers: BonusReserveTransfer[] = [
  {
    id: 'brt-001',
    tokensTransferred: 250_000,
    reason: 'ico_phase_ended',
    reasonLabel: 'Private Sale phase ended — unused bonus allocation swept to Reserve',
    fromPool: 'bonus',
    toPool: 'reserve',
    triggeredBy: 'automatic',
    txHash: '0xrt001aabb1234',
    timestamp: '2026-03-01 00:00:00',
  },
  {
    id: 'brt-002',
    tokensTransferred: 85_000,
    reason: 'ico_phase_ended',
    reasonLabel: 'Presale phase ended — unused bonus allocation swept to Reserve',
    fromPool: 'bonus',
    toPool: 'reserve',
    triggeredBy: 'automatic',
    txHash: '0xrt002ccdd5678',
    timestamp: '2026-06-01 00:00:00',
  },
];

let totalTransferredToReserve = reserveTransfers.reduce((s, t) => s + t.tokensTransferred, 0);

/**
 * Check and transfer unused bonus tokens to the Reserve pool.
 * Triggered when: ICO phase ends, bonus cap reached, or admin manually sweeps.
 */
export function checkAndTransferUnusedBonuses(
  unusedBonusTokens: number,
  reason: BonusReserveTransfer['reason'],
  triggeredBy: 'automatic' | 'admin' = 'automatic'
): BonusReserveTransfer | null {
  if (unusedBonusTokens <= 0) return null;

  const reasonLabels: Record<BonusReserveTransfer['reason'], string> = {
    ico_phase_ended: 'ICO phase ended — unused bonus allocation swept to Reserve',
    cap_reached: 'Bonus cap (1.5%) reached — remaining tokens transferred to Reserve',
    admin_sweep: 'Admin manually swept unused bonus tokens to Reserve',
    expiry: 'Bonus claim period expired — unclaimed tokens transferred to Reserve',
  };

  const transfer: BonusReserveTransfer = {
    id: `brt-${String(reserveTransfers.length + 1).padStart(3, '0')}`,
    tokensTransferred: unusedBonusTokens,
    reason,
    reasonLabel: reasonLabels[reason],
    fromPool: 'bonus',
    toPool: 'reserve',
    triggeredBy,
    txHash: `0x${Math.random().toString(16).substring(2, 14)}`,
    timestamp: new Date().toISOString(),
  };

  reserveTransfers.push(transfer);
  totalTransferredToReserve += unusedBonusTokens;

  return transfer;
}

/**
 * Get all bonus → reserve transfer history.
 */
export function getReserveTransferHistory(): BonusReserveTransfer[] {
  return [...reserveTransfers];
}

/**
 * Get total tokens transferred from bonus pool to reserve.
 */
export function getTotalTransferredToReserve(): number {
  return totalTransferredToReserve;
}

/**
 * Get reserve transfer summary stats.
 */
export function getReserveTransferStats() {
  return {
    totalTransfers: reserveTransfers.length,
    totalTokensTransferred: totalTransferredToReserve,
    automaticTransfers: reserveTransfers.filter((t) => t.triggeredBy === 'automatic').length,
    adminSweeps: reserveTransfers.filter((t) => t.triggeredBy === 'admin').length,
    byReason: {
      ico_phase_ended: reserveTransfers.filter((t) => t.reason === 'ico_phase_ended').reduce((s, t) => s + t.tokensTransferred, 0),
      cap_reached: reserveTransfers.filter((t) => t.reason === 'cap_reached').reduce((s, t) => s + t.tokensTransferred, 0),
      admin_sweep: reserveTransfers.filter((t) => t.reason === 'admin_sweep').reduce((s, t) => s + t.tokensTransferred, 0),
      expiry: reserveTransfers.filter((t) => t.reason === 'expiry').reduce((s, t) => s + t.tokensTransferred, 0),
    },
  };
}

