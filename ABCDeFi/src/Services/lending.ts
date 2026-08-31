import { Contract, formatEther, Interface, parseEther, Signer } from "ethers";
import { CONTRACTS, DEPLOYMENT_CHAIN_ID } from "../Config/contracts";
import { assertCanonicalContractDeployment, provider as canonicalProvider } from "./contractProvider";
import LendingPoolArtifact from "../../artifacts/contracts/lending/LendingPool.sol/LendingPool.json";
import ABCDTokenArtifact from "../../artifacts/contracts/token/ABCDToken.sol/ABCDToken.json";
import CollateralVaultArtifact from "../../artifacts/contracts/vault/CollateralVault.sol/CollateralVault.json";
import LoanManagerArtifact from "../../artifacts/contracts/lending/LoanManager.sol/LoanManager.json";
import EMIManagerArtifact from "../../artifacts/contracts/lending/EMIManager.sol/EMIManager.json";
import LiquidationArtifact from "../../artifacts/contracts/lending/Liquidation.sol/Liquidation.json";
import LoanNFTArtifact from "../../artifacts/contracts/nft/LoanNFT.sol/LoanNFT.json";
import LoanMarketplaceArtifact from "../../artifacts/contracts/lending/LoanMarketplace.sol/LoanMarketplace.json";
import ReputationNFTABI from "../abi/ReputationNFT.json";
import { getProvider, getSigner, getWalletAddress } from "./wallet";

const LendingPoolABI = LendingPoolArtifact.abi;
const ABCDTokenABI = ABCDTokenArtifact.abi;
const CollateralVaultABI = CollateralVaultArtifact.abi;
const LoanManagerABI = LoanManagerArtifact.abi;
const EMIManagerABI = EMIManagerArtifact.abi;
const LiquidationABI = LiquidationArtifact.abi;
const LoanNFTABI = LoanNFTArtifact.abi;
const LoanMarketplaceABI = LoanMarketplaceArtifact.abi;
const lendingErrorInterfaces = [
  new Interface(LendingPoolABI), new Interface(LoanMarketplaceABI), new Interface(EMIManagerABI),
  new Interface(LiquidationABI), new Interface(ABCDTokenABI),
];

/** Called only after MetaMask has submitted a transaction, never before it is mined. */
export type TransactionSubmitted = (hash: string, label?: string) => void;

export interface LendingPoolState {
  collateral: string;
  borrowed: string;
  maxBorrowable: string;
  availableToBorrow: string;
  liquidity: string;
  tokenBalance: string;
  repaymentAllowance: string;
  ltvBps: number;
  tokenRatePerETH: string;
  active: boolean;
  paused: boolean;
  /** LendingPool has no interest accrual or rate function. */
  interest: null;
  healthFactor: string;
}

export interface LendingDeploymentStatus {
  name: string;
  address: string;
  hasCode: boolean;
}

export interface CanonicalLoanRead {
  loanId: string;
  borrower: string;
  lender: string;
  principal: string;
  collateralETH: string;
  interestRateBps: string;
  durationMonths: string;
  emiAmount: string;
  totalRepaid: string;
  status: 'ACTIVE' | 'REPAID' | 'LIQUIDATED' | 'DEFAULTED' | 'UNKNOWN';
  principalOwed: string;
  interestOwed: string;
  outstandingAmount: string;
  nextInstallmentIndex: string | null;
  installmentCount: string | null;
  nextInstallmentAmount: string | null;
  nextInstallmentDueDate: string | null;
  isDefaulted: boolean | null;
  marketplaceRequestId: string | null;
}

export interface LoanNftRead {
  tokenId: string;
  loanId: string;
  borrower: string;
  lender: string;
  loanAmount: string;
  collateral: string;
  interestRateBps: string;
  durationMonths: string;
  status: string;
  mintDate: string;
}

export interface CanonicalLendingReadState {
  source: 'canonical-on-chain';
  deployment: LendingDeploymentStatus[];
  walletAddress: string;
  abcdBalance: string;
  directPool: LendingPoolState;
  collateralVaultEth: string;
  liquidationEligible: boolean | null;
  liquidationHealthFactor: string | null;
  liquidationCollateralEth: string | null;
  liquidationDebtAbcd: string | null;
  borrowerLoans: CanonicalLoanRead[];
  ownedLoanNfts: LoanNftRead[];
  unavailable: string[];
}

export interface LiquidationEligibilityRead {
  borrower: string;
  eligible: boolean;
  collateralEth: string;
  debtAbcd: string;
  healthFactor: string | null;
}

export interface IndexedLendingEvidence {
  transactionHash: string;
  blockNumber: string;
  transactionIndex: number;
  logIndex: number;
  eventName: string;
}

export interface IndexedDirectLendingActivity {
  borrower: string;
  counterparty: string | null;
  action: 'COLLATERAL_DEPOSIT' | 'COLLATERAL_WITHDRAWAL' | 'BORROW' | 'REPAY' | 'LIQUIDATION';
  asset: 'ETH' | 'ABCD';
  amount: string;
  relatedCollateralETH: string | null;
  evidence: IndexedLendingEvidence;
}

export interface CanonicalIndexedLendingHistory {
  directActivities: IndexedDirectLendingActivity[];
  repayments: Array<{ loanId: string; amount: string; borrower: string; lender: string; emiEvidence: IndexedLendingEvidence }>;
  unavailable: string | null;
}

type LendingHistoryApiResponse = {
  source?: { kind?: string; chainId?: string; contracts?: { lendingPool?: string } };
  available?: boolean;
  status?: string;
  reason?: string;
  message?: string;
  data?: {
    directLending?: { activities?: IndexedDirectLendingActivity[] };
    p2p?: { repayments?: Array<{ loanId: string; amount: string; borrower: string; lender: string; emiEvidence: IndexedLendingEvidence }> };
  };
};

