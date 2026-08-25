import { Contract, formatEther } from 'ethers';
import ReferralArtifact from '../../artifacts/contracts/ico/ReferralManager.sol/ReferralManager.json';
import { requireContractAddress } from '../Config/contracts';
import { getProvider, getSigner, getWalletAddress } from './wallet';

export type TransactionSubmitted = (hash: string, stage: string) => void;

export interface ReferralHistoryRecord {
  buyer: string;
  purchaseAmount: string;
  rewardAmount: string;
  timestamp: string;
}

export interface ReferralSnapshot {
  referralCode: string;
  referralLink: string;
  referrer: string | null;
  pendingRewards: string;
  claimedRewards: string;
  history: ReferralHistoryRecord[];
  rewardBps: string;
  paused: boolean;
}

function referralAddress() {
  return requireContractAddress('referral');
}

function confirmed(receipt: { status?: number | null } | null, label: string) {
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label} was reverted or not confirmed on-chain.`);
  }
  return receipt;
}

export async function getReferralContract(withSigner = false) {
  return new Contract(
    referralAddress(),
    ReferralArtifact.abi,
    withSigner ? await getSigner() : await getProvider(),
  );
}

/** Reads only the state emitted and stored by the deployed ReferralManager. */
export async function getReferralSnapshot(userAddress: string): Promise<ReferralSnapshot> {
  const contract = await getReferralContract(false);
  const [referralCode, referralLink, storedReferrer, pending, claimed, history, rewardBps, paused] = await Promise.all([
    contract.userReferralCode(userAddress),
    contract.getReferralLink(userAddress),
    contract.referrerOf(userAddress),
    contract.pendingRewards(userAddress),
    contract.claimedRewards(userAddress),
    contract.getReferralHistory(userAddress),
    contract.REFERRAL_BPS(),
    contract.paused(),
  ]);

  const noReferrer = '0x0000000000000000000000000000000000000000';
  return {
    referralCode,
    referralLink,
    referrer: storedReferrer.toLowerCase() === noReferrer ? null : storedReferrer,
    pendingRewards: formatEther(pending),
    claimedRewards: formatEther(claimed),
    history: history.map((entry: any) => ({
      buyer: entry.buyer,
      purchaseAmount: formatEther(entry.purchaseAmount),
      rewardAmount: formatEther(entry.rewardAmount),
      timestamp: new Date(Number(entry.timestamp) * 1000).toISOString(),
    })),
    rewardBps: rewardBps.toString(),
    paused: Boolean(paused),
  };
}

export async function createReferralCode(code: string, onSubmitted?: TransactionSubmitted) {
  const normalized = code.trim();
  if (normalized.length < 4) throw new Error('Referral codes must be at least four characters.');
  const contract = await getReferralContract(true);
  const tx = await contract.createReferralCode(normalized);
  onSubmitted?.(tx.hash, 'Referral code creation');
  return confirmed(await tx.wait(), 'Referral code creation');
}

export async function bindReferrerCode(code: string, onSubmitted?: TransactionSubmitted) {
  const normalized = code.trim();
  if (!normalized) throw new Error('Enter a referral code.');
  const contract = await getReferralContract(true);
  const tx = await contract.bindReferrer(normalized);
  onSubmitted?.(tx.hash, 'Referral binding');
  return confirmed(await tx.wait(), 'Referral binding');
}

export async function claimReferralRewards(onSubmitted?: TransactionSubmitted) {
  const contract = await getReferralContract(true);
  const tx = await contract.claimRewards();
  onSubmitted?.(tx.hash, 'Referral reward claim');
  return confirmed(await tx.wait(), 'Referral reward claim');
}

/**
 * Compatibility adapters for legacy dashboards. They return only deployed
 * ReferralManager state; callers must pass an on-chain referral *code*, not a
 * wallet address, because the contract has no register-by-address method.
 */
export async function getReferralStats(userAddress?: string) {
  const snapshot = await getReferralSnapshot(userAddress || await getWalletAddress());
  return {
    count: snapshot.history.length.toString(),
    rewards: snapshot.pendingRewards,
    referrer: snapshot.referrer ?? '0x0000000000000000000000000000000000000000',
  };
}

export async function registerReferral(referralCode: string) {
  if (/^0x[a-fA-F0-9]{40}$/.test(referralCode.trim())) {
    throw new Error('ReferralManager binds an on-chain referral code, not a wallet address.');
  }
  return bindReferrerCode(referralCode);
}

export const claimReferralReward = claimReferralRewards;
