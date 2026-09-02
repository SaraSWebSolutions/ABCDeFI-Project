import { Contract, formatEther, isAddress, parseEther } from 'ethers';
import StakingPoolArtifact from '../../artifacts/contracts/staking/StakingPool.sol/StakingPool.json';
import ABCDTokenABI from '../abi/ABCDToken.json';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID } from '../Config/contracts';
import { assertCanonicalContractDeployment, provider as canonicalProvider } from './contractProvider';
import { getSigner } from './wallet';

export const STAKING_LOCK_DURATIONS = [30 * 24 * 60 * 60, 90 * 24 * 60 * 60, 180 * 24 * 60 * 60] as const;

export interface StakingPosition {
  index: number;
  amount: string;
  amountRaw: bigint;
  startTime: bigint;
  lockDuration: bigint;
  unlockTime: bigint;
  rewardMultiplierBps: bigint;
  pendingRewards: string;
  pendingRewardsRaw: bigint;
  isUnlocked: boolean;
}

export interface StakingData {
  walletBalance: string;
  allowance: string;
  rewardPoolBalance: string;
  /** The deployed contract does not expose a global total staked value. */
  totalStaked: string;
  stakedAmount: string;
  rewards: string;
  paused: boolean;
  tiers: Array<{ lockDuration: number; rewardMultiplierBps: bigint }>;
  positions: StakingPosition[];
}

type TransactionSubmitted = (transactionHash: string) => void;

function parsePositiveAmount(amount: string, label = 'Stake'): bigint {
  const parsed = parseEther(amount);
  if (parsed <= 0n) throw new Error(`${label} amount must be greater than zero.`);
  return parsed;
}

