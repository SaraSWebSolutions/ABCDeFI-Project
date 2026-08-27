import { Contract, Interface, formatEther, formatUnits, keccak256, toUtf8Bytes } from 'ethers';
import PresaleArtifact from '../../artifacts/contracts/ico/Presale.sol/Presale.json';
import ABCDTokenArtifact from '../../artifacts/contracts/token/ABCDToken.sol/ABCDToken.json';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getSigner } from './wallet';

export type PresaleAdminStatus = 'Pending' | 'Active' | 'Ended' | 'Finalized' | 'Cancelled';
export type PresaleAdminAction =
  | 'start'
  | 'pause'
  | 'unpause'
  | 'cancel'
  | 'cancelFailed'
  | 'finalize'
  | 'withdraw';

export interface PresaleAdminRoles {
  defaultAdmin: boolean;
  presaleAdmin: boolean;
  pauser: boolean;
}

export interface AdminPresaleData {
  contractAddress: string;
  tokenAddress: string;
  treasuryAddress: string;
  status: PresaleAdminStatus;
  rate: string;
  rateRaw: bigint;
  softCap: string;
  softCapRaw: bigint;
  hardCap: string;
  hardCapRaw: bigint;
  minBuy: string;
  minBuyRaw: bigint;
  maxBuy: string;
  maxBuyRaw: bigint;
  totalEthRaised: string;
  totalEthRaisedRaw: bigint;
  totalTokensSold: string;
  totalTokensSoldRaw: bigint;
  tokenReserve: string;
  tokenReserveRaw: bigint;
  startTime: bigint;
  endTime: bigint;
  isPaused: boolean;
  isFinalized: boolean;
  isCancelled: boolean;
  adminAddress: string | null;
  roles: PresaleAdminRoles;
}

export interface PresaleAdminTransactionResult {
  transactionHash: string;
  blockNumber: number;
  eventNames: string[];
  state: AdminPresaleData;
}

type SubmittedCallback = (transactionHash: string) => void;

const PRESALE_STATES: PresaleAdminStatus[] = ['Pending', 'Active', 'Ended', 'Finalized', 'Cancelled'];
const PRESALE_ADMIN_ROLE = keccak256(toUtf8Bytes('PRESALE_ADMIN_ROLE'));
const PAUSER_ROLE = keccak256(toUtf8Bytes('PAUSER_ROLE'));
const presaleInterface = new Interface(PresaleArtifact.abi);

function statusFromIndex(index: bigint): PresaleAdminStatus {
  return PRESALE_STATES[Number(index)] ?? 'Pending';
}

