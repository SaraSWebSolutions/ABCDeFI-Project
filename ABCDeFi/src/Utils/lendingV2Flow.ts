import { parseEther } from 'ethers';
import type { V2PendingDeposit, V2Read } from '../Services/lendingV2';

export const validId = (value: string) => /^\d+$/.test(value) && BigInt(value) > 0n;
export function positiveAmount(value: string): boolean {
  try { return /^\d+(\.\d+)?$/.test(value) && parseEther(value) > 0n; } catch { return false; }
}
export function withinCapacity(value: string, maximum: string): boolean {
  try { return positiveAmount(value) && positiveAmount(maximum) && parseEther(value) <= parseEther(maximum); } catch { return false; }
}
/** Decimal strings can differ textually (for example, `70` and `70.0`) while
 * representing the same on-chain ABCD amount. */
export function sameAmount(value: string, other: string): boolean {
  try { return positiveAmount(value) && positiveAmount(other) && parseEther(value) === parseEther(other); } catch { return false; }
}
export const validTerm = (value: string) => ['30', '90', '180'].includes(value);
export const sameWallet = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

export function borrowBlocker(input: { deposit: V2PendingDeposit | null; depositId: string; address?: string | null; connected: boolean; correctNetwork: boolean; loading: boolean; error: string | null; principal: string; term: string }): string | null {
  const { deposit } = input;
  if (!input.connected || !input.address) return 'Connect your wallet to borrow.';
  if (!input.correctNetwork) return 'Switch your wallet to Hardhat Local (31337).';
  if (input.loading) return 'Reading borrowing capacity…';
  if (input.error) return 'Refresh the borrowing preview before continuing.';
  if (!deposit || deposit.depositId !== input.depositId || !deposit.active) return 'Select an active pending deposit first.';
  if (!sameWallet(deposit.borrower, input.address)) return 'This deposit belongs to another wallet.';
  if (!positiveAmount(deposit.maxBorrowable)) return 'This deposit has no available borrowing capacity.';
  if (!positiveAmount(input.principal)) return 'Enter a positive ABCD principal (up to 18 decimal places).';
  if (!withinCapacity(input.principal, deposit.maxBorrowable)) return `Principal exceeds the on-chain maximum of ${deposit.maxBorrowable} ABCD.`;
  if (!validTerm(input.term)) return 'Choose a 30, 90, or 180 day term.';
  return null;
}

export type DirectStage = 'IDLE' | 'DEPOSITING' | 'DEPOSIT_CONFIRMED' | 'CAPACITY_LOADING' | 'CAPACITY_READY' | 'BORROWING' | 'LOAN_ACTIVE' | 'REPAYING' | 'LOAN_REPAID' | 'COLLATERAL_WITHDRAWABLE' | 'COLLATERAL_WITHDRAWN' | 'MARGIN_CALL' | 'CURE_BY_REPAYMENT' | 'CURE_BY_COLLATERAL' | 'DEFAULTED' | 'LIQUIDATION_ELIGIBLE' | 'LIQUIDATED';
export function directStage({ loan, deposit, capacityLoading, operation, depositConfirmed }: { loan: V2Read | null; deposit: V2PendingDeposit | null; capacityLoading: boolean; operation: string | null; depositConfirmed: boolean }): DirectStage {
  if (operation === 'Collateral deposit') return 'DEPOSITING';
  if (operation === 'Borrow') return 'BORROWING';
  if (operation?.includes('repayment')) return loan?.state === 6 ? 'CURE_BY_REPAYMENT' : 'REPAYING';
  if (operation === 'Loan collateral top-up' && loan?.state === 6) return 'CURE_BY_COLLATERAL';
  if (loan) {
    if (loan.state === 5 && !positiveAmount(loan.collateralETH)) return 'COLLATERAL_WITHDRAWN';
    if (loan.state === 4) return 'LIQUIDATED';
    if (loan.state === 1 && !positiveAmount(loan.outstanding)) return positiveAmount(loan.collateralETH) ? 'COLLATERAL_WITHDRAWABLE' : 'LOAN_REPAID';
    if (loan.liquidatable) return 'LIQUIDATION_ELIGIBLE';
    if (loan.state === 3) return 'DEFAULTED';
    if (loan.state === 6) return 'MARGIN_CALL';
    return 'LOAN_ACTIVE';
  }
  if (capacityLoading) return 'CAPACITY_LOADING';
  if (deposit?.active && positiveAmount(deposit.maxBorrowable)) return 'CAPACITY_READY';
  return depositConfirmed ? 'DEPOSIT_CONFIRMED' : 'IDLE';
}

export function loanActions(loan: V2Read | null, address?: string | null) {
  const owned = !!loan && sameWallet(loan.borrower, address);
  const active = !!loan && [0, 2, 6].includes(loan.state);
  return {
    repay: owned && active && positiveAmount(loan!.outstanding),
    topUp: owned && active && positiveAmount(loan!.collateralETH),
    withdraw: owned && loan?.state === 1 && !positiveAmount(loan.outstanding) && positiveAmount(loan.collateralETH),
  };
}
