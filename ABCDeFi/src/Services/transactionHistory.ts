export type TransactionType =
  | 'Token Transfer'
  | 'Buy Token'
  | 'Stake'
  | 'Unstake'
  | 'Claim Reward'
  | 'Borrow'
  | 'Repay'
  | 'Deposit Collateral'
  | 'Release Collateral'
  | 'NFT Mint'
  | 'NFT Purchase'
  | 'Referral Reward'
  | 'Protocol Event';

export interface TransactionRecord {
  id: string;
  txHash: string;
  userAddress: string;
  type: TransactionType;
  amount: string;
  token: string;
  status: 'Completed' | 'Pending' | 'Failed';
  loanId?: string;
  nftId?: string;
  blockNumber: number;
  timestamp: string | null;
  network: string;
}

interface TransactionHistoryResponse {
  success: boolean;
  data?: TransactionRecord[];
  message?: string;
}

/**
 * Reads only indexed events belonging to the wallet explicitly connected in
 * this browser session. The API independently checks that the wallet belongs
 * to the authenticated user on the canonical manifest chain.
 */
export async function getTransactions(
  token: string,
  walletAddress: string,
  signal?: AbortSignal,
): Promise<TransactionRecord[]> {
  const response = await fetch(`/api/transactions?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const body = await response.json().catch(() => ({})) as TransactionHistoryResponse;
  if (!response.ok || !body.success) {
    throw new Error(body.message || `Transaction history request failed (${response.status})`);
  }
  return body.data || [];
}
