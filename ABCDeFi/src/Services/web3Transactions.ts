/**
 * web3Transactions.ts — Central Web3 Transaction Service
 * Provides a unified interface for executing MetaMask transactions
 * and generating BscScan explorer links for ABCDeFi on BNB Smart Chain.
 */

import { getSigner } from './wallet';
import { Contract, parseEther, TransactionReceipt } from 'ethers';
import { CONTRACTS, requireContractAddress } from '../Config/contracts';

// ─── Network Config ───────────────────────────────────────────────────────────
export const NETWORK = {
  testnet: {
    chainId: 97,
    chainIdHex: '0x61',
    name: 'BNB Smart Chain Testnet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    explorer: 'https://testnet.bscscan.com',
  },
  mainnet: {
    chainId: 56,
    chainIdHex: '0x38',
    name: 'BNB Smart Chain Mainnet',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    explorer: 'https://bscscan.com',
  },
};

function activeExplorer(): string {
  const chainId = Number((import.meta as any).env?.VITE_CHAIN_ID || 31337);
  return chainId === 56 ? NETWORK.mainnet.explorer : chainId === 97 ? NETWORK.testnet.explorer : '';
}

// ─── BscScan Link Helpers ─────────────────────────────────────────────────────
export function getBscScanTxLink(txHash: string): string {
  const explorer = activeExplorer();
  return explorer ? `${explorer}/tx/${txHash}` : txHash;
}

export function getBscScanAddressLink(address: string): string {
  const explorer = activeExplorer();
  return explorer ? `${explorer}/address/${address}` : address;
}

export function getBscScanTokenLink(tokenAddress: string): string {
  const explorer = activeExplorer();
  return explorer ? `${explorer}/token/${tokenAddress}` : tokenAddress;
}

// ─── Transaction Result Type ──────────────────────────────────────────────────
export interface TxResult {
  txHash: string;
  bscScanUrl: string;
  receipt: TransactionReceipt | null;
  success: boolean;
  error?: string;
}

// ─── Core Transaction Executor ────────────────────────────────────────────────
/**
 * Execute a smart contract method and return a standardized TxResult.
 * Falls back to native BNB send if contract call fails (useful during development).
 */
export async function executeContractTx(
  contractAddress: string,
  abi: string[],
  methodName: string,
  args: any[] = [],
  valueEth: string = '0'
): Promise<TxResult> {
  try {
    const signer = await getSigner();
    const contract = new Contract(contractAddress, abi, signer);
    
    const txOptions: any = {};
    if (parseFloat(valueEth) > 0) {
      txOptions.value = parseEther(valueEth);
    }
    
    const tx = await contract[methodName](...args, txOptions);
    const receipt = await tx.wait();
    const txHash = receipt?.hash || tx.hash;
    
    return {
      txHash,
      bscScanUrl: getBscScanTxLink(txHash),
      receipt,
      success: true,
    };
  } catch (err: any) {
    console.error(`Contract call ${methodName} failed:`, err);
    return {
      txHash: '',
      bscScanUrl: '',
      receipt: null,
      success: false,
      error: err?.message || 'Transaction failed',
    };
  }
}

/**
 * Execute a native BNB transfer transaction.
 */
export async function executeNativeTx(toAddress: string, amountEth: string): Promise<TxResult> {
  try {
    const signer = await getSigner();
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: parseEther(amountEth),
    });
    const receipt = await tx.wait();
    const txHash = receipt?.hash || tx.hash;
    
    return {
      txHash,
      bscScanUrl: getBscScanTxLink(txHash),
      receipt,
      success: true,
    };
  } catch (err: any) {
    console.error('Native BNB transfer failed:', err);
    return {
      txHash: '',
      bscScanUrl: '',
      receipt: null,
      success: false,
      error: err?.message || 'Transaction failed',
    };
  }
}

// ─── ABCDeFi-specific Action Wrappers ─────────────────────────────────────────

/**
 * Buy ABCD tokens in the ICO/Presale contract.
 */
export async function txBuyICOTokens(bnbAmountEth: string): Promise<TxResult> {
  return executeContractTx(
    CONTRACTS.presale,
    ['function buyTokens() external payable'],
    'buyTokens',
    [],
    bnbAmountEth
  );
}

/**
 * Deposit collateral to CollateralVault.sol.
 */
export async function txDepositCollateral(ethAmount: string): Promise<TxResult> {
  const signer = await getSigner();
  return executeContractTx(
    requireContractAddress('collateralVault'),
    ['function depositETH(address borrower) payable'],
    'depositETH',
    [await signer.getAddress()],
    ethAmount
  );
}

/**
 * Fund a loan from the LoanMarketplace.sol.
 */
export async function txFundLoan(requestId: number): Promise<TxResult> {
  return executeContractTx(
    requireContractAddress('loanMarketplace'),
    ['function fundLoanRequest(uint256 requestId)'],
    'fundLoanRequest',
    [requestId]
  );
}

/**
 * Pay an EMI installment on the Lending contract.
 */
export async function txPayEMI(loanId: number): Promise<TxResult> {
  return executeContractTx(
    requireContractAddress('emiManager'),
    ['function payEMI(uint256 loanId)'],
    'payEMI',
    [loanId]
  );
}

/**
 * Mint a Franchise/Legion NFT for a territory.
 */
export async function txMintFranchiseNFT(territoryCode: string, tierName: string, priceEth: string): Promise<TxResult> {
  return executeContractTx(
    CONTRACTS.participantNFT,
    ['function mintFranchiseNFT(string memory code, string memory tier) external payable'],
    'mintFranchiseNFT',
    [territoryCode, tierName],
    priceEth
  );
}

/**
 * Claim referral rewards.
 */
export async function txClaimReferralReward(): Promise<TxResult> {
  return executeContractTx(
    CONTRACTS.referral,
    ['function claimReferralReward() external'],
    'claimReferralReward',
    [],
    '0'
  );
}

/**
 * Release vesting tokens.
 */
export async function txReleaseVesting(scheduleId: string): Promise<TxResult> {
  return executeContractTx(
    CONTRACTS.vesting,
    ['function release(bytes32 scheduleId) external'],
    'release',
    [scheduleId],
    '0'
  );
}

/**
 * Transfer an NFT to another wallet.
 */
export async function txTransferNFT(nftContract: string, fromAddress: string, toAddress: string, tokenId: number): Promise<TxResult> {
  return executeContractTx(
    nftContract,
    ['function transferFrom(address from, address to, uint256 tokenId) external'],
    'transferFrom',
    [fromAddress, toAddress, tokenId],
    '0'
  );
}