type LendingHistoryFetch = (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function canonicalLendingHistoryEndpoint(walletAddress: string) {
  return `/api/lending/wallet/${encodeURIComponent(walletAddress)}?limit=50`;
}

/**
 * Reads the existing server-side canonical event projection. It deliberately
 * returns an explicit unavailable reason rather than deriving history from UI
 * state or falling back to an unverified source.
 */
export async function readCanonicalIndexedLendingHistory(
  walletAddress: string,
  fetchJson: LendingHistoryFetch = (input) => fetch(input) as Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
): Promise<CanonicalIndexedLendingHistory> {
  requireWalletAddress(walletAddress);
  try {
    const response = await fetchJson(canonicalLendingHistoryEndpoint(walletAddress));
    const payload = await response.json() as LendingHistoryApiResponse;
    if (!response.ok) throw new Error(payload.message || `Canonical lending API returned HTTP ${response.status}.`);
    if (payload.source?.kind !== 'canonical-indexed-on-chain'
      || payload.source.chainId !== DEPLOYMENT_CHAIN_ID.toString()
      || payload.source.contracts?.lendingPool?.toLowerCase() !== CONTRACTS.lending.toLowerCase()) {
      throw new Error('Lending history response does not match the canonical deployment manifest.');
    }
    if (!payload.available || payload.status !== 'AVAILABLE') {
      return { directActivities: [], repayments: [], unavailable: payload.reason || 'The canonical lending indexer is unavailable for this deployment.' };
    }
    const directActivities = payload.data?.directLending?.activities;
    const repayments = payload.data?.p2p?.repayments;
    if (!Array.isArray(directActivities) || !Array.isArray(repayments)) {
      throw new Error('Canonical lending API returned an invalid history response.');
    }
    return { directActivities, repayments, unavailable: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Canonical lending history request failed.';
    return { directActivities: [], repayments: [], unavailable: message };
  }
}

const lendingDeploymentAddresses = Object.freeze({
  ABCDToken: CONTRACTS.token,
  LendingPool: CONTRACTS.lending,
  CollateralVault: CONTRACTS.collateralVault,
  LoanManager: CONTRACTS.loanManager,
  EMIManager: CONTRACTS.emiManager,
  Liquidation: CONTRACTS.liquidation,
  LoanNFT: CONTRACTS.loanNFT,
  LoanMarketplace: CONTRACTS.loanMarketplace,
});

const loanStatus = (status: bigint | number): CanonicalLoanRead['status'] =>
  ({ 0: 'ACTIVE', 1: 'REPAID', 2: 'LIQUIDATED', 3: 'DEFAULTED' }[Number(status)] ?? 'UNKNOWN') as CanonicalLoanRead['status'];

/** Validates both the manifest's intended chain and bytecode for every Phase 6A contract. */
export async function verifyCanonicalLendingDeployment(): Promise<LendingDeploymentStatus[]> {
  const network = await canonicalProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Canonical lending RPC is on chain ${network.chainId}, expected ${DEPLOYMENT_CHAIN_ID}.`);
  }

  const deployment = await Promise.all(Object.entries(lendingDeploymentAddresses).map(async ([name, address]) => {
    try {
      await assertCanonicalContractDeployment(name, address);
      return { name, address, hasCode: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown deployment check error.';
      if (!message.includes('No deployed bytecode')) throw error;
      return { name, address, hasCode: false };
    }
  }));
  const missing = deployment.filter(({ hasCode }) => !hasCode);
  if (missing.length > 0) {
    throw new Error(`Missing deployed bytecode for: ${missing.map(({ name }) => name).join(', ')}.`);
  }
  return deployment;
}

function assertConfirmed(receipt: any, action: string) {
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${action} was reverted or not confirmed on-chain.`);
  }
  return receipt;
}

function nestedErrorData(error: unknown): string | null {
  const detail = error as { data?: unknown; error?: { data?: unknown }; info?: { error?: { data?: unknown } } };
  for (const candidate of [detail?.data, detail?.error?.data, detail?.info?.error?.data]) {
    if (typeof candidate === 'string' && /^0x[\da-fA-F]+$/.test(candidate)) return candidate;
  }
  return null;
}

/** Keeps a revert actionable without ever reporting an unconfirmed transaction as successful. */
export function lendingErrorMessage(error: unknown): string {
  const detail = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; info?: { error?: { code?: string | number; message?: string } } };
  const code = detail.code ?? detail.info?.error?.code;
  const message = detail.shortMessage || detail.reason || detail.message || detail.info?.error?.message || 'Lending transaction failed.';
  if (code === 4001 || code === '4001' || code === 'ACTION_REJECTED' || /user rejected|user denied/i.test(message)) return 'Transaction rejected in MetaMask. No on-chain state was changed.';
  if (/insufficient funds/i.test(message)) return 'Insufficient ETH to pay network gas.';
  const data = nestedErrorData(error);
  if (data) {
    for (const contractInterface of lendingErrorInterfaces) {
      try {
        const parsed = contractInterface.parseError(data);
        if (parsed) return `Lending contract reverted: ${parsed.name}.`;
      } catch { /* try the next canonical ABI */ }
    }
  }
  return message;
}

export interface CreditScoreMetrics {
  loansRepaid: number;
  latePayments: number;
  liquidations: number;
  referralsCount: number;
  walletAgeDays: number;
}

export interface CreditScoreResult {
  score: number;
  tier: "Poor" | "Fair" | "Good" | "Very Good" | "Excellent" | "Bronze" | "Silver" | "Gold" | "Platinum";
  reputationLevel: "Bronze" | "Silver" | "Gold" | "Platinum";
  ltvAllowance?: number;
  apyRate?: number;
  feeDiscount?: number;
  metrics?: CreditScoreMetrics;
}

/**
 * ABCDeFi reputation score.
 *
 * Score range: 300-850.
 * The calculation is intentionally deterministic and bounded so the
 * frontend never produces a score outside the documented credit range.
 */