async function getSignerOnDeploymentChain() {
  const signer = await getSigner();
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch MetaMask to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before using Staking.`);
  }
  return signer;
}

async function requireGasBalance(signer: Awaited<ReturnType<typeof getSignerOnDeploymentChain>>) {
  const balance = await signer.provider!.getBalance(await signer.getAddress());
  if (balance === 0n) throw new Error('Insufficient ETH for Staking transaction gas.');
}

async function confirm(transaction: { hash: string; wait: () => Promise<any> }, onSubmitted?: TransactionSubmitted) {
  onSubmitted?.(transaction.hash);
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error('Staking transaction was not confirmed on-chain.');
  return receipt;
}

export async function getStakingContract(withSigner = false) {
  await assertCanonicalContractDeployment('StakingPool', CONTRACTS.staking);
  const providerOrSigner = withSigner ? await getSignerOnDeploymentChain() : canonicalProvider;
  return new Contract(CONTRACTS.staking, StakingPoolArtifact.abi, providerOrSigner);
}

/** Reads the canonical localhost deployment. The caller address selects user-specific data. */
export async function getStakingInfo(userAddress?: string): Promise<StakingData> {
  if (!userAddress || !isAddress(userAddress)) throw new Error('Connect a valid wallet address to read user staking data.');
  const [contract] = await Promise.all([
    getStakingContract(false),
    assertCanonicalContractDeployment('ABCDToken', CONTRACTS.token),
  ]);
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, canonicalProvider);
  const [rawStakes, rewardPoolBalance, paused, walletBalance, allowance, block] = await Promise.all([
    contract.getStakes(userAddress), contract.rewardPoolBalance(), contract.paused(), token.balanceOf(userAddress),
    token.allowance(userAddress, CONTRACTS.staking), canonicalProvider.getBlock('latest'),
  ]);
  const currentTimestamp = BigInt(block?.timestamp ?? 0);
  const positions = await Promise.all(rawStakes.map(async (stake: {
    amount: bigint; startTime: bigint; lockDuration: bigint; rewardMultiplier: bigint;
  }, index: number) => {
    const pendingRewardsRaw = await contract.calculateRewards(userAddress, index);
    const unlockTime = stake.startTime + stake.lockDuration;
    return {
      index, amount: formatEther(stake.amount), amountRaw: stake.amount, startTime: stake.startTime,
      lockDuration: stake.lockDuration, unlockTime, rewardMultiplierBps: stake.rewardMultiplier,
      pendingRewards: formatEther(pendingRewardsRaw), pendingRewardsRaw,
      isUnlocked: stake.amount > 0n && currentTimestamp >= unlockTime,
    };
  }));
  const tiers = await Promise.all(STAKING_LOCK_DURATIONS.map(async (lockDuration) => ({
    lockDuration, rewardMultiplierBps: await contract.durationMultipliers(lockDuration),
  })));

  const activePositions = positions.filter((position) => position.amountRaw > 0n);
  const stakedAmountRaw = activePositions.reduce((total, position) => total + position.amountRaw, 0n);
  const rewardsRaw = activePositions.reduce((total, position) => total + position.pendingRewardsRaw, 0n);
  return {
    walletBalance: formatEther(walletBalance), allowance: formatEther(allowance), rewardPoolBalance: formatEther(rewardPoolBalance),
    totalStaked: 'Unavailable', stakedAmount: formatEther(stakedAmountRaw), rewards: formatEther(rewardsRaw),
    paused, tiers: tiers.filter((tier) => tier.rewardMultiplierBps > 0n), positions,
  };
}

export async function approveStaking(amount: string, onSubmitted?: TransactionSubmitted) {
  const value = parsePositiveAmount(amount, 'Approval');
  await assertCanonicalContractDeployment('ABCDToken', CONTRACTS.token);
  const signer = await getSignerOnDeploymentChain();
  await requireGasBalance(signer);
  const account = await signer.getAddress();
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, signer);
  if (await token.balanceOf(account) < value) throw new Error('Insufficient ABCD balance for this approval.');
  return confirm(await token.approve(CONTRACTS.staking, value), onSubmitted);
}

export async function stakeTokens(amount: string, lockDuration?: number, onSubmitted?: TransactionSubmitted) {
  const value = parsePositiveAmount(amount);
  if (!lockDuration || !STAKING_LOCK_DURATIONS.includes(lockDuration as typeof STAKING_LOCK_DURATIONS[number])) {
    throw new Error('Select an available on-chain lock tier before staking.');
  }
  await Promise.all([
    assertCanonicalContractDeployment('StakingPool', CONTRACTS.staking),
    assertCanonicalContractDeployment('ABCDToken', CONTRACTS.token),
  ]);
  const signer = await getSignerOnDeploymentChain();
  await requireGasBalance(signer);
  const account = await signer.getAddress();
  const [contract, token] = [new Contract(CONTRACTS.staking, StakingPoolArtifact.abi, signer), new Contract(CONTRACTS.token, ABCDTokenABI, signer)];
  const [paused, multiplier, balance, allowance] = await Promise.all([
    contract.paused(), contract.durationMultipliers(lockDuration), token.balanceOf(account), token.allowance(account, CONTRACTS.staking),
  ]);
  if (paused) throw new Error('StakingPool is paused. Staking is unavailable.');
  if (multiplier === 0n) throw new Error('The selected staking lock tier is unavailable on-chain.');
  if (balance < value) throw new Error('Insufficient ABCD balance for this stake.');
  if (allowance < value) throw new Error('Approve the StakingPool to transfer ABCD before staking.');
  return confirm(await contract.stake(value, lockDuration), onSubmitted);
}

async function getActivePosition(signer: Awaited<ReturnType<typeof getSignerOnDeploymentChain>>, stakeIndex: number) {
  if (!Number.isInteger(stakeIndex) || stakeIndex < 0) throw new Error('Select a valid staking position.');
  await assertCanonicalContractDeployment('StakingPool', CONTRACTS.staking);
  const account = await signer.getAddress();
  const contract = new Contract(CONTRACTS.staking, StakingPoolArtifact.abi, signer);
  const [paused, stakes, block] = await Promise.all([contract.paused(), contract.getStakes(account), signer.provider!.getBlock('latest')]);
  if (paused) throw new Error('StakingPool is paused. This action is unavailable.');
  const position = stakes[stakeIndex];
  if (!position || position.amount === 0n) throw new Error('This staking position is unavailable.');
  return { account, contract, position, timestamp: BigInt(block?.timestamp ?? 0) };
}

export async function unstakeTokens(stakeIndex: number, onSubmitted?: TransactionSubmitted) {
  const signer = await getSignerOnDeploymentChain();
  await requireGasBalance(signer);
  const { account, contract, position, timestamp } = await getActivePosition(signer, stakeIndex);
  if (timestamp < position.startTime + position.lockDuration) throw new Error('This staking position is still locked.');
  const [reward, rewardPoolBalance] = await Promise.all([contract.calculateRewards(account, stakeIndex), contract.rewardPoolBalance()]);
  if (reward > rewardPoolBalance) throw new Error('Staking reward pool is depleted; this position cannot be unstaked yet.');
  return confirm(await contract.unstake(stakeIndex), onSubmitted);
}

export async function claimStakingRewards(stakeIndex?: number, onSubmitted?: TransactionSubmitted) {
  if (stakeIndex === undefined) throw new Error('Select a staking position before claiming rewards.');
  const signer = await getSignerOnDeploymentChain();
  await requireGasBalance(signer);
  const { account, contract } = await getActivePosition(signer, stakeIndex);
  const [reward, rewardPoolBalance] = await Promise.all([contract.calculateRewards(account, stakeIndex), contract.rewardPoolBalance()]);
  if (reward === 0n) throw new Error('There are no claimable rewards for this position.');
  if (reward > rewardPoolBalance) throw new Error('Staking reward pool is depleted.');
  return confirm(await contract.claimRewards(stakeIndex), onSubmitted);
}

/** Legacy amount-based withdrawal is unsupported by StakingPool; use unstakeTokens(positionIndex). */
export async function withdrawStake(_amount: string) {
  throw new Error('Unstaking requires a position index and is available from the ABCD staking positions view.');
}

export function stakingErrorMessage(error: unknown): string {
  const details = error as { code?: string; shortMessage?: string; message?: string };
  if (details?.code === 'ACTION_REJECTED') return 'Transaction rejected in MetaMask.';
  const message = details?.shortMessage || details?.message || 'Staking contract call failed.';
  if (/insufficient funds|InsufficientBalance|ERC20InsufficientBalance/i.test(message)) return 'Insufficient balance for this staking transaction.';
  return message;
}
