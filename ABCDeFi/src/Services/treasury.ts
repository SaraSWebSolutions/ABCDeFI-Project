import { Contract, formatEther, isAddress, keccak256, parseEther, toUtf8Bytes } from "ethers";
import { CONTRACTS, DEPLOYMENT_CHAIN_ID } from "../Config/contracts";
import TreasuryArtifact from "../../artifacts/contracts/treasury/Treasury.sol/Treasury.json";
import ABCDTokenArtifact from "../../artifacts/contracts/token/ABCDToken.sol/ABCDToken.json";
import { provider as canonicalProvider } from "./contractProvider";
import { getSigner, getWalletAddress } from "./wallet";

const TREASURY_ADMIN_ROLE = keccak256(toUtf8Bytes("TREASURY_ADMIN_ROLE"));
const WITHDRAWER_ROLE = keccak256(toUtf8Bytes("WITHDRAWER_ROLE"));
const PAUSER_ROLE = keccak256(toUtf8Bytes("PAUSER_ROLE"));
const TreasuryABI = TreasuryArtifact.abi;
const ABCDTokenABI = ABCDTokenArtifact.abi;

export interface TreasuryState {
  ethBalance: string;
  abcdBalance: string;
  reserveVaultBalance: string;
  interestPoolBalance: string;
  burnPoolBalance: string;
  distributionReportCount: number;
  latestDistributionAmount: string | null;
  isPaused: boolean;
  canWithdraw: boolean;
  canAdminister: boolean;
  canPause: boolean;
}

function requireAddress(address: string, label: string) {
  if (!isAddress(address)) throw new Error(`${label} must be a valid address.`);
}

function parsePositiveAmount(amount: string, asset: string): bigint {
  const parsed = parseEther(amount);
  if (parsed <= 0n) throw new Error(`${asset} amount must be greater than zero.`);
  return parsed;
}