export function calculateCreditScore(
  metrics: CreditScoreMetrics
): CreditScoreResult {
  const loansRepaid = Math.max(0, metrics.loansRepaid || 0);
  const latePayments = Math.max(0, metrics.latePayments || 0);
  const liquidations = Math.max(0, metrics.liquidations || 0);
  const referralsCount = Math.max(0, metrics.referralsCount || 0);
  const walletAgeDays = Math.max(0, metrics.walletAgeDays || 0);

  const repaymentPoints = Math.min(loansRepaid * 25, 250);

  const referralPoints = Math.min(
    referralsCount * 10,
    50
  );

  const walletAgePoints = Math.min(
    Math.floor(walletAgeDays / 30) * 5,
    100
  );

  const penalty =
    latePayments * 30 +
    liquidations * 100;

  const rawScore =
    300 +
    repaymentPoints +
    referralPoints +
    walletAgePoints -
    penalty;

  const score = Math.max(
    300,
    Math.min(850, rawScore)
  );

  let tier: CreditScoreResult["tier"];

  if (score >= 800) {
    tier = "Excellent";
  } else if (score >= 740) {
    tier = "Very Good";
  } else if (score >= 670) {
    tier = "Good";
  } else if (score >= 580) {
    tier = "Fair";
  } else {
    tier = "Poor";
  }

  let reputationLevel: CreditScoreResult["reputationLevel"];

  if (score >= 800) {
    reputationLevel = "Platinum";
  } else if (score >= 740) {
    reputationLevel = "Gold";
  } else if (score >= 670) {
    reputationLevel = "Silver";
  } else {
    reputationLevel = "Bronze";
  }

  const ltvAllowance =
    score >= 800 ? 50 :
    score >= 740 ? 45 :
    score >= 670 ? 40 :
    score >= 580 ? 35 :
    25;

  const apyRate =
    score >= 800 ? 7.5 :
    score >= 740 ? 8.0 :
    score >= 670 ? 9.0 :
    score >= 580 ? 10.0 :
    12.0;

  const feeDiscount =
    score >= 800 ? 50 :
    score >= 740 ? 35 :
    score >= 670 ? 20 :
    score >= 580 ? 10 :
    0;

  return {
    score,
    tier,
    reputationLevel,
    ltvAllowance,
    apyRate,
    feeDiscount,
    metrics,
  };
}

/**
 * Mint the Soulbound Reputation NFT using the real ReputationNFT contract.
 */
export async function mintOrSyncSoulboundReputationNFT(
  userAddress: string,
  score: number
) {
  if (!userAddress) {
    throw new Error("Wallet address is required.");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    throw new Error("Invalid wallet address.");
  }

  if (!Number.isInteger(score) || score < 300 || score > 850) {
    throw new Error("Credit score must be between 300 and 850.");
  }

  if (!CONTRACTS.reputationNFT) {
    throw new Error(
      "ReputationNFT contract address is not configured."
    );
  }

  const signer = await getSigner();

  const reputationNFT = new Contract(
    CONTRACTS.reputationNFT,
    ReputationNFTABI,
    signer
  );

  const metadataURI =
    `ipfs://abcdefi/reputation/${userAddress.toLowerCase()}/${score}`;

  const tx = await reputationNFT.mintReputationNFT(
    userAddress,
    score,
    metadataURI
  );

  return await tx.wait();
}

export async function getLendingContract(withSigner = false) {
  const providerOrSigner = withSigner
    ? await getSigner()
    : canonicalProvider;

  return new Contract(
    CONTRACTS.lending,
    LendingPoolABI,
    providerOrSigner
  );
}

function requireWalletAddress(value: string | undefined): string {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error('Connect a valid wallet address to read lending data.');
  }
  return value;
}

async function readCanonicalLendingPool(address: string): Promise<LendingPoolState> {
  const lending = new Contract(CONTRACTS.lending, LendingPoolABI, canonicalProvider);
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, canonicalProvider);
  const liquidation = new Contract(CONTRACTS.liquidation, LiquidationABI, canonicalProvider);
  const [position, available, liquidity, ltvBps, tokenRatePerETH, paused, tokenBalance, allowance, liquidationState] = await Promise.all([
    lending.getLoanPosition(address), lending.maxBorrowableTokens(address), lending.liquidityPoolBalance(),
    lending.ltvBps(), lending.tokenRatePerETH(), lending.paused(), token.balanceOf(address),
    token.allowance(address, CONTRACTS.lending), liquidation.checkLiquidationEligibility(address),
  ]);
  const borrowed = position.borrowedTokens as bigint;
  const maximum = borrowed + (available as bigint);
  const health = liquidationState.healthFactor as bigint;
  // Liquidation uses MaxUint256 as its no-debt sentinel. It is not a numeric health factor.
  const hasDebt = (liquidationState.debtTokens as bigint) > 0n;
  return {
    collateral: formatEther(position.collateralETH), borrowed: formatEther(borrowed), maxBorrowable: formatEther(maximum),
    availableToBorrow: formatEther(available), liquidity: formatEther(liquidity), tokenBalance: formatEther(tokenBalance),
    repaymentAllowance: formatEther(allowance), ltvBps: Number(ltvBps), tokenRatePerETH: formatEther(tokenRatePerETH),
    active: Boolean(position.active), paused: Boolean(paused), interest: null,
    healthFactor: hasDebt ? formatEther(health) : 'Unavailable',
  };
}

async function readBorrowerLoans(address: string): Promise<CanonicalLoanRead[]> {
  const loanManager = new Contract(CONTRACTS.loanManager, LoanManagerABI, canonicalProvider);
  const emiManager = new Contract(CONTRACTS.emiManager, EMIManagerABI, canonicalProvider);
  const marketplace = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, canonicalProvider);
  const history = await loanManager.getLoanHistory(address);
  return Promise.all(history.map(async (loan: any) => {
    const loanId = loan.loanId as bigint;
    const [owed, schedule, nextIndex, defaulted, requestId] = await Promise.all([
      loanManager.calculateTotalOwed(loanId), emiManager.getSchedule(loanId), emiManager.nextInstallmentIndex(loanId),
      emiManager.isDefaulted(loanId), marketplace.loanIdToRequestId(loanId),
    ]);
    const next = Number(nextIndex) < schedule.length ? schedule[Number(nextIndex)] : null;
    const principalOwed = owed.principalOwed as bigint;
    const interestOwed = owed.interestOwed as bigint;
    return {
      loanId: loanId.toString(), borrower: loan.borrower, lender: loan.lender,
      principal: formatEther(loan.principal), collateralETH: formatEther(loan.collateralETH),
      interestRateBps: loan.interestRateBps.toString(), durationMonths: loan.durationMonths.toString(),
      emiAmount: formatEther(loan.emiAmount), totalRepaid: formatEther(loan.totalRepaid), status: loanStatus(loan.status),
      principalOwed: formatEther(principalOwed), interestOwed: formatEther(interestOwed),
      outstandingAmount: formatEther(principalOwed + interestOwed),
      nextInstallmentIndex: nextIndex.toString(), installmentCount: schedule.length.toString(),
      nextInstallmentAmount: next ? formatEther(next.amount) : null,
      nextInstallmentDueDate: next ? next.dueDate.toString() : null,
      isDefaulted: Boolean(defaulted), marketplaceRequestId: requestId.toString(),
    };
  }));
}