async function getSignerOnDeploymentChain() {
  const signer = await getSigner();
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Please switch MetaMask to Hardhat Local (${DEPLOYMENT_CHAIN_ID}).`);
  }
  return signer;
}

async function getPresaleContract(withSigner = false) {
  return new Contract(
    CONTRACTS.presale,
    PresaleArtifact.abi,
    withSigner ? await getSignerOnDeploymentChain() : canonicalProvider,
  );
}

function requireState(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function requirePresaleAdmin(roles: PresaleAdminRoles) {
  if (!roles.presaleAdmin) {
    throw new Error('Connected wallet is not authorized to administer the Presale.');
  }
}

function requirePauser(roles: PresaleAdminRoles) {
  if (!roles.pauser) {
    throw new Error('Connected wallet does not have the Presale PAUSER_ROLE.');
  }
}

async function prepareAdminAction(requiredRole: 'presaleAdmin' | 'pauser' | null) {
  const signer = await getSignerOnDeploymentChain();
  const caller = await signer.getAddress();
  const state = await getAdminPresaleData(caller);
  if (requiredRole === 'presaleAdmin') requirePresaleAdmin(state.roles);
  if (requiredRole === 'pauser') requirePauser(state.roles);
  return { contract: new Contract(CONTRACTS.presale, PresaleArtifact.abi, signer), caller, state };
}

async function confirmTransaction(
  transaction: { hash: string; wait: () => Promise<{
    status: number | null;
    blockNumber: number;
    logs: ReadonlyArray<{ data: string; topics: ReadonlyArray<string> }>;
  } | null> },
  caller: string,
  onSubmitted?: SubmittedCallback,
): Promise<PresaleAdminTransactionResult> {
  onSubmitted?.(transaction.hash);
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('Presale transaction was not confirmed on-chain.');
  }

  const eventNames = (receipt.logs ?? []).flatMap((log) => {
    try {
      const parsed = presaleInterface.parseLog({ data: log.data, topics: [...log.topics] });
      return parsed ? [parsed.name] : [];
    } catch {
      return [];
    }
  });

  return {
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber,
    eventNames,
    state: await getAdminPresaleData(caller),
  };
}

/** Reads the canonical deployed Presale. It never consults backend or mock ICO data. */
export async function getAdminPresaleData(adminAddress?: string): Promise<AdminPresaleData> {
  const deployedCode = await canonicalProvider.getCode(CONTRACTS.presale);
  if (deployedCode === '0x') {
    throw new Error(`No Presale bytecode exists at ${CONTRACTS.presale} on Hardhat Local (31337). The active local chain has been reset or does not match deployments.json.`);
  }
  const contract = await getPresaleContract(false);
  const token = new Contract(CONTRACTS.token, ABCDTokenArtifact.abi, canonicalProvider);
  const defaultAdminRole = await contract.DEFAULT_ADMIN_ROLE();
  const [
    stateIndex,
    rate,
    softCap,
    hardCap,
    minBuy,
    maxBuy,
    startTime,
    endTime,
    totalEthRaised,
    totalTokensSold,
    isPaused,
    isFinalized,
    isCancelled,
    tokenAddress,
    treasuryAddress,
    tokenReserve,
    defaultAdmin,
    presaleAdmin,
    pauser,
  ] = await Promise.all([
    contract.getState(),
    contract.rate(),
    contract.softCap(),
    contract.hardCap(),
    contract.minBuy(),
    contract.maxBuy(),
    contract.startTime(),
    contract.endTime(),
    contract.totalEthRaised(),
    contract.totalTokensSold(),
    contract.paused(),
    contract.isFinalized(),
    contract.isCancelled(),
    contract.token(),
    contract.treasury(),
    token.balanceOf(CONTRACTS.presale),
    adminAddress ? contract.hasRole(defaultAdminRole, adminAddress) : false,
    adminAddress ? contract.hasRole(PRESALE_ADMIN_ROLE, adminAddress) : false,
    adminAddress ? contract.hasRole(PAUSER_ROLE, adminAddress) : false,
  ]);

  return {
    contractAddress: CONTRACTS.presale,
    tokenAddress,
    treasuryAddress,
    status: statusFromIndex(stateIndex),
    rate: formatUnits(rate, 18),
    rateRaw: rate,
    softCap: formatEther(softCap),
    softCapRaw: softCap,
    hardCap: formatEther(hardCap),
    hardCapRaw: hardCap,
    minBuy: formatEther(minBuy),
    minBuyRaw: minBuy,
    maxBuy: formatEther(maxBuy),
    maxBuyRaw: maxBuy,
    totalEthRaised: formatEther(totalEthRaised),
    totalEthRaisedRaw: totalEthRaised,
    totalTokensSold: formatEther(totalTokensSold),
    totalTokensSoldRaw: totalTokensSold,
    tokenReserve: formatEther(tokenReserve),
    tokenReserveRaw: tokenReserve,
    startTime,
    endTime,
    isPaused: Boolean(isPaused),
    isFinalized: Boolean(isFinalized),
    isCancelled: Boolean(isCancelled),
    adminAddress: adminAddress ?? null,
    roles: { defaultAdmin: Boolean(defaultAdmin), presaleAdmin: Boolean(presaleAdmin), pauser: Boolean(pauser) },
  };
}

/** Starts from the current chain timestamp; no sale is started until this function is explicitly called. */
export async function startPresale(durationSeconds: number, onSubmitted?: SubmittedCallback) {
  requireState(Number.isSafeInteger(durationSeconds) && durationSeconds > 0, 'Sale duration must be a positive number of seconds.');
  const { contract, caller, state } = await prepareAdminAction('presaleAdmin');
  requireState(state.status === 'Pending', 'Presale is already active, ended, finalized, or cancelled.');
  const latestBlock = await canonicalProvider.getBlock('latest');
  if (!latestBlock) throw new Error('Unable to determine the current Hardhat block time.');
  return confirmTransaction(await contract.startPresale(latestBlock.timestamp, latestBlock.timestamp + durationSeconds), caller, onSubmitted);
}

export async function pausePresale(onSubmitted?: SubmittedCallback) {
  const { contract, caller, state } = await prepareAdminAction('pauser');
  requireState(state.status === 'Active', 'Presale can be paused only while it is active.');
  requireState(!state.isPaused, 'Presale is already paused.');
  return confirmTransaction(await contract.pause(), caller, onSubmitted);
}

export async function unpausePresale(onSubmitted?: SubmittedCallback) {
  const { contract, caller, state } = await prepareAdminAction('pauser');
  requireState(state.isPaused, 'Presale is not paused.');
  return confirmTransaction(await contract.unpause(), caller, onSubmitted);
}

export async function cancelPresale(onSubmitted?: SubmittedCallback) {
  const { contract, caller, state } = await prepareAdminAction('presaleAdmin');
  requireState(!state.isFinalized, 'Presale has already been finalized.');
  requireState(!state.isCancelled, 'Presale has already been cancelled.');
  return confirmTransaction(await contract.cancelPresale(), caller, onSubmitted);
}

/** The deployed contract deliberately permits anyone to terminally cancel an ended failed sale. */
export async function cancelFailedSale(onSubmitted?: SubmittedCallback) {
  const { contract, caller, state } = await prepareAdminAction(null);
  requireState(state.status === 'Ended', 'A failed Presale can be cancelled only after it has ended.');
  requireState(state.totalEthRaisedRaw < state.softCapRaw, 'The Presale soft cap has been met; it cannot be cancelled as a failed sale.');
  return confirmTransaction(await contract.cancelFailedSale(), caller, onSubmitted);
}

export async function finalizePresale(onSubmitted?: SubmittedCallback) {
  const { contract, caller, state } = await prepareAdminAction('presaleAdmin');
  requireState(state.status === 'Ended', 'Presale can be finalized only after it has ended.');
  requireState(!state.isCancelled, 'Cancelled Presales cannot be finalized.');
  requireState(state.totalEthRaisedRaw >= state.softCapRaw, 'Presale cannot be finalized because the soft cap has not been met.');
  return confirmTransaction(await contract.finalizePresale(), caller, onSubmitted);
}

export async function withdrawPresaleProceeds(onSubmitted?: SubmittedCallback) {
  const { contract, caller, state } = await prepareAdminAction('presaleAdmin');
  requireState(state.isFinalized && state.status === 'Finalized', 'Proceeds can be withdrawn only after Presale finalization.');
  requireState(!state.isCancelled, 'Cancelled Presales cannot withdraw proceeds.');
  return confirmTransaction(await contract.withdrawProceeds(), caller, onSubmitted);
}

export function presaleAdminErrorMessage(error: unknown): string {
  const details = error as { code?: string | number; shortMessage?: string; message?: string; info?: { error?: { message?: string } } };
  if (details.code === 'ACTION_REJECTED' || details.code === 4001 || details.code === '4001') {
    return 'Transaction rejected in MetaMask.';
  }
  const message = details.info?.error?.message || details.shortMessage || details.message || 'Presale contract call failed.';
  return message.replace(/^execution reverted:\s*/i, '');
}
