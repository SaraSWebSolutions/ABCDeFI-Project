// ============================================================================
// Banking & Fiat Integration Engine (CeFi On-Ramp / Off-Ramp & Compliance)
// Features: Fiat Deposits, Fiat Withdrawals, Bank Account Linking, Stablecoin Conversion
// ============================================================================

export type FiatCurrency = 'USD' | 'EUR' | 'INR' | 'GBP';
export type BankingProvider = 'Plaid Gateway' | 'Stripe Treasury' | 'Circle Banking API' | 'Razorpay Banking';

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumberMasked: string; // e.g. ****6789
  routingOrIfscCode: string;
  currency: FiatCurrency;
  status: 'Verified' | 'Pending Verification';
}

export interface FiatTransaction {
  id: string;
  type: 'Deposit' | 'Withdrawal' | 'Stablecoin Conversion';
  fiatAmount: number;
  currency: FiatCurrency;
  stablecoinAmount: number; // USDC / USDT / ABCD
  provider: BankingProvider;
  bankAccountMasked: string;
  status: 'Completed' | 'Processing' | 'Compliance Review';
  regulatoryAmlStatus: 'Passed' | 'Screened';
  timestamp: string;
}

export const USER_LINKED_BANKS: BankAccount[] = [
  {
    id: 'bank-101',
    bankName: 'JPMorgan Chase Bank',
    accountHolderName: 'Alex Rivers',
    accountNumberMasked: '****6789',
    routingOrIfscCode: '021000021',
    currency: 'USD',
    status: 'Verified',
  },
  {
    id: 'bank-102',
    bankName: 'HDFC Bank (India)',
    accountHolderName: 'Alex Rivers',
    accountNumberMasked: '****4321',
    routingOrIfscCode: 'HDFC0001234',
    currency: 'INR',
    status: 'Verified',
  },
];

export const RECENT_FIAT_TRANSACTIONS: FiatTransaction[] = [
  {
    id: 'FIAT-8001',
    type: 'Deposit',
    fiatAmount: 5000,
    currency: 'USD',
    stablecoinAmount: 5000,
    provider: 'Circle Banking API',
    bankAccountMasked: 'JPMorgan Chase (****6789)',
    status: 'Completed',
    regulatoryAmlStatus: 'Passed',
    timestamp: '2026-07-30 09:30:00',
  },
  {
    id: 'FIAT-8002',
    type: 'Stablecoin Conversion',
    fiatAmount: 2500,
    currency: 'USD',
    stablecoinAmount: 2500,
    provider: 'Stripe Treasury',
    bankAccountMasked: 'Direct USD ➔ USDC Conversion',
    status: 'Completed',
    regulatoryAmlStatus: 'Passed',
    timestamp: '2026-07-29 16:15:00',
  },
];

/**
 * Execute 1:1 Instant Fiat-to-Stablecoin Conversion
 */
export async function executeFiatConversion(
  type: 'Deposit' | 'Withdrawal' | 'Stablecoin Conversion',
  fiatAmount: number,
  currency: FiatCurrency,
  bankAccountId: string
): Promise<FiatTransaction> {
  await new Promise((r) => setTimeout(r, 800));
  const bank = USER_LINKED_BANKS.find((b) => b.id === bankAccountId) || USER_LINKED_BANKS[0];

  const tx: FiatTransaction = {
    id: `FIAT-${Math.floor(Math.random() * 9000 + 1000)}`,
    type,
    fiatAmount,
    currency,
    stablecoinAmount: fiatAmount, // 1:1 Conversion
    provider: 'Circle Banking API',
    bankAccountMasked: `${bank.bankName} (${bank.accountNumberMasked})`,
    status: fiatAmount >= 10000 ? 'Compliance Review' : 'Completed',
    regulatoryAmlStatus: 'Passed',
    timestamp: new Date().toLocaleString(),
  };

  RECENT_FIAT_TRANSACTIONS.unshift(tx);
  return tx;
}