async function readOwnedLoanNfts(address: string): Promise<LoanNftRead[]> {
  const loanNft = new Contract(CONTRACTS.loanNFT, LoanNFTABI, canonicalProvider);
  const count = await loanNft.balanceOf(address) as bigint;
  // Enumeration is on-chain and bounded to avoid an unbounded RPC fan-out for an abnormal wallet.
  if (count > 100n) throw new Error('LoanNFT ownership exceeds the safe on-chain read limit (100).');
  return Promise.all(Array.from({ length: Number(count) }, async (_, index) => {
    const tokenId = await loanNft.tokenOfOwnerByIndex(address, index);
    const info = await loanNft.getLoanNFTDetails(tokenId);
    return {
      tokenId: tokenId.toString(), loanId: info.loanId.toString(), borrower: info.borrower, lender: info.lender,
      loanAmount: formatEther(info.loanAmount), collateral: formatEther(info.collateral),
      interestRateBps: info.interestRateBps.toString(), durationMonths: info.durationMonths.toString(),
      // LoanNFT has its own enum order: ACTIVE, COMPLETED, DEFAULTED, LIQUIDATED.
      // It is intentionally distinct from LoanManager's ACTIVE, REPAID, LIQUIDATED, DEFAULTED order.
      status: ['ACTIVE', 'COMPLETED', 'DEFAULTED', 'LIQUIDATED'][Number(info.status)] ?? 'UNKNOWN', mintDate: info.mintDate.toString(),
    };
  }));
}

/**
 * Phase 6A canonical read model. It intentionally reads the RPC directly and
 * never falls back to the backend/indexer or to locally calculated finance data.
 */
export async function getCanonicalLendingReadState(userAddress?: string): Promise<CanonicalLendingReadState> {
  const address = requireWalletAddress(userAddress || await getWalletAddress());
  const deployment = await verifyCanonicalLendingDeployment();
  const vault = new Contract(CONTRACTS.collateralVault, CollateralVaultABI, canonicalProvider);
  const liquidation = new Contract(CONTRACTS.liquidation, LiquidationABI, canonicalProvider);
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, canonicalProvider);
  const [directPool, vaultEth, eligibility, borrowerLoans, ownedLoanNfts, abcdBalance] = await Promise.all([
    readCanonicalLendingPool(address), vault.getBorrowerETHCollateral(address), liquidation.checkLiquidationEligibility(address),
    readBorrowerLoans(address), readOwnedLoanNfts(address), token.balanceOf(address),
  ]);
  const debt = eligibility.debtTokens as bigint;
  return {
    source: 'canonical-on-chain', deployment, walletAddress: address, abcdBalance: formatEther(abcdBalance), directPool,
    collateralVaultEth: formatEther(vaultEth), liquidationEligible: debt > 0n ? Boolean(eligibility.isEligible) : null,
    liquidationHealthFactor: debt > 0n ? formatEther(eligibility.healthFactor) : null,
    liquidationCollateralEth: debt > 0n ? formatEther(eligibility.collateralETH) : null,
    liquidationDebtAbcd: debt > 0n ? formatEther(debt) : null,
    borrowerLoans, ownedLoanNfts,
    unavailable: [
      'CollateralVault ERC-20 collateral per borrower (the deployed ABI has no borrower getter).',
      'Global LoanMarketplace request list (the deployed ABI has no request-count getter).',
      'LoanManager lender history (the deployed ABI exposes borrower history only).',
      'LendingPool interest, repayment schedule, and LoanNFT records (the deployed pool exposes none).',
    ],
  };
}

export async function getLendingLiquidationEligibility(borrowerAddress: string): Promise<LiquidationEligibilityRead> {
  const borrower = requireWalletAddress(borrowerAddress);
  await verifyCanonicalLendingDeployment();
  const liquidation = new Contract(CONTRACTS.liquidation, LiquidationABI, canonicalProvider);
  const result = await liquidation.checkLiquidationEligibility(borrower);
  const debt = result.debtTokens as bigint;
  return {
    borrower, eligible: Boolean(result.isEligible), collateralEth: formatEther(result.collateralETH), debtAbcd: formatEther(debt),
    healthFactor: debt === 0n ? null : formatEther(result.healthFactor),
  };
}

/** Existing dashboard compatibility wrapper; all values are canonical direct chain reads. */
export async function getLendingPoolState(userAddress?: string): Promise<LendingPoolState> {
  return (await getCanonicalLendingReadState(userAddress)).directPool;
}

export async function getLoanInfo(userAddress?: string) {
  const state = await getCanonicalLendingReadState(userAddress);
  return {
    collateral: state.directPool.collateral,
    borrowed: state.directPool.borrowed,
    healthFactor: state.directPool.healthFactor,
    active: state.directPool.active,
  };
}

function parsePositiveTokenAmount(value: string, label: string): bigint {
  let amount: bigint;
  try { amount = parseEther(value); } catch { throw new Error(`Enter a valid positive ${label} amount.`); }
  if (amount <= 0n) throw new Error(`Enter a positive ${label} amount.`);
  return amount;
}

function parseLoanId(value: string | number | bigint): bigint {
  const normalized = String(value).replace('LOAN-', '');
  if (!/^\d+$/.test(normalized)) throw new Error('Invalid loan or request ID.');
  return BigInt(normalized);
}

