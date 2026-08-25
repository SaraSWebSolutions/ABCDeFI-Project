import { Contract, formatEther, formatUnits, isAddress, parseEther } from 'ethers';
import PresaleArtifact from '../../artifacts/contracts/ico/Presale.sol/Presale.json';
import ABCDTokenABI from '../abi/ABCDToken.json';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getSigner } from './wallet';

export type PresaleStatus = 'Pending' | 'Active' | 'Ended' | 'Finalized' | 'Cancelled';

export interface PresaleData {
  status: PresaleStatus;
  rate: string;
  rateRaw: bigint;
  rateAbcdPerEth: string;
  softCap: string;
  hardCap: string;
  minBuy: string;
  maxBuy: string;
  totalEthRaised: string;
  totalTokensSold: string;
  tokensSold: string;
  remainingEthCapacity: string;
  tokenReserve: string;
  startTime: bigint;
  endTime: bigint;
  isPaused: boolean;
  isFinalized: boolean;
  isCancelled: boolean;
  whitelistRequired: boolean;
  buyer: {
    ethContributed: string;
    tokensPurchased: string;
    claimed: boolean;
    isWhitelisted: boolean;
  } | null;
}

const PRESALE_STATES: PresaleStatus[] = ['Pending', 'Active', 'Ended', 'Finalized', 'Cancelled'];

function parsePositiveEth(amount: string): bigint {
  const value = parseEther(amount);
  if (value <= 0n) throw new Error('Presale contribution must be greater than zero.');
  return value;
}

async function getSignerOnDeploymentChain() {
  const signer = await getSigner();
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch MetaMask to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before using Presale.`);
  }
  return signer;
}

async function waitForSuccess(transaction: { wait: () => Promise<any> }) {
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error('Presale transaction was not confirmed on-chain.');
  return receipt;
}

export async function getPresaleContract(withSigner = false) {
  const providerOrSigner = withSigner ? await getSignerOnDeploymentChain() : canonicalProvider;
  return new Contract(CONTRACTS.presale, PresaleArtifact.abi, providerOrSigner);
}

/** Reads the canonical local deployment without requiring a connected wallet. */
export async function getPresaleData(buyerAddress?: string): Promise<PresaleData> {
  if (buyerAddress && !isAddress(buyerAddress)) throw new Error('Buyer must be a valid wallet address.');
  const contract = await getPresaleContract(false);
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, canonicalProvider);
  const [stateIndex, rate, softCap, hardCap, minBuy, maxBuy, totalEthRaised, totalTokensSold, startTime, endTime, whitelistRequired, tokenReserve, isPaused, isFinalized, isCancelled] = await Promise.all([
    contract.getState(), contract.rate(), contract.softCap(), contract.hardCap(), contract.minBuy(), contract.maxBuy(),
    contract.totalEthRaised(), contract.totalTokensSold(), contract.startTime(), contract.endTime(), contract.whitelistRequired(),
    token.balanceOf(CONTRACTS.presale), contract.paused(), contract.isFinalized(), contract.isCancelled(),
  ]);
  const buyerInfo = buyerAddress ? await Promise.all([contract.getBuyerInfo(buyerAddress), contract.isWhitelisted(buyerAddress)]) : null;
  const formattedTokensSold = formatEther(totalTokensSold);

  return {
    status: PRESALE_STATES[Number(stateIndex)] ?? 'Pending',
    rate: formatUnits(rate, 18),
    rateRaw: rate,
    rateAbcdPerEth: formatUnits(rate, 18),
    softCap: formatEther(softCap),
    hardCap: formatEther(hardCap),
    minBuy: formatEther(minBuy),
    maxBuy: formatEther(maxBuy),
    totalEthRaised: formatEther(totalEthRaised),
    totalTokensSold: formattedTokensSold,
    tokensSold: formattedTokensSold,
    remainingEthCapacity: formatEther(hardCap > totalEthRaised ? hardCap - totalEthRaised : 0n),
    tokenReserve: formatEther(tokenReserve),
    startTime,
    endTime,
    isPaused,
    isFinalized,
    isCancelled,
    whitelistRequired,
    buyer: buyerInfo ? {
      ethContributed: formatEther(buyerInfo[0].ethContributed),
      tokensPurchased: formatEther(buyerInfo[0].tokensPurchased),
      claimed: buyerInfo[0].claimed,
      isWhitelisted: buyerInfo[1],
    } : null,
  };
}

export async function buyTokens(ethAmount: string, onSubmitted?: (transactionHash: string) => void) {
  const value = parsePositiveEth(ethAmount);
  const signer = await getSignerOnDeploymentChain();
  const buyer = await signer.getAddress();
  const contract = new Contract(CONTRACTS.presale, PresaleArtifact.abi, signer);
  const [state, isPaused, minBuy, maxBuy, hardCap, totalEthRaised, whitelistRequired, buyerInfo, isWhitelisted, walletBalance] = await Promise.all([
    contract.getState(), contract.paused(), contract.minBuy(), contract.maxBuy(), contract.hardCap(), contract.totalEthRaised(),
    contract.whitelistRequired(), contract.getBuyerInfo(buyer), contract.isWhitelisted(buyer), signer.provider!.getBalance(buyer),
  ]);

  if (isPaused) throw new Error('Presale is paused. Contributions are unavailable.');
  if (Number(state) !== 1) throw new Error(`Presale is ${PRESALE_STATES[Number(state)] ?? 'unavailable'} and cannot accept contributions.`);
  if (whitelistRequired && !isWhitelisted) throw new Error('This Presale requires a whitelisted wallet address.');
  if (value < minBuy || value > maxBuy) throw new Error(`Contribution must be between ${formatEther(minBuy)} and ${formatEther(maxBuy)} ETH.`);
  if (buyerInfo.ethContributed + value > maxBuy) throw new Error(`This wallet would exceed the ${formatEther(maxBuy)} ETH per-wallet limit.`);
  if (totalEthRaised + value > hardCap) throw new Error(`Only ${formatEther(hardCap - totalEthRaised)} ETH of hard-cap capacity remains.`);
  if (walletBalance <= value) throw new Error('Insufficient ETH for this contribution plus network gas.');

  const tx = await contract.buyWithETH({ value });
  onSubmitted?.(tx.hash);
  return waitForSuccess(tx);
}

export async function claimPresaleTokens(onSubmitted?: (transactionHash: string) => void) {
  const signer = await getSignerOnDeploymentChain();
  const buyer = await signer.getAddress();
  const contract = new Contract(CONTRACTS.presale, PresaleArtifact.abi, signer);
  const [isFinalized, buyerInfo] = await Promise.all([contract.isFinalized(), contract.getBuyerInfo(buyer)]);
  if (!isFinalized) throw new Error('Purchased ABCD can be claimed only after the Presale is finalized.');
  if (buyerInfo.tokensPurchased === 0n || buyerInfo.claimed) throw new Error('There are no claimable Presale tokens for this wallet.');

  const tx = await contract.claimTokens();
  onSubmitted?.(tx.hash);
  return waitForSuccess(tx);
}

export function presaleErrorMessage(error: unknown): string {
  const details = error as { code?: string; shortMessage?: string; message?: string };
  if (details?.code === 'ACTION_REJECTED') return 'Transaction rejected in MetaMask.';
  const message = details?.shortMessage || details?.message || 'Presale contract call failed.';
  if (/insufficient funds|InsufficientBalance/i.test(message)) return 'Insufficient ETH for this contribution plus network gas.';
  return message;
}