async function getSignerOnDeploymentChain() {
  const signer = await getSigner();
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch MetaMask to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before using Treasury.`);
  }
  return signer;
}

async function waitForSuccess(transaction: { wait: () => Promise<{ status: number | null; hash: string } | null> }) {
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Treasury transaction was not confirmed on-chain.");
  return receipt;
}

async function requireRole(role: string, roleName: string) {
  const caller = await getWalletAddress();
  const contract = await getTreasuryContract(false);
  if (!(await contract.hasRole(role, caller))) {
    throw new Error(`The connected wallet does not have the Treasury ${roleName}.`);
  }
}

export async function getTreasuryContract(withSigner = false) {
  const providerOrSigner = withSigner ? await getSignerOnDeploymentChain() : canonicalProvider;
  return new Contract(CONTRACTS.treasury, TreasuryABI, providerOrSigner);
}

/** Reads only the canonical localhost deployment; no wallet connection is required. */
export async function getTreasuryState(account?: string): Promise<TreasuryState> {
  if (account) requireAddress(account, "Wallet");
  const contract = await getTreasuryContract(false);
  const [balances, abcdBalance, isPaused, reports, canWithdraw, canAdminister, canPause] = await Promise.all([
    contract.viewBalances(),
    contract.getERC20Balance(CONTRACTS.token),
    contract.paused(),
    contract.getReports(),
    account ? contract.hasRole(WITHDRAWER_ROLE, account) : false,
    account ? contract.hasRole(TREASURY_ADMIN_ROLE, account) : false,
    account ? contract.hasRole(PAUSER_ROLE, account) : false,
  ]);

  const latestReport = reports.length ? reports[reports.length - 1] : null;
  return {
    ethBalance: formatEther(balances.treasuryBalance),
    reserveVaultBalance: formatEther(balances.reserveVaultBalance),
    interestPoolBalance: formatEther(balances.interestPool),
    burnPoolBalance: formatEther(balances.burnPool),
    distributionReportCount: reports.length,
    latestDistributionAmount: latestReport ? formatEther(latestReport.totalAmount) : null,
    abcdBalance: formatEther(abcdBalance),
    isPaused,
    canWithdraw,
    canAdminister,
    canPause,
  };
}

/** Backwards-compatible real read for the existing dashboard refresh path. */
export async function getTreasuryBalances() {
  const state = await getTreasuryState();
  return { ethBalance: state.ethBalance };
}

export async function depositTreasuryETH(amountEthString: string) {
  const contract = await getTreasuryContract(true);
  return waitForSuccess(await contract.depositETH({ value: parsePositiveAmount(amountEthString, "ETH") }));
}

export async function depositTreasuryERC20(tokenAddress: string, amountTokenString: string) {
  requireAddress(tokenAddress, "Token");
  const amount = parsePositiveAmount(amountTokenString, "Token");
  const signer = await getSignerOnDeploymentChain();
  const owner = await signer.getAddress();
  const token = new Contract(tokenAddress, ABCDTokenABI, signer);
  const [balance, allowance] = await Promise.all([
    token.balanceOf(owner), token.allowance(owner, CONTRACTS.treasury),
  ]);
  if ((balance as bigint) < amount) {
    throw new Error(`Insufficient token balance. Required ${formatEther(amount)} tokens.`);
  }
  if ((allowance as bigint) < amount) {
    await waitForSuccess(await token.approve(CONTRACTS.treasury, amount));
  }
  const contract = new Contract(CONTRACTS.treasury, TreasuryABI, signer);
  return waitForSuccess(await contract.depositERC20(tokenAddress, amount));
}

export async function depositTreasuryInterestPool(amountEthString: string) {
  const contract = await getTreasuryContract(true);
  return waitForSuccess(await contract.depositInterestPool({ value: parsePositiveAmount(amountEthString, "ETH") }));
}

export async function depositTreasuryBurnPool(amountEthString: string) {
  const contract = await getTreasuryContract(true);
  return waitForSuccess(await contract.depositBurnPool({ value: parsePositiveAmount(amountEthString, "ETH") }));
}

export async function withdrawTreasuryETH(recipientAddress: string, amountEthString: string) {
  requireAddress(recipientAddress, "Recipient");
  await requireRole(WITHDRAWER_ROLE, "WITHDRAWER_ROLE");
  const contract = await getTreasuryContract(true);
  return waitForSuccess(await contract.withdrawETH(recipientAddress, parsePositiveAmount(amountEthString, "ETH")));
}

export async function withdrawTreasuryERC20(tokenAddress: string, recipientAddress: string, amountTokenString: string) {
  requireAddress(tokenAddress, "Token");
  requireAddress(recipientAddress, "Recipient");
  await requireRole(WITHDRAWER_ROLE, "WITHDRAWER_ROLE");
  const contract = await getTreasuryContract(true);
  return waitForSuccess(await contract.withdrawERC20(tokenAddress, recipientAddress, parsePositiveAmount(amountTokenString, "Token")));
}

export async function distributeTreasuryFunds() {
  await requireRole(TREASURY_ADMIN_ROLE, "TREASURY_ADMIN_ROLE");
  const contract = await getTreasuryContract(true);
  return waitForSuccess(await contract.distributeFunds());
}

export async function transferTreasuryFunds(recipientAddress: string, amountEthString: string, reason: string) {
  requireAddress(recipientAddress, "Recipient");
  if (!reason.trim()) throw new Error("A transfer reason is required.");
  await requireRole(TREASURY_ADMIN_ROLE, "TREASURY_ADMIN_ROLE");
  const contract = await getTreasuryContract(true);
  return waitForSuccess(await contract.transferFunds(recipientAddress, parsePositiveAmount(amountEthString, "ETH"), reason.trim()));
}

export function treasuryErrorMessage(error: unknown): string {
  const details = error as { code?: string | number; shortMessage?: string; message?: string; info?: { error?: { code?: string | number; message?: string } } };
  const code = details?.code ?? details?.info?.error?.code;
  const message = details?.shortMessage || details?.message || details?.info?.error?.message || "Treasury contract call failed.";
  if (code === "ACTION_REJECTED" || code === 4001 || /user rejected|user denied/i.test(message)) {
    return "Transaction rejected in MetaMask. No on-chain state was changed.";
  }
  if (/insufficient funds|InsufficientBalance|ERC20InsufficientBalance/i.test(message)) {
    return "Insufficient balance for this Treasury operation.";
  }
  if (/enforcedpause|paused/i.test(message)) {
    return "Treasury is paused. The requested operation is unavailable until an authorized pauser unpauses it.";
  }
  return message;
}