async function getCanonicalLendingSigner() {
  await verifyCanonicalLendingDeployment();
  const browserProvider = await getProvider();
  const network = await browserProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch MetaMask to Hardhat Local (chain ID ${DEPLOYMENT_CHAIN_ID}) before submitting a lending transaction.`);
  }
  const signer = await getSigner();
  const address = await signer.getAddress();
  if ((await browserProvider.getBalance(address)) === 0n) {
    throw new Error('Insufficient ETH for gas. Fund the connected wallet before submitting a lending transaction.');
  }
  return { signer, address };
}

async function assertEnoughEthForEstimatedGas(signer: Signer, estimatedGas: bigint) {
  const signerProvider = signer.provider;
  if (!signerProvider) throw new Error('MetaMask provider is unavailable. Reconnect the wallet and try again.');
  const [balance, feeData] = await Promise.all([signerProvider.getBalance(await signer.getAddress()), signerProvider.getFeeData()]);
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  if (balance < estimatedGas * gasPrice || (balance === 0n && estimatedGas > 0n)) {
    throw new Error('Insufficient ETH to pay network gas.');
  }
}

/**
 * Performs the same preflight that MetaMask will send: estimate against the
 * exact signer, submit only if that succeeds, then require a successful
 * receipt. This is intentionally used for every active lending write.
 */
async function submitLendingWrite(
  contract: any,
  method: string,
  args: unknown[],
  signer: Signer,
  label: string,
  onSubmitted?: TransactionSubmitted,
) {
  let estimatedGas: bigint;
  try {
    estimatedGas = await contract[method].estimateGas(...args);
  } catch (error) {
    throw new Error(lendingErrorMessage(error));
  }
  await assertEnoughEthForEstimatedGas(signer, estimatedGas);
  let transaction: any;
  try {
    transaction = await contract[method](...args);
  } catch (error) {
    throw new Error(lendingErrorMessage(error));
  }
  onSubmitted?.(transaction.hash, label);
  const receipt = assertConfirmed(await transaction.wait(), label);
  return { receipt, hash: transaction.hash, transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber) };
}

function parseReceiptEvent(receipt: any, contractInterface: Interface, eventName: string, argumentName: string): string | null {
  for (const log of receipt?.logs || []) {
    try {
      const parsed = contractInterface.parseLog(log);
      if (parsed?.name === eventName) return BigInt(parsed.args[argumentName]).toString();
    } catch { /* unrelated log */ }
  }
  return null;
}

async function ensureAbcdAllowance(
  signer: Awaited<ReturnType<typeof getSigner>>,
  owner: string,
  spender: string,
  requiredAmount: bigint,
  onSubmitted?: TransactionSubmitted,
) {
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, signer);
  const [balance, allowance] = await Promise.all([token.balanceOf(owner), token.allowance(owner, spender)]);
  if ((balance as bigint) < requiredAmount) {
    throw new Error(`Insufficient ABCD balance. Required ${formatEther(requiredAmount)} ABCD.`);
  }
  if ((allowance as bigint) >= requiredAmount) return;
  await submitLendingWrite(token, 'approve', [spender, requiredAmount], signer, 'ABCD approval', onSubmitted);
}

/** Explicit approval control for a supported lending spender. */
export async function approveAbcdForLending(
  spender: 'lendingPool' | 'loanMarketplace' | 'emiManager' | 'liquidation',
  amountString: string,
  onSubmitted?: TransactionSubmitted,
) {
  const amount = parsePositiveTokenAmount(amountString, 'ABCD approval');
  const { signer, address } = await getCanonicalLendingSigner();
  const target = {
    lendingPool: CONTRACTS.lending,
    loanMarketplace: CONTRACTS.loanMarketplace,
    emiManager: CONTRACTS.emiManager,
    liquidation: CONTRACTS.liquidation,
  }[spender];
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, signer);
  if ((await token.balanceOf(address)) < amount) throw new Error(`Insufficient ABCD balance. Required ${formatEther(amount)} ABCD.`);
  return submitLendingWrite(token, 'approve', [target, amount], signer, 'ABCD approval', onSubmitted);
}

export async function depositCollateral(amountEthString: string, onSubmitted?: TransactionSubmitted) {
  const amount = parsePositiveTokenAmount(amountEthString, 'ETH collateral');
  const { signer } = await getCanonicalLendingSigner();
  const contract = new Contract(CONTRACTS.lending, LendingPoolABI, signer);
  return submitLendingWrite(contract, 'depositCollateral', [{ value: amount }], signer, 'Collateral deposit', onSubmitted);
}

export async function borrowTokens(amountString: string, onSubmitted?: TransactionSubmitted) {
  const amount = parsePositiveTokenAmount(amountString, 'ABCD borrow');
  const { signer, address } = await getCanonicalLendingSigner();
  const contract = new Contract(CONTRACTS.lending, LendingPoolABI, signer);
  const [available, liquidity, paused] = await Promise.all([contract.maxBorrowableTokens(address), contract.liquidityPoolBalance(), contract.paused()]);
  if (paused) throw new Error('LendingPool is paused.');
  if ((available as bigint) < amount) throw new Error(`Borrow amount exceeds the contract-calculated capacity of ${formatEther(available)} ABCD.`);
  if ((liquidity as bigint) < amount) throw new Error(`Insufficient LendingPool liquidity. Available: ${formatEther(liquidity)} ABCD.`);
  return submitLendingWrite(contract, 'borrowTokens', [amount], signer, 'Borrow', onSubmitted);
}

export async function repayLoan(amountString: string, onSubmitted?: TransactionSubmitted) {
  const requested = parsePositiveTokenAmount(amountString, 'ABCD repayment');
  const { signer, address } = await getCanonicalLendingSigner();
  const lending = new Contract(CONTRACTS.lending, LendingPoolABI, signer);
  const position = await lending.getLoanPosition(address);
  const debt = position.borrowedTokens as bigint;
  if (debt === 0n) throw new Error('There is no active LendingPool debt to repay.');
  const amount = requested > debt ? debt : requested;
  await ensureAbcdAllowance(signer, address, CONTRACTS.lending, amount, onSubmitted);
  return submitLendingWrite(lending, 'repayLoan', [amount], signer, 'Repayment', onSubmitted);
}

export async function withdrawCollateral(
  amountEthString: string,
  onSubmitted?: TransactionSubmitted
) {
  const amount = parsePositiveTokenAmount(amountEthString, 'ETH withdrawal');
  const { signer, address } = await getCanonicalLendingSigner();
  const contract = new Contract(CONTRACTS.lending, LendingPoolABI, signer);
  const position = await contract.getLoanPosition(address);
  if ((position.collateralETH as bigint) < amount) throw new Error(`Insufficient collateral. Available: ${formatEther(position.collateralETH)} ETH.`);
  return submitLendingWrite(contract, 'withdrawCollateral', [amount], signer, 'Collateral withdrawal', onSubmitted);
}

/** Creates a P2P request using the ABI's actual durationMonths parameter. */
export async function createCanonicalLoanRequest(
  principalAmount: string,
  collateralEth: string,
  interestRateBps: number,
  durationMonths: number,
  purpose: string,
  onSubmitted?: TransactionSubmitted,
) {
  const principal = parsePositiveTokenAmount(principalAmount, 'ABCD principal');
  const collateral = parsePositiveTokenAmount(collateralEth, 'ETH collateral');
  if (!Number.isInteger(interestRateBps) || interestRateBps < 0) throw new Error('Interest rate must be a non-negative whole number of basis points.');
  if (!Number.isInteger(durationMonths) || durationMonths <= 0) throw new Error('Loan duration must be at least one month.');
  const { signer } = await getCanonicalLendingSigner();
  const marketplace = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, signer);
  const result = await submitLendingWrite(
    marketplace, 'createLoanRequest', [principal, interestRateBps, durationMonths, purpose.trim(), { value: collateral }], signer, 'Loan request creation', onSubmitted,
  );
  return { ...result, requestId: parseReceiptEvent(result.receipt, new Interface(LoanMarketplaceABI), 'RequestCreated', 'requestId') };
}

export async function createMarketplaceLoan(
  borrowAmount: string,
  collateralEth: string,
  durationDays = 30,
  interestApyBps = 925,
  purpose = "ABCDeFi loan",
  onSubmitted?: TransactionSubmitted,
) {
  const durationMonths = Math.max(
    1,
    Math.ceil(durationDays / 30)
  );

  return createCanonicalLoanRequest(borrowAmount, collateralEth, interestApyBps, durationMonths, purpose, onSubmitted);
}

export async function fundMarketplaceLoan(
  loanId: string,
  principalAmount: string,
  onSubmitted?: TransactionSubmitted,
) {
  const { signer, address } = await getCanonicalLendingSigner();
  const marketplace = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, signer);
  const requestId = parseLoanId(loanId);
  const request = await marketplace.loanRequests(requestId);
  if (Number(request.status) !== 0) throw new Error('This loan request is no longer open.');
  if (String(request.borrower).toLowerCase() === address.toLowerCase()) throw new Error('A borrower cannot fund their own loan request.');
  const amount = request.principalAmount as bigint;
  if (principalAmount && parsePositiveTokenAmount(principalAmount, 'ABCD principal') !== amount) throw new Error('The supplied principal does not match the on-chain loan request.');
  await ensureAbcdAllowance(signer, address, CONTRACTS.loanMarketplace, amount, onSubmitted);
  const result = await submitLendingWrite(marketplace, 'fundLoanRequest', [requestId], signer, 'Loan funding', onSubmitted);
  return { ...result, loanId: parseReceiptEvent(result.receipt, new Interface(LoanMarketplaceABI), 'RequestFunded', 'loanId') };
}

export async function cancelMarketplaceLoan(
  loanId: string,
  onSubmitted?: TransactionSubmitted,
) {
  const { signer, address } = await getCanonicalLendingSigner();
  const marketplace = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, signer);
  const requestId = parseLoanId(loanId);
  const request = await marketplace.loanRequests(requestId);
  if (String(request.borrower).toLowerCase() !== address.toLowerCase()) throw new Error('Only the borrower can cancel this loan request.');
  if (Number(request.status) !== 0) throw new Error('Only an open loan request can be cancelled.');
  return submitLendingWrite(marketplace, 'cancelLoanRequest', [requestId], signer, 'Loan request cancellation', onSubmitted);
}

export function calculateAutoInterest(
  principal: number,
  interestApyBps: number,
  elapsedDays: number
): number {
  if (
    principal <= 0 ||
    interestApyBps <= 0 ||
    elapsedDays <= 0
  ) {
    return 0;
  }

  return (
    principal *
    (interestApyBps / 10000) *
    (elapsedDays / 365)
  );
}

export function calculateEmiDetails(
  principal: number,
  interestApyBps: number,
  durationMonths: number
) {
  if (
    principal <= 0 ||
    durationMonths <= 0
  ) {
    return {
      monthlyEmi: 0,
      totalInterest: 0,
      totalPayable: 0,
    };
  }

  const monthlyRate =
    interestApyBps / 10000 / 12;

  const factor = Math.pow(
    1 + monthlyRate,
    durationMonths
  );

  const monthlyEmi =
    monthlyRate === 0
      ? principal / durationMonths
      : (
          (principal *
            monthlyRate *
            factor) /
          (factor - 1)
        );

  const totalPayable =
    monthlyEmi * durationMonths;

  return {
    monthlyEmi,
    totalInterest:
      totalPayable - principal,
    totalPayable,
  };
}

export async function payLoanEmi(loanId: string, onSubmitted?: TransactionSubmitted) {
  const { signer, address } = await getCanonicalLendingSigner();
  const loanIdBn = parseLoanId(loanId);
  const token = new Contract(CONTRACTS.token, ABCDTokenABI, signer);
  const emi = new Contract(CONTRACTS.emiManager, EMIManagerABI, signer);
  const loanManager = new Contract(CONTRACTS.loanManager, LoanManagerABI, canonicalProvider);
  const [loan, schedule, nextIndexRaw] = await Promise.all([
    loanManager.getLoan(loanIdBn), emi.getSchedule(loanIdBn), emi.nextInstallmentIndex(loanIdBn),
  ]);
  const nextIndex = Number(nextIndexRaw);
  if (String(loan.borrower).toLowerCase() !== address.toLowerCase()) throw new Error('Only the borrower can pay this EMI.');
  if (Number(loan.status) !== 0) throw new Error('This loan is not active.');

  if (nextIndex >= schedule.length) {
    throw new Error("All EMI installments have already been paid.");
  }

  const installment = schedule[nextIndex];
  if (installment.isPaid) {
    throw new Error("The current EMI installment is already paid.");
  }

  const amount = installment.amount as bigint;
  const balance = await token.balanceOf(address);
  if (balance < amount) {
    throw new Error(
      `Insufficient ABCD balance. Required ${formatEther(amount)} ABCD.`
    );
  }

  await ensureAbcdAllowance(signer, address, CONTRACTS.emiManager, amount, onSubmitted);
  return submitLendingWrite(emi, 'payEMI', [loanIdBn], signer, 'EMI payment', onSubmitted);
}

export async function getMarketplaceLoan(loanId: string) {
  const contract = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, canonicalProvider);
  return contract.loanRequests(parseLoanId(loanId));
}

export async function getOpenLoanRequests() {
  await verifyCanonicalLendingDeployment();
  const marketplace = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, canonicalProvider);

  const requests: any[] = [];
  const events = await marketplace.queryFilter(marketplace.filters.RequestCreated());
  for (const event of events) {
    const requestId = (event as any).args?.requestId;
    if (requestId === undefined) continue;
    const request = await marketplace.loanRequests(requestId);
    if (Number(request.status) === 0) requests.push(request);
  }
  return requests;
}

export async function getLoanOnChain(loanId: string | number | bigint) {
  const loanManager = new Contract(CONTRACTS.loanManager, LoanManagerABI, canonicalProvider);
  return loanManager.getLoan(parseLoanId(loanId));
}

export async function getLoanHistoryOnChain(borrower: string) {
  const loanManager = new Contract(CONTRACTS.loanManager, LoanManagerABI, canonicalProvider);
  return loanManager.getLoanHistory(requireWalletAddress(borrower));
}

export async function getFundedLoansForLender(lender: string) {
  const marketplace = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, canonicalProvider);
  const loanManager = new Contract(CONTRACTS.loanManager, LoanManagerABI, canonicalProvider);
  const filter = marketplace.filters.RequestFunded(null, lender);
  const events = await marketplace.queryFilter(filter);
  const loans: any[] = [];
  for (const event of events) {
    const loanId = (event as any).args?.loanId;
    if (loanId === undefined) continue;
    const loan = await loanManager.getLoan(loanId);
    loans.push({ loanId, loan });
  }
  return loans;
}


export async function getEmiSchedule(loanId: string | number | bigint) {
  const emi = new Contract(CONTRACTS.emiManager, EMIManagerABI, canonicalProvider);
  const id = parseLoanId(loanId);
  const schedule = await emi.getSchedule(id);
  const nextIndex = Number(await emi.nextInstallmentIndex(id));
  return {
    schedule,
    nextIndex,
    currentInstallment: nextIndex < schedule.length ? schedule[nextIndex] : null,
    defaulted: await emi.isDefaulted(id),
  };
}

export async function getLoanAndEmi(loanId: string | number | bigint) {
  const [loan, emi] = await Promise.all([
    getLoanOnChain(loanId),
    getEmiSchedule(loanId),
  ]);
  return { loan, ...emi };
}

export function evaluateMarginCallRisk(
  collateralEth: number,
  borrowedAbcd: number,
  ethPriceUsd = 0
) {
  if (ethPriceUsd <= 0) {
    return {
      ltvPercent: 0,
      healthFactor: 0,
      riskLevel: "Unknown" as const,
      maxBorrowAllowed: 0,
      collateralUsdValue: 0,
      isWarning: false,
      isCritical: false,
      isLiquidatable: false,
    };
  }

  const collateralUsdValue =
    collateralEth * ethPriceUsd;

  const ltvPercent =
    collateralUsdValue > 0
      ? (borrowedAbcd /
          collateralUsdValue) *
        100
      : 0;

  const maxBorrowAllowed =
    collateralUsdValue * 0.35;

  const healthFactor =
    borrowedAbcd > 0
      ? maxBorrowAllowed / borrowedAbcd
      : Infinity;

  const isLiquidatable =
    ltvPercent >= 80;

  const isCritical =
    !isLiquidatable && ltvPercent >= 70;

  return {
    ltvPercent,
    healthFactor,
    riskLevel: isLiquidatable
      ? ("Liquidatable" as const)
      : isCritical
        ? ("Warning" as const)
        : ("Safe" as const),
    maxBorrowAllowed,
    collateralUsdValue,
    isWarning: isCritical,
    isCritical,
    isLiquidatable,
  };
}

export async function executeLiquidation(
  borrowerAddress: string,
  debtToCover: string,
  onSubmitted?: TransactionSubmitted,
) {
  const borrower = requireWalletAddress(borrowerAddress);
  const requested = parsePositiveTokenAmount(debtToCover, 'liquidation debt');
  const { signer, address } = await getCanonicalLendingSigner();
  const liquidation = new Contract(CONTRACTS.liquidation, LiquidationABI, signer);
  const eligibility = await liquidation.checkLiquidationEligibility(borrower);
  if (!eligibility.isEligible) throw new Error('This LendingPool position is not eligible for liquidation.');
  const amount = requested > (eligibility.debtTokens as bigint) ? eligibility.debtTokens as bigint : requested;
  await ensureAbcdAllowance(signer, address, CONTRACTS.liquidation, amount, onSubmitted);
  return submitLendingWrite(liquidation, 'liquidatePosition', [borrower, amount], signer, 'Liquidation', onSubmitted);
}

/** Anyone may mark a P2P loan defaulted once the contract's due-date grace period has elapsed. */
export async function markMarketplaceLoanDefaulted(loanId: string, onSubmitted?: TransactionSubmitted) {
  const id = parseLoanId(loanId);
  const { signer } = await getCanonicalLendingSigner();
  const emi = new Contract(CONTRACTS.emiManager, EMIManagerABI, signer);
  if (!await emi.isDefaulted(id)) throw new Error('The next EMI is not past its on-chain due date and grace period.');
  return submitLendingWrite(emi, 'markDefaulted', [id], signer, 'P2P default marking', onSubmitted);
}

/** Anyone may settle a LoanManager DEFAULTED P2P loan to its recorded lender. */
export async function liquidateDefaultedMarketplaceLoan(loanId: string, onSubmitted?: TransactionSubmitted) {
  const id = parseLoanId(loanId);
  const { signer } = await getCanonicalLendingSigner();
  const loanManager = new Contract(CONTRACTS.loanManager, LoanManagerABI, canonicalProvider);
  const marketplace = new Contract(CONTRACTS.loanMarketplace, LoanMarketplaceABI, signer);
  const [loan, requestId] = await Promise.all([loanManager.getLoan(id), marketplace.loanIdToRequestId(id)]);
  if (Number(loan.status) !== 3) throw new Error('Only a LoanManager DEFAULTED loan can use P2P liquidation.');
  const request = await marketplace.loanRequests(requestId);
  if (Number(request.status) !== 1 || (request.collateralETH as bigint) === 0n) throw new Error('The associated P2P collateral is not available for liquidation.');
  return submitLendingWrite(marketplace, 'liquidateDefaultedLoan', [id], signer, 'P2P liquidation', onSubmitted);
}

export async function topUpCollateral(
  amountEth: string
) {
  return depositCollateral(amountEth);
}

export interface LoanNFTItem {
  tokenId: string;
  loanId: string;
  role: 'Borrower' | 'Lender';
  owner: string;
  amount: string;
  interestApyBps: number;
  durationDays: number;
  status: 'ACTIVE' | 'REPAID' | 'LIQUIDATED' | 'CANCELLED';
  mintedAt?: string;
}

export async function fundLoanOnChain(loanId: string, amountEthString: string) {
  return fundMarketplaceLoan(loanId, amountEthString);
}

export async function payEMIOnChain(loanId: string, _emiAmountString?: string) {
  return payLoanEmi(loanId);
}

export async function closeMarketplaceLoan(loanId: string) {
  return cancelMarketplaceLoan(loanId);
}

export interface MarketplaceLoan {
  id: string;
  borrower: string;
  lender?: string;
  borrowAmount: string;
  collateralEth: string;
  interestApyBps: number;
  durationDays: number;
  status: 'Open' | 'Requested' | 'Funded' | 'Active' | 'Repaid' | 'Closed' | 'Defaulted' | 'Liquidated' | 'Cancelled';
  purpose?: string;
  createdAt?: string;
  expiresAt?: string;
  dueDate?: string;
  remainingBalance?: string;
  monthlyEmi?: string;
  nextPaymentDate?: string;
  paidEmis?: number;
  totalEmis?: number;
  remainingEmis?: number;
  accruedInterest?: string;
  healthFactor?: number;
  liquidationPrice?: number;
  ltvRatio?: number;
  daysPastDue?: number;
  penaltyAmount?: string;
  defaultReason?: string;
}

export interface DefaultedLoanRecord {
  id: string;
  borrower: string;
  principalAmount: string;
  overdueDays: number;
  gracePeriodDaysRemaining: number;
  collateralEth: string;
  status: 'GRACE_PERIOD' | 'LIQUIDATION_READY';
  loanId?: string;
  borrowerName?: string;
  overduePrincipal?: string;
  daysPastDue?: number;
  penaltyFees?: string;
  scoreImpact?: number;
  gracePeriodEnds?: string;
}

export interface LiquidationRecord {
  id: string;
  loanId: string;
  borrower: string;
  liquidator: string;
  debtCovered: string;
  collateralSeizedEth: string;
  surplusToTreasuryEth: string;
  timestamp: string;
  debtSettledAbcd?: string;
  liquidatorRewardEth?: string;
  txHash?: string;
  status?: 'Completed' | 'Pending' | 'Failed';
}

export const MOCK_DEFAULTED_LOANS: DefaultedLoanRecord[] = [
  {
    id: 'DEF-201',
    borrower: '0x3C44CdD46a9380a46014605930064d7879e96f13',
    principalAmount: '8,000 ABCD',
    overdueDays: 12,
    gracePeriodDaysRemaining: 2,
    collateralEth: '3.2',
    status: 'GRACE_PERIOD',
  },
  {
    id: 'DEF-202',
    borrower: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    principalAmount: '15,000 ABCD',
    overdueDays: 25,
    gracePeriodDaysRemaining: 0,
    collateralEth: '5.8',
    status: 'LIQUIDATION_READY',
  },
];

export const MOCK_LIQUIDATION_HISTORY: LiquidationRecord[] = [
  {
    id: 'LIQ-501',
    loanId: 'LOAN-980',
    borrower: '0x15d34AA54267DB7D7c367839AAf71A00a2C6A65E',
    liquidator: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    debtCovered: '10,000 ABCD',
    collateralSeizedEth: '4.2 ETH',
    surplusToTreasuryEth: '0.15 ETH',
    timestamp: '1 day ago',
  },
];

export function generateLoanReportData(loans: MarketplaceLoan[]) {
  const totalLoans = loans.length;
  const activeCount = loans.filter((l) => l.status === 'Active' || l.status === 'Funded').length;
  const repaidCount = loans.filter((l) => l.status === 'Repaid').length;
  const defaultedCount = loans.filter((l) => l.status === 'Defaulted' || l.status === 'Liquidated').length;
  const liquidatedLoansCount = loans.filter((l) => l.status === 'Liquidated').length;
  const parseAmount = (amount: string) => Number(amount.replace(/[^0-9.]/g, '')) || 0;
  const totalOriginationVolumeUsd = loans.reduce((total, loan) => total + parseAmount(loan.borrowAmount), 0);
  const activeOutstandingDebtUsd = loans
    .filter((loan) => loan.status === 'Active' || loan.status === 'Funded')
    .reduce((total, loan) => total + parseAmount(loan.remainingBalance || loan.borrowAmount), 0);
  const totalCollateralLockedEth = loans
    .filter((loan) => loan.status === 'Active' || loan.status === 'Funded' || loan.status === 'Defaulted')
    .reduce((total, loan) => total + parseAmount(loan.collateralEth), 0);
  const totalInterestPaidToLendersUsd = loans
    .filter((loan) => loan.status === 'Repaid' || loan.status === 'Closed')
    .reduce((total, loan) => total + Math.max(0, parseAmount(loan.borrowAmount) * (loan.interestApyBps / 10_000) * (loan.durationDays / 365)), 0);
  const averageInterestApyPct = totalLoans > 0
    ? (loans.reduce((total, loan) => total + loan.interestApyBps, 0) / totalLoans / 100).toFixed(2)
    : '0.00';
  const averageLtvPct = totalLoans > 0
    ? (loans.reduce((total, loan) => total + (loan.ltvRatio || 0), 0) / totalLoans).toFixed(2)
    : '0.00';

  return {
    totalLoans,
    activeCount,
    repaidCount,
    defaultedCount,
    repaymentRate: totalLoans > 0 ? ((repaidCount / totalLoans) * 100).toFixed(1) + '%' : '100%',
    defaultRate: totalLoans > 0 ? ((defaultedCount / totalLoans) * 100).toFixed(1) + '%' : '0%',
    totalLoansCreated: totalLoans,
    activeLoansCount: activeCount,
    repaidLoansCount: repaidCount,
    defaultedLoansCount: defaultedCount,
    liquidatedLoansCount,
    totalOriginationVolumeUsd,
    activeOutstandingDebtUsd,
    averageInterestApyPct,
    protocolReserveFundUsd: 0,
    averageLtvPct,
    totalCollateralLockedEth: totalCollateralLockedEth.toFixed(4),
    totalInterestPaidToLendersUsd,
    generatedAt: new Date().toISOString(),
  };
}

export function downloadLoanReportCSV(loans: MarketplaceLoan[]) {
  const headers = ['ID', 'Borrower', 'Lender', 'Borrow Amount', 'Collateral (ETH)', 'APY (bps)', 'Duration (Days)', 'Status'];
  const rows = loans.map((l) => [
    l.id,
    l.borrower,
    l.lender || 'N/A',
    l.borrowAmount,
    l.collateralEth,
    l.interestApyBps,
    l.durationDays,
    l.status,
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `abcdefi_loan_report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
