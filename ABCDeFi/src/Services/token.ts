import { Contract, formatEther, isAddress, keccak256, parseEther, toUtf8Bytes } from "ethers";
import { CONTRACTS, DEPLOYMENT_CHAIN_ID } from "../Config/contracts";
import ABCDTokenArtifact from "../../artifacts/contracts/token/ABCDToken.sol/ABCDToken.json";
import { provider as canonicalProvider } from "./contractProvider";
import { getSigner, getWalletAddress } from "./wallet";

const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));
const ABCDTokenABI = ABCDTokenArtifact.abi;

export interface ABCDTokenState {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  maxSupply: string;
  isPaused: boolean;
}

function parsePositiveAmount(amount: string): bigint {
  const parsed = parseEther(amount);
  if (parsed <= 0n) throw new Error("ABCD amount must be greater than zero.");
  return parsed;
}

function parseNonNegativeAmount(amount: string): bigint {
  const parsed = parseEther(amount);
  if (parsed < 0n) throw new Error("ABCD amount cannot be negative.");
  return parsed;
}

function requireAddress(address: string, label: string) {
  if (!isAddress(address)) throw new Error(`${label} must be a valid wallet address.`);
}

export async function getTokenContract(withSigner: boolean = false) {
  if (!withSigner) return new Contract(CONTRACTS.token, ABCDTokenABI, canonicalProvider);

  const signer = await getSigner();
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch MetaMask to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before using ABCD.`);
  }
  const providerOrSigner = signer;
  return new Contract(CONTRACTS.token, ABCDTokenABI, providerOrSigner);
}

// Read Functions
export async function getBalanceOf(address?: string): Promise<string> {
  const targetAddress = address || (await getWalletAddress());
  const contract = await getTokenContract(false);
  const balance = await contract.balanceOf(targetAddress);

  return formatEther(balance);
}

export async function getTotalSupply(): Promise<string> {
  const contract = await getTokenContract(false);
  const supply = await contract.totalSupply();

  return formatEther(supply);
}

/** Reads token status directly from the canonical localhost deployment. */
export async function getABCDTokenState(): Promise<ABCDTokenState> {
  const contract = await getTokenContract(false);
  const [name, symbol, decimals, totalSupply, maxSupply, isPaused] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
    contract.totalSupply(),
    contract.maxSupply(),
    contract.isPaused(),
  ]);
  return {
    name,
    symbol,
    decimals: Number(decimals),
    totalSupply: formatEther(totalSupply),
    maxSupply: formatEther(maxSupply),
    isPaused,
  };
}

export async function getAllowance(ownerAddress: string, spenderAddress: string): Promise<string> {
  requireAddress(ownerAddress, "Owner");
  requireAddress(spenderAddress, "Spender");
  const contract = await getTokenContract(false);
  return formatEther(await contract.allowance(ownerAddress, spenderAddress));
}

// Write Functions
export async function transferTokens(
  toAddress: string,
  amountEthString: string,
  onSubmitted?: (transactionHash: string) => void,
) {
  requireAddress(toAddress, "Recipient");
  const contract = await getTokenContract(true);
  const amount = parsePositiveAmount(amountEthString);
  const tx = await contract.transfer(toAddress, amount);
  onSubmitted?.(tx.hash);

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('ABCD transfer was not confirmed on-chain.');
  }

  return receipt;
}

export async function approveSpender(
  spenderAddress: string,
  amountEthString: string,
  onSubmitted?: (transactionHash: string) => void,
) {
  requireAddress(spenderAddress, "Spender");
  const contract = await getTokenContract(true);
  const amount = parseNonNegativeAmount(amountEthString);
  const tx = await contract.approve(spenderAddress, amount);
  onSubmitted?.(tx.hash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("ABCD approval was not confirmed on-chain.");
  }
  return receipt;
}

export async function burnTokens(
  amountEthString: string,
  onSubmitted?: (transactionHash: string) => void,
) {
  const contract = await getTokenContract(true);
  const tx = await contract.burn(parsePositiveAmount(amountEthString));
  onSubmitted?.(tx.hash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("ABCD burn was not confirmed on-chain.");
  }
  return receipt;
}

/**
 * Sends a real contract mint transaction only for the connected MINTER_ROLE
 * account and only when a prior burn has made room below the fixed max supply.
 */
export async function mintTokens(
  toAddress: string,
  amountEthString: string,
  onSubmitted?: (transactionHash: string) => void,
) {
  requireAddress(toAddress, "Recipient");
  const amount = parsePositiveAmount(amountEthString);
  const caller = await getWalletAddress();
  const contract = await getTokenContract(true);
  const [isMinter, totalSupply, maxSupply] = await Promise.all([
    contract.hasRole(MINTER_ROLE, caller),
    contract.totalSupply(),
    contract.maxSupply(),
  ]);

  if (!isMinter) throw new Error("The connected wallet does not have the ABCD MINTER_ROLE.");
  if (totalSupply + amount > maxSupply) {
    throw new Error("ABCD has reached its fixed max supply. Burn tokens before minting.");
  }

  const tx = await contract.mint(toAddress, amount);
  onSubmitted?.(tx.hash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("ABCD mint was not confirmed on-chain.");
  }
  return receipt;
}

export function tokenErrorMessage(error: unknown): string {
  const details = error as {
    code?: string | number;
    shortMessage?: string;
    message?: string;
    info?: { error?: { code?: string | number; message?: string } };
  };
  const code = details?.code ?? details?.info?.error?.code;
  const message = details?.shortMessage || details?.message || details?.info?.error?.message || "ABCD token contract call failed.";
  if (code === "ACTION_REJECTED" || code === 4001 || /user rejected|user denied/i.test(message)) {
    return "Transaction rejected in MetaMask. No ABCD state was changed.";
  }
  if (/insufficient funds|ERC20InsufficientBalance|insufficient balance/i.test(message)) {
    return "Insufficient ABCD balance or ETH for gas.";
  }
  if (/enforcedpause|paused/i.test(message)) {
    return "ABCD is currently paused. Transfers and burns are unavailable until an authorized pauser unpauses it.";
  }
  return message;
}
