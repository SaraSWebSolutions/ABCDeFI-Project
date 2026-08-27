import { Contract, formatEther, isAddress, ZeroAddress } from 'ethers';
import ReferralArtifact from '../../artifacts/contracts/ico/ReferralManager.sol/ReferralManager.json';
import { DEPLOYMENT_CHAIN_ID, requireContractAddress } from '../Config/contracts';
import { getSigner, getWalletAddress } from './wallet';
import { provider as canonicalProvider } from './contractProvider';

export type TransactionSubmitted = (hash: string, stage: string) => void;

export interface ReferralHistoryRecord {
  buyer: string;
  purchaseAmount: string;
  rewardAmount: string;
  timestamp: string;
}

export interface ReferralSnapshot {
  contractAddress: string;
  tokenAddress: string;
  rewardVault: string;
  referralCode: string;
  referralLink: string;
  referrer: string | null;
  pendingRewards: string;
  pendingRewardsWei: bigint;
  claimedRewards: string;
  history: ReferralHistoryRecord[];
  rewardBps: string;
  paused: boolean;
  frozen: boolean;
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

/**
 * Ensures that a manifest entry is not merely an address-shaped stale local
 * deployment. Read calls always use the canonical RPC from deployments.json.
 */
export async function verifyReferralDeployment(): Promise<string> {
  const address = referralAddress();
  const network = await canonicalProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`ReferralManager RPC is on chain ${network.chainId}, expected ${DEPLOYMENT_CHAIN_ID}.`);
  }

  const code = await canonicalProvider.getCode(address);
  if (code === '0x') {
    throw new Error(`ReferralManager is unavailable on the current deployment at ${address}.`);
  }
  return address;
}

async function getReferralSignerContract() {
  const signer = await getSigner();
  const signerProvider = signer.provider;
  if (!signerProvider) throw new Error('Connected wallet provider is unavailable.');

  const network = await signerProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before submitting a referral transaction.`);
  }

  return new Contract(await verifyReferralDeployment(), ReferralArtifact.abi, signer);
}

export async function getReferralContract(withSigner = false) {
  if (withSigner) return getReferralSignerContract();
  return new Contract(await verifyReferralDeployment(), ReferralArtifact.abi, canonicalProvider);
}

/** Reads only the state emitted and stored by the deployed ReferralManager. */
export async function getReferralSnapshot(userAddress: string): Promise<ReferralSnapshot> {
  if (!isAddress(userAddress)) throw new Error('A valid connected wallet address is required for ReferralManager reads.');
  const contract = await getReferralContract(false);
  const [referralCode, referralLink, storedReferrer, pending, claimed, history, rewardBps, paused, frozen, tokenAddress, rewardVault] = await Promise.all([
    contract.userReferralCode(userAddress),
    contract.getReferralLink(userAddress),
    contract.referrerOf(userAddress),
    contract.pendingRewards(userAddress),
    contract.claimedRewards(userAddress),
    contract.getReferralHistory(userAddress),
    contract.REFERRAL_BPS(),
    contract.paused(),
    contract.isFrozen(userAddress),
    contract.token(),
    contract.rewardVault(),
  ]);

  return {
    contractAddress: await contract.getAddress(),
    tokenAddress,
    rewardVault,
    referralCode,
    referralLink,
    referrer: storedReferrer.toLowerCase() === ZeroAddress ? null : storedReferrer,
    pendingRewards: formatEther(pending),
    pendingRewardsWei: pending,
    claimedRewards: formatEther(claimed),
    history: history.map((entry: any) => ({
      buyer: entry.buyer,
      purchaseAmount: formatEther(entry.purchaseAmount),
      rewardAmount: formatEther(entry.rewardAmount),
      timestamp: new Date(Number(entry.timestamp) * 1000).toISOString(),
    })),
    rewardBps: rewardBps.toString(),
    paused: Boolean(paused),
    frozen: Boolean(frozen),
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

export function referralErrorMessage(error: unknown): string {
  const details = error as { code?: number | string; shortMessage?: string; info?: { error?: { message?: string } }; message?: string };
  if (details?.code === 4001 || details?.code === 'ACTION_REJECTED') {
    return 'Transaction rejected in MetaMask.';
  }
  return details?.shortMessage || details?.info?.error?.message || details?.message || 'Referral transaction failed.';
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
