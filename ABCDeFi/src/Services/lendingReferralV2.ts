import { Contract, formatEther, isAddress } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, getLendingV2Contracts } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getProvider, getSigner } from './wallet';
import ReferralArtifact from '../../artifacts/contracts/lending/v2/LendingReferralManagerV2.sol/LendingReferralManagerV2.json';

export type LendingReferralSnapshot = {
  address: string; code: string; referrer: string | null; monthlyRewardBps: string; rewardVault: string;
};
export type LendingReferralTransaction = { hash: string; blockNumber: string };
export type LendingReferralProjectionRecord = {
  loanId: string; requestId: string; referrer: string; referred: string; isLenderReferral: boolean;
  registered: boolean; startedAt: string; completedAt: string; monthlyReward: string; paidPeriods: string;
  totalRewards: string; availablePeriods: string; accruedAmount: string; claimableAmount: string;
  claimable: boolean; status: string;
  certificate: null | { tokenId: string; owner: string; uri: string; value: string; metadataHash: string; transferability: string };
};
export type LendingReferralProjection = {
  contract: string; code: string; referrer: string | null; rewardVault: string; monthlyRewardBps: string;
  maxRewardPeriods: string; rewardPeriodSeconds: string; records: LendingReferralProjectionRecord[];
};

function referralAddress() {
  const address = getLendingV2Contracts()?.referral;
  if (!address) throw new Error('Lending referral manager is unavailable on this canonical V2 deployment.');
  return address;
}

async function readContract() {
  const address = referralAddress();
  if ((await canonicalProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Canonical RPC is not Hardhat Local (31337).');
  if (await canonicalProvider.getCode(address) === '0x') throw new Error('Lending referral manager has no bytecode at its canonical manifest address.');
  return new Contract(address, ReferralArtifact.abi, canonicalProvider);
}

async function writeContract() {
  const [contract, walletProvider, signer] = await Promise.all([readContract(), getProvider(), getSigner()]);
  if ((await walletProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Switch MetaMask to Hardhat Local (31337) before submitting a lending referral transaction.');
  // Contract ABI methods are runtime-defined by ethers; preserve a narrow
  // local type boundary rather than weakening the read-side contract checks.
  return contract.connect(signer) as any;
}

async function confirmed(action: string, send: () => Promise<any>): Promise<LendingReferralTransaction> {
  const tx = await send();
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${action} was not confirmed successfully.`);
  return { hash: tx.hash, blockNumber: String(receipt.blockNumber) };
}

/** Canonical lending-only referral state. This deliberately never reads the legacy ICO ReferralManager. */
export async function getLendingReferralSnapshot(account: string): Promise<LendingReferralSnapshot> {
  if (!isAddress(account)) throw new Error('A valid connected wallet address is required.');
  const contract = await readContract();
  const [code, referrer, rewardBps, rewardVault] = await Promise.all([
    contract.userReferralCode(account), contract.referrerOf(account), contract.MONTHLY_REWARD_BPS(), contract.rewardVault(),
  ]);
  return { address: await contract.getAddress(), code, referrer: referrer === '0x0000000000000000000000000000000000000000' ? null : referrer, monthlyRewardBps: rewardBps.toString(), rewardVault };
}

export async function createLendingReferralCode(code: string) {
  const normalized = code.trim();
  if (normalized.length < 4) throw new Error('Referral codes must contain at least four characters.');
  const contract = await writeContract();
  return confirmed('Lending referral-code creation', () => contract.createReferralCode(normalized));
}

export async function bindLendingReferrer(code: string) {
  const normalized = code.trim();
  if (!normalized) throw new Error('Enter an existing on-chain lending referral code.');
  const contract = await writeContract();
  return confirmed('Lending referrer binding', () => contract.bindReferrer(normalized));
}

/** The contract itself prevents early/monthly and duplicate payouts. */
export async function claimLendingAccruedReward(loanId: string, referred: string) {
  if (!/^\d+$/.test(loanId) || BigInt(loanId) === 0n) throw new Error('Loan ID must be a positive integer.');
  if (!isAddress(referred)) throw new Error('Referred wallet must be a valid address.');
  const contract = await writeContract();
  return confirmed('Lending referral aggregate payout', () => contract.claimAccruedReward(BigInt(loanId), referred));
}

export async function getLendingReferralRecord(loanId: string, referred: string) {
  if (!/^\d+$/.test(loanId) || BigInt(loanId) === 0n || !isAddress(referred)) return null;
  const contract = await readContract();
  const value = await contract.getLoanReferral(BigInt(loanId), referred);
  return { registered: Boolean(value.registered), paidPeriods: value.paidPeriods.toString(), totalRewards: formatEther(value.totalRewards), monthlyReward: formatEther(value.monthlyReward), completedAt: value.completedAt.toString() };
}

/**
 * Read-only backend projection of the same canonical V2 referral contract.
 * The backend provides indexed event provenance while all reward eligibility
 * remains derived from on-chain referral and loan state.
 */
export async function getLendingReferralProjection(account: string): Promise<LendingReferralProjection> {
  if (!isAddress(account)) throw new Error('A valid connected wallet address is required.');
  const response = await fetch(`/api/lending-v2/referrals/${encodeURIComponent(account)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== 'AVAILABLE' || !payload?.data) throw new Error(payload?.reason || payload?.message || `Lending referral projection is unavailable (${response.status}).`);
  return payload.data as LendingReferralProjection;
}
