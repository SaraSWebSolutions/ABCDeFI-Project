import { Contract, Interface, ZeroAddress, formatEther, getAddress, id, isAddress, parseEther } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, LENDING_V2_CONTRACTS, CONTRACTS, getLendingV2Configuration, getLendingV2DeploymentBlock, getLendingV2DeploymentVersion } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { clearWalletCache, getProvider, getSigner } from './wallet';
import PoolArtifact from '../../artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json';
import VaultArtifact from '../../artifacts/contracts/lending/v2/CollateralVaultV2.sol/CollateralVaultV2.json';
import ManagerArtifact from '../../artifacts/contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json';
import MarketplaceArtifact from '../../artifacts/contracts/lending/v2/LoanMarketplaceV2.sol/LoanMarketplaceV2.json';
import EMIArtifact from '../../artifacts/contracts/lending/v2/EMIManagerV2.sol/EMIManagerV2.json';
import LiquidationArtifact from '../../artifacts/contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json';
import LoanNftArtifact from '../../artifacts/contracts/nft/LoanNFTV2.sol/LoanNFTV2.json';
import TokenArtifact from '../../artifacts/contracts/token/ABCDTokenV2.sol/ABCDTokenV2.json';

const interfaces = [new Interface(PoolArtifact.abi), new Interface(ManagerArtifact.abi), new Interface(MarketplaceArtifact.abi), new Interface(EMIArtifact.abi), new Interface(LiquidationArtifact.abi), new Interface(TokenArtifact.abi)];
type V2ReadTarget = { contract: string; address: string; functionName: string };

function protocolReadError(target: V2ReadTarget, error: unknown): Error {
  const cause = errorMessage(error);
  return new Error(`Lending V2 read failed: ${target.contract}.${target.functionName} at ${target.address} on chain ${DEPLOYMENT_CHAIN_ID}. ${cause}`);
}

async function readProtocol<T>(target: V2ReadTarget, action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) { throw protocolReadError(target, error); }
}
const terms = new Set([30 * 86400, 90 * 86400, 180 * 86400]);
const REPAY_ALL_ALLOWANCE_BUFFER_SECONDS = 600n;
// A localhost node can leave its latest block timestamp behind wall-clock time
// until the next wallet transaction is mined. Keep the existing short buffer,
// but also cover that observed gap. The cap prevents an unbounded allowance.
const MAX_REPAY_ALL_ALLOWANCE_BUFFER_SECONDS = 24n * 60n * 60n;
const APR_DENOMINATOR = 10_000n * 365n * 86_400n;

export type V2Progress = { stage: 'preparing' | 'wallet' | 'submitted' | 'confirming' | 'confirmed'; action: string; hash?: string; blockNumber?: string };
export type V2ProgressListener = (progress: V2Progress) => void;
export type CompletionCertificateMetadata = {
  lender: { metadataUri: string; metadataHash: string };
  borrower: { metadataUri: string; metadataHash: string };
  platform: { metadataUri: string; metadataHash: string };
};
/** The authenticated platform prepares real role-specific IPFS provenance
 * immediately before a terminal repayment. It never supplies origin metadata. */
export type CompletionMetadataPreparer = (loanId: string) => Promise<CompletionCertificateMetadata>;

export function repayAllApprovalAmount(
  outstanding: bigint,
  loan: { principalOutstanding: bigint; aprBps: bigint | number },
  latestBlockTimestamp: bigint,
  nowSeconds = BigInt(Math.floor(Date.now() / 1000)),
): bigint {
  const staleBlockSeconds = nowSeconds > latestBlockTimestamp ? nowSeconds - latestBlockTimestamp : 0n;
  const bufferSeconds = staleBlockSeconds + REPAY_ALL_ALLOWANCE_BUFFER_SECONDS;
  const boundedBuffer = bufferSeconds > MAX_REPAY_ALL_ALLOWANCE_BUFFER_SECONDS ? MAX_REPAY_ALL_ALLOWANCE_BUFFER_SECONDS : bufferSeconds;
  return outstanding + (loan.principalOutstanding * BigInt(loan.aprBps) * boundedBuffer / APR_DENOMINATOR) + 1n;
}

/**
 * An EMI preflight is a read, while ERC-20 approval and settlement are later
 * mined blocks. For a capped installment that currently equals live debt,
 * per-second accrual can otherwise leave the exact preview allowance one or a
 * few wei short. Reuse the bounded allowance calculation already used by the
 * direct repay-all path; this never changes the contract's authoritative EMI
 * amount or permits a transfer beyond the token allowance the user approved.
 */
async function accruingLoanApprovalAmount(loanId: string, amount: bigint, manager: Contract): Promise<bigint> {
  const [loan, latestBlock] = await Promise.all([manager.getLoan(loanId), canonicalProvider.getBlock('latest')]);
  if (!latestBlock) throw new Error('Unable to read the latest canonical block before EMI approval.');
  return repayAllApprovalAmount(amount, loan, BigInt(latestBlock.timestamp));
}

/**
 * A completion-metadata request and a wallet approval can both take long
 * enough for per-second interest to accrue. Read the canonical debt at the
 * point an approval is about to be requested, rather than carrying forward a
 * preview made before either user-facing step.
 */
async function currentRepayAllApprovalAmount(loanId: string, manager: Contract): Promise<bigint> {
  const [outstanding, loan, latestBlock] = await Promise.all([
    manager.previewOutstanding(loanId), manager.getLoan(loanId), canonicalProvider.getBlock('latest'),
  ]);
  if (!latestBlock) throw new Error('Unable to read the latest canonical block before repayment.');
  return repayAllApprovalAmount(outstanding, loan, BigInt(latestBlock.timestamp));
}

async function confirmedTransaction(action: string, send: () => Promise<any>, progress?: V2ProgressListener) {
  progress?.({ stage: 'wallet', action });
  const tx = await send();
  progress?.({ stage: 'submitted', action, hash: tx.hash });
  progress?.({ stage: 'confirming', action, hash: tx.hash });
  const mined = await tx.wait();
  if (!mined || mined.status !== 1) throw new Error(`${action} was not confirmed successfully.`);
  // MetaMask can retain the just-mined nonce on a cached BrowserProvider for
  // one request. A follow-up approval/repayment must use a fresh signer so it
  // cannot submit the already-consumed nonce.
  clearWalletCache();
  progress?.({ stage: 'confirmed', action, hash: tx.hash, blockNumber: String(mined.blockNumber) });
  return { tx, mined };
}

export type V2Tx = { hash: string; blockNumber: string; loanId: string | null; requestId: string | null; depositId: string | null; approvalHashes: string[] };
export type V2Read = {
  loan: Record<string, unknown>; aprBps: string; start: string; isDirect: boolean; principal: string;
  /** Compatibility alias for the live CollateralVaultV2 balance. */
  collateralETH: string;
  /** Immutable LoanManagerV2 origination collateral, for historical provenance. */
  originalCollateralETH: string;
  /** Current collateral held by CollateralVaultV2 and used by live risk reads. */
  currentVaultCollateralETH: string;
  borrower: string; lender: string; maturity: string; marginCallAt: string; marginCallCureEnd: string;
  accruedInterest: string; outstanding: string; totalRepayment: string; state: number; reserveContribution: string; badDebt: string; ltvBps: string | null; healthFactor: string | null; liquidatable: boolean | null; riskError: string | null;
  metadata: { tokenId: string; owner: string; uri: string; hash: string; loanId: string } | null;
  certificates: Array<{ tokenId: string; role: 'Lender' | 'Borrower' | 'Platform'; owner: string; uri: string; hash: string; loanId: string; valuation: string; valuationFeed: string; valuationRoundId: string; valuationUpdatedAt: string; completionABCDUSDPrice: string; formulaVersion: string; completedAt: string; completionBlock: string }>;
  schedule: { installmentAmount: string; amountApplied: string; remainingDue: string; state: 'DUE' | 'PARTIALLY_SETTLED' | 'SETTLED'; installmentCount: string; paidInstallments: string; nextDueAt: string; chainTimestamp: string; due: boolean; completed: boolean } | null;
};
export type V2PendingDeposit = { depositId: string; borrower: string; collateralETH: string; maxBorrowable: string; collateralUSD: string; active: boolean };
export type V2Request = { requestId: string; borrower: string; lender: string; principal: string; collateralETH: string; termSeconds: string; state: number; loanId: string; initialLtvBps: string };
export type V2P2PRequestLifecycleEvent = {
  eventName: 'RequestCreated' | 'RequestFunded' | 'RequestCancelled' | 'RequestRepaid' | 'RequestRecovered';
  blockNumber: string;
  transactionHash: string;
  logIndex: number;
  args: Record<string, unknown>;
};
export type V2P2PRequestHistory = {
  requestId: string;
  request: V2Request;
  history: V2P2PRequestLifecycleEvent[];
  nextCursor: string | null;
};
export type V2P2PCapacity = { collateralETH: string; collateralUSD: string; maxPrincipal: string; initialLtvBps: string };
export type V2WalletHistory = { status: string; source?: { kind?: string }; directPositions: V2PendingDeposit[]; loans: Array<Record<string, unknown>>; requests: V2Request[]; events: Array<Record<string, unknown>> };
export type V2IndexerStatus = { status: string; checkpoint: string | null; deploymentVersion: string | null };
export type V2WalletSummary = {
  /** Current contract-read debt for loans discoverable by the confirmed V2 projection. */
  outstanding: string;
  /** Capacity held in current, active V2 direct-collateral deposits. */
  availableToBorrow: string;
  /** The lowest current V2 health factor for a loan with debt, when present. */
  healthFactor: string | null;
  /** Completion certificates currently owned by this wallet. */
  completionCertificateCount: string;
};
export type V2ProtocolState = {
  poolLiquidity: string; poolTokenBalance: string; reserveBalance: string;
  initialLtvBps: string; p2pInitialLtvBps: string; marginCallThresholdBps: string; marginCallCureSeconds: string; aprBps: string; p2pAprBps: string;
  liquidationThresholdBps: string; partialLiquidationTargetLtvBps: string; partialLiquidationExecution: 'CONFIGURED' | 'NOT_CONFIGURED';
  ethUsd: string; abcdUsd: string; supportedTermsDays: string[] | null; gracePeriodDays: string | null;
};
export type V2ReserveEvent = { eventName?: string; blockNumber?: string | number; transactionHash?: string; logIndex?: string | number; args?: Record<string, unknown> };
export type V2ReserveState = {
  balance: string; reserveCoverCapABCD: string; fundingEvents: V2ReserveEvent[]; payoutEvents: V2ReserveEvent[]; accountingEvents: V2ReserveEvent[];
  checkpoint: string | null; deploymentVersion: string | null;
};

type V2Installment = { amount: bigint; dueAt: bigint; paid?: boolean; amountApplied?: bigint; state?: bigint };

/** Converts the canonical on-chain schedule without indexing an empty Result. */
export function v2EmiSchedule(installments: ArrayLike<V2Installment>, nextInstallment: bigint, chainTimestamp: bigint, settled = false): V2Read['schedule'] {
  const installmentCount = Number(installments.length);
  if (!Number.isSafeInteger(installmentCount) || installmentCount === 0) return null;
  const nextIndex = Number(nextInstallment);
  if (!Number.isSafeInteger(nextIndex) || nextIndex < 0) throw new Error('Canonical EMI schedule returned an invalid next-installment index.');
  // A terminal recovery can advance nextInstallment beyond the last entry while
  // retaining the paid entry as the canonical evidence of what was settled.
  // Keep that real final entry for display; do not replace it with a synthetic
  // DUE/zero schedule row.
  const currentInstallment = !settled && nextIndex < installmentCount
    ? installments[nextIndex]
    : settled && nextIndex > 0
      ? installments[Math.min(nextIndex - 1, installmentCount - 1)]
      : null;
  const amountApplied = currentInstallment?.amountApplied ?? 0n;
  const remainingDue = currentInstallment ? currentInstallment.amount - amountApplied : 0n;
  const installmentState = currentInstallment?.state === 1n ? 'PARTIALLY_SETTLED' : currentInstallment?.state === 2n || currentInstallment?.paid ? 'SETTLED' : 'DUE';
  return {
    installmentAmount: currentInstallment ? formatEther(currentInstallment.amount) : '0.0',
    amountApplied: formatEther(amountApplied),
    remainingDue: formatEther(remainingDue),
    state: installmentState,
    installmentCount: String(installmentCount),
    paidInstallments: nextInstallment.toString(),
    nextDueAt: currentInstallment ? currentInstallment.dueAt.toString() : '0',
    chainTimestamp: chainTimestamp.toString(),
    due: Boolean(currentInstallment && chainTimestamp >= currentInstallment.dueAt),
    completed: settled || nextIndex >= installmentCount,
  };
}

function errorMessage(error: unknown) {
  const info = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; data?: string; error?: { data?: string }; info?: { error?: { data?: string; message?: string } } };
  const message = info.shortMessage || info.reason || info.message || info.info?.error?.message || 'Lending V2 transaction failed.';
  if (info.code === 4001 || info.code === 'ACTION_REJECTED' || /rejected|denied/i.test(message)) return 'Transaction rejected in MetaMask. Any earlier confirmed transaction, including an approval, remains on-chain.';
  if (/insufficient funds|insufficient balance/i.test(message)) return 'Insufficient ETH to pay the transaction value or network gas.';
  const data = info.data || info.error?.data || info.info?.error?.data;
  if (data) for (const iface of interfaces) try { const decoded = iface.parseError(data); if (decoded) return `Contract reverted: ${decoded.name}.`; } catch { /* next ABI */ }
  return message;
}
export const lendingV2ErrorMessage = errorMessage;

function requireId(value: string, label: string) { if (!/^\d+$/.test(value) || BigInt(value) === 0n) throw new Error(`${label} must be a positive integer.`); return BigInt(value); }
function requireAmount(value: string) { if (!/^\d+(\.\d+)?$/.test(value) || parseEther(value) <= 0n) throw new Error('Amount must be greater than zero.'); return parseEther(value); }
function requireMetadata(uri: string, hash: string) {
  if (!/^(ipfs:\/\/|https:\/\/).+/.test(uri.trim())) throw new Error('A valid ipfs:// or https:// metadata URI is required.');
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error('Metadata hash must be a 32-byte hexadecimal value.');
}
function requireCompletionMetadata(metadata: CompletionCertificateMetadata) {
  for (const role of ['lender', 'borrower', 'platform'] as const) requireMetadata(metadata[role].metadataUri, metadata[role].metadataHash);
}
function completionMetadataArgument(metadata: CompletionCertificateMetadata) {
  requireCompletionMetadata(metadata);
  return {
    lender: { uri: metadata.lender.metadataUri.trim(), hash: metadata.lender.metadataHash },
    borrower: { uri: metadata.borrower.metadataUri.trim(), hash: metadata.borrower.metadataHash },
    platform: { uri: metadata.platform.metadataUri.trim(), hash: metadata.platform.metadataHash },
  };
}
function stateLabel(state: number) { return ['Active', 'Repaid', 'Grace period', 'Defaulted', 'Liquidated', 'Closed', 'Margin call', 'Residual debt'][state] || `Unknown (${state})`; }
function v2Contracts() {
  if (!LENDING_V2_CONTRACTS) throw new Error('Lending V2 is not available on the current canonical deployment. Deploy the isolated lendingV2 namespace before using this feature.');
  return LENDING_V2_CONTRACTS;
}

async function assertV2Read() {
  if ((await canonicalProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Canonical RPC is not Hardhat Local (31337).');
  for (const [name, address] of Object.entries(v2Contracts())) {
    if (typeof address !== 'string') continue;
    if (await canonicalProvider.getCode(address) === '0x') throw new Error(`Lending V2 ${name} has no bytecode at its canonical manifest address.`);
  }
}
async function assertV2Write() {
  await assertV2Read();
  const walletProvider = await getProvider();
  if ((await walletProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Switch MetaMask to Hardhat Local (31337).');
}
async function assertGasBalance(signer: Awaited<ReturnType<typeof getSigner>>, gasLimit: bigint, value = 0n) {
  const [feeData, balance] = await Promise.all([signer.provider!.getFeeData(), signer.provider!.getBalance(await signer.getAddress())]);
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;
  if (balance < value + gasLimit * gasPrice) throw new Error('Insufficient ETH for the transaction value and estimated network gas.');
}

/**
 * MetaMask may return a stale account nonce through an injected BrowserProvider
 * immediately after an approval has mined. The canonical RPC is already the
 * source of truth for this V2 deployment, so read its pending nonce at the
 * last possible moment and pass it explicitly to the wallet request. This is
 * transaction plumbing only; it does not alter any protocol accounting.
 */
async function walletTransactionOverrides(signer: Awaited<ReturnType<typeof getSigner>>, gasLimit: bigint, value?: bigint) {
  const nonce = await canonicalProvider.getTransactionCount(await signer.getAddress(), 'pending');
  return value === undefined ? { gasLimit, nonce } : { gasLimit, nonce, value };
}
async function receipt(action: string, send: () => Promise<any>, iface: Interface, approvalHashes: string[] = [], progress?: V2ProgressListener): Promise<V2Tx> {
  await assertV2Write();
  const { tx, mined } = await confirmedTransaction(action, send, progress);
  let loanId: string | null = null; let requestId: string | null = null; let depositId: string | null = null;
  for (const log of mined.logs) try {
    const event = iface.parseLog(log);
    if (event?.args.loanId !== undefined) loanId = event.args.loanId.toString();
    if (event?.args.requestId !== undefined) requestId = event.args.requestId.toString();
    if (event?.args.depositId !== undefined) depositId = event.args.depositId.toString();
  } catch { /* unrelated log */ }
  return { hash: tx.hash, blockNumber: String(mined.blockNumber), loanId, requestId, depositId, approvalHashes };
}

/**
 * A direct V2 collateral deposit is the only transaction that creates a
 * pending-deposit ID. Parse its exact canonical pool event instead of using
 * the generic receipt scanner: the receipt also contains a vault event with a
 * similarly named ID, which must never be accepted as a pool deposit.
 */
async function depositReceipt(
  send: () => Promise<any>,
  poolAddress: string,
  borrower: string,
  collateralETH: bigint,
  progress?: V2ProgressListener,
): Promise<V2Tx> {
  await assertV2Write();
  const { tx, mined } = await confirmedTransaction('Collateral deposit', send, progress);

  const poolInterface = new Interface(PoolArtifact.abi);
  const expectedPool = poolAddress.toLowerCase();
  const expectedBorrower = borrower.toLowerCase();
  for (const log of mined.logs) {
    if (log.address.toLowerCase() !== expectedPool) continue;
    try {
      const event = poolInterface.parseLog(log);
      if (event?.name !== 'CollateralDepositCreated') continue;
      const eventBorrower = String(event.args.borrower).toLowerCase();
      const eventCollateral = BigInt(event.args.collateralETH);
      if (eventBorrower !== expectedBorrower || eventCollateral !== collateralETH) {
        throw new Error('Collateral deposit receipt does not match the connected wallet or submitted ETH amount.');
      }
      const depositId = BigInt(event.args.depositId);
      if (depositId === 0n) throw new Error('Collateral deposit receipt emitted an invalid deposit ID.');
      return { hash: tx.hash, blockNumber: String(mined.blockNumber), loanId: null, requestId: null, depositId: depositId.toString(), approvalHashes: [] };
    } catch (error) {
      if (error instanceof Error && /Collateral deposit receipt/.test(error.message)) throw error;
      // The canonical pool receipt can include unrelated OpenZeppelin logs.
    }
  }
  throw new Error('Collateral deposit was mined, but CollateralDepositCreated was not found on the canonical LendingPoolV2 receipt. Pending deposit ID was not populated.');
}
async function approveIfNeeded(spender: string, amount: bigint, progress?: V2ProgressListener): Promise<string | null> {
  const signer = await getSigner();
  const owner = await signer.getAddress();
  const token = new Contract(LENDING_V2_CONTRACTS.token, TokenArtifact.abi, signer);
  if (await token.allowance(owner, spender) >= amount) return null;
  const gas = await token.approve.estimateGas(spender, amount);
  await assertGasBalance(signer, gas);
  const { tx } = await confirmedTransaction('Approve ABCD', () => token.approve(spender, amount, { gasLimit: gas }), progress);
  return tx.hash;
}
async function apiGet<T>(path: string): Promise<T> {
  // Indexed state changes independently of the browser session as the
  // canonical indexer advances. Never reuse a prior wallet-history response
  // after a confirmed receipt or an explicit dashboard refresh.
  const response = await fetch(path, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === 'UNAVAILABLE') throw new Error(body.reason || body.message || 'Lending V2 indexed data is unavailable for the current deployment.');
  return body as T;
}

/** Reads only deployment-scoped canonical Reserve data; there is no UI fallback. */
export async function getV2ReserveState(): Promise<V2ReserveState> {
  const response = await apiGet<{ checkpoint?: string; source?: { deploymentVersion?: string }; data?: Partial<V2ReserveState> }>('/api/lending-v2/reserve');
  const data = response.data;
  if (!data || typeof data.balance !== 'string' || typeof data.reserveCoverCapABCD !== 'string') {
    throw new Error('Canonical Reserve data is unavailable for the current deployment.');
  }
  return {
    balance: data.balance, reserveCoverCapABCD: data.reserveCoverCapABCD,
    fundingEvents: Array.isArray(data.fundingEvents) ? data.fundingEvents : [],
    payoutEvents: Array.isArray(data.payoutEvents) ? data.payoutEvents : [],
    accountingEvents: Array.isArray(data.accountingEvents) ? data.accountingEvents : [],
    checkpoint: response.checkpoint ?? null, deploymentVersion: response.source?.deploymentVersion ?? null,
  };
}

export async function getV2Loan(loanId: string): Promise<V2Read> {
  requireId(loanId, 'Loan ID');
  await assertV2Read();
  const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  const liquid = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, canonicalProvider);
  const emi = new Contract(v2Contracts().emi, EMIArtifact.abi, canonicalProvider);
  const nft = new Contract(v2Contracts().loanNFT, LoanNftArtifact.abi, canonicalProvider);
  const [loan, accruedInterest, outstanding, totalRepayment, state, certificatesByRole, installments, nextInstallment, latestBlock] = await Promise.all([
    manager.getLoan(loanId), manager.previewAccruedInterest(loanId), manager.previewOutstanding(loanId), manager.previewTotalRepayment(loanId), manager.previewLoanStatus(loanId), Promise.all([0, 1, 2].map(role => nft.loanCertificates(loanId, role))), emi.getSchedule(loanId), emi.nextInstallment(loanId), canonicalProvider.getBlock('latest'),
  ]);
  // Risk/oracle failure must not hide a real settled loan or its vault balance.
  let risk: { ltvBps: string; healthFactor: string; liquidatable: boolean } | null = null;
  let riskError: string | null = null;
  if (outstanding !== 0n) {
    try {
      const [ltvBps, healthFactor, liquidatable] = await Promise.all([liquid.currentLtvBps(loanId), liquid.healthFactor(loanId), liquid.isLiquidatable(loanId)]);
      risk = { ltvBps: ltvBps.toString(), healthFactor: healthFactor.toString(), liquidatable: Boolean(liquidatable) };
    } catch (error) { riskError = errorMessage(error); }
  }
  const certificateRoles = ['Lender', 'Borrower', 'Platform'] as const;
  const certificates = (await Promise.all(certificatesByRole.map(async (certificate: bigint, index: number) => {
    if (certificate === 0n) return null;
    const [owner, uri, info] = await Promise.all([nft.ownerOf(certificate), nft.tokenURI(certificate), nft.getCertificate(certificate)]);
    return {
      tokenId: certificate.toString(), role: certificateRoles[index], owner, uri, hash: info.metadataHash, loanId,
      valuation: formatEther(info.certificateValue), valuationFeed: info.valuationFeed, valuationRoundId: info.valuationRoundId.toString(), valuationUpdatedAt: info.valuationUpdatedAt.toString(), completionABCDUSDPrice: formatEther(info.completionABCDUSDPrice), formulaVersion: info.formulaVersion.toString(),
      completedAt: info.completedAt.toString(), completionBlock: info.completionBlock.toString(),
    };
  }))).filter((certificate): certificate is NonNullable<typeof certificate> => certificate !== null);
  const metadata = certificates.find(certificate => certificate.role === 'Borrower') ?? null;
  const vault = new Contract(v2Contracts().vault, VaultArtifact.abi, canonicalProvider);
  const liveCollateral = await vault.loanCollateral(loanId);
  if (!latestBlock) throw new Error('Unable to read the latest canonical block for EMI due-state verification.');
  const schedule = v2EmiSchedule(installments, nextInstallment, BigInt(latestBlock.timestamp), [1, 4, 5].includes(Number(state)));
  return {
    loan, aprBps: loan.aprBps.toString(), start: loan.start.toString(), isDirect: loan.lender.toLowerCase() === v2Contracts().pool.toLowerCase(), principal: formatEther(loan.principal), collateralETH: formatEther(liveCollateral), originalCollateralETH: formatEther(loan.collateralETH), currentVaultCollateralETH: formatEther(liveCollateral), borrower: loan.borrower, lender: loan.lender, maturity: loan.maturity.toString(), marginCallAt: loan.marginCallAt.toString(), marginCallCureEnd: loan.marginCallCureEnd.toString(),
    accruedInterest: formatEther(accruedInterest), outstanding: formatEther(outstanding), totalRepayment: formatEther(totalRepayment), state: Number(state), reserveContribution: formatEther(loan.reserveContribution), badDebt: formatEther(loan.badDebt), ltvBps: risk?.ltvBps ?? null, healthFactor: risk?.healthFactor ?? null, liquidatable: risk?.liquidatable ?? null, riskError, metadata, certificates, schedule,
  };
}

export async function getV2PendingDeposit(depositId: string): Promise<V2PendingDeposit> {
  requireId(depositId, 'Deposit ID');
  await assertV2Read();
  const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, canonicalProvider);
  const vault = new Contract(v2Contracts().vault, VaultArtifact.abi, canonicalProvider);
  const [pending, collateral] = await Promise.all([pool.pendingCollateral(depositId), vault.directDepositCollateral(depositId)]);
  // LendingPoolV2.maxBorrowable accepts the ETH collateral amount in wei, not
  // a pending-deposit identifier. The vault is the authoritative source for
  // that isolated deposit amount.
  const [maxBorrowable, collateralUSD] = await Promise.all([pool.maxBorrowable(collateral), pool.collateralValueUSD(collateral)]);
  return { depositId, borrower: pending.borrower, collateralETH: formatEther(collateral), maxBorrowable: formatEther(maxBorrowable), collateralUSD: formatEther(collateralUSD), active: Boolean(pending.active) };
}

/**
 * Restores a lost UI selection only from actual canonical pool events. This
 * deliberately does not use indexer counts or a frontend-generated counter.
 */
export async function getV2LatestPendingDepositForWallet(wallet: string): Promise<V2PendingDeposit | null> {
  if (!isAddress(wallet)) throw new Error('Connected wallet address is invalid.');
  await assertV2Read();
  const fromBlock = getLendingV2DeploymentBlock();
  if (fromBlock === null) throw new Error('Canonical Lending V2 deployment block is unavailable for deposit discovery.');
  const contracts = v2Contracts();
  const poolInterface = new Interface(PoolArtifact.abi);
  const pool = new Contract(contracts.pool, PoolArtifact.abi, canonicalProvider);
  const vault = new Contract(contracts.vault, VaultArtifact.abi, canonicalProvider);
  const expectedBorrower = getAddress(wallet).toLowerCase();
  const depositEvent = poolInterface.getEvent('CollateralDepositCreated');
  if (!depositEvent) throw new Error('Canonical LendingPoolV2 ABI does not expose CollateralDepositCreated.');
  const depositTopic = depositEvent.topicHash;
  const logs = await canonicalProvider.getLogs({ address: contracts.pool, fromBlock, toBlock: 'latest', topics: [depositTopic] });

  for (const log of [...logs].reverse()) {
    const event = poolInterface.parseLog(log);
    if (!event || event.name !== 'CollateralDepositCreated') continue;
    const depositId = event.args.depositId.toString();
    if (getAddress(event.args.borrower).toLowerCase() !== expectedBorrower) continue;
    const [pending, collateral] = await Promise.all([pool.pendingCollateral(depositId), vault.directDepositCollateral(depositId)]);
    if (!pending.active || getAddress(pending.borrower).toLowerCase() !== expectedBorrower || collateral !== BigInt(event.args.collateralETH)) continue;
    return getV2PendingDeposit(depositId);
  }
  return null;
}

/**
 * Restores a direct loan from its canonical LendingPoolV2 event rather than
 * waiting for the confirmed MongoDB projection. This is intentionally scoped
 * to the canonical pool and then cross-checked against LoanManagerV2 state.
 */
export async function getV2LatestDirectLoanForWallet(wallet: string): Promise<string | null> {
  if (!isAddress(wallet)) throw new Error('Connected wallet address is invalid.');
  await assertV2Read();
  const fromBlock = getLendingV2DeploymentBlock();
  if (fromBlock === null) throw new Error('Canonical Lending V2 deployment block is unavailable for loan discovery.');
  const contracts = v2Contracts();
  const poolInterface = new Interface(PoolArtifact.abi);
  const loanEvent = poolInterface.getEvent('DirectLoanOpened');
  if (!loanEvent) throw new Error('Canonical LendingPoolV2 ABI does not expose DirectLoanOpened.');
  const expectedBorrower = getAddress(wallet).toLowerCase();
  const logs = await canonicalProvider.getLogs({ address: contracts.pool, fromBlock, toBlock: 'latest', topics: [loanEvent.topicHash] });
  const manager = new Contract(contracts.manager, ManagerArtifact.abi, canonicalProvider);
  for (const log of [...logs].reverse()) {
    const event = poolInterface.parseLog(log);
    if (!event || event.name !== 'DirectLoanOpened' || getAddress(event.args.borrower).toLowerCase() !== expectedBorrower) continue;
    const loanId = event.args.loanId.toString();
    const loan = await manager.getLoan(loanId);
    if (getAddress(loan.borrower).toLowerCase() === expectedBorrower && loan.lender.toLowerCase() === contracts.pool.toLowerCase()) return loanId;
  }
  return null;
}
export async function getV2Request(requestId: string): Promise<V2Request> {
  requireId(requestId, 'Request ID');
  await assertV2Read();
  const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, canonicalProvider);
  const request = await market.requests(requestId);
  return { requestId, borrower: request.borrower, lender: request.lender, principal: formatEther(request.principal), collateralETH: formatEther(request.collateral), termSeconds: request.term.toString(), state: Number(request.state), loanId: request.loanId.toString(), initialLtvBps: request.initialLtvBps.toString() };
}

const p2pRequestLifecycleEvents = new Set<V2P2PRequestLifecycleEvent['eventName']>(['RequestCreated', 'RequestFunded', 'RequestCancelled', 'RequestRepaid', 'RequestRecovered']);

/** Reads the canonical, deployment-scoped P2P marketplace request lifecycle. */
export async function getV2P2PRequestHistory(requestId: string, options: { limit?: number; cursor?: string | null } = {}): Promise<V2P2PRequestHistory> {
  requireId(requestId, 'Request ID');
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('P2P request-history limit must be between 1 and 200.');
  const query = new URLSearchParams({ limit: String(limit) });
  if (options.cursor) query.set('cursor', options.cursor);
  const response = await apiGet<{
    status?: string;
    source?: { kind?: string; chainId?: string; deploymentVersion?: string };
    data?: { requestId?: string; request?: { borrower?: string; lender?: string; principal?: string; collateral?: string; term?: string; state?: string; loanId?: string; initialLtvBps?: string }; history?: Array<{ eventName?: string; blockNumber?: string; transactionHash?: string; logIndex?: number; args?: Record<string, unknown> }> };
    page?: { nextCursor?: string | null };
  }>(`/api/lending-v2/requests/${requestId}?${query.toString()}`);
  const source = response.source;
  if (response.status !== 'AVAILABLE' || source?.kind !== 'canonical-v2-indexed-on-chain' || source.chainId !== DEPLOYMENT_CHAIN_ID.toString() || source.deploymentVersion !== getLendingV2DeploymentVersion()) {
    throw new Error('Canonical P2P request history is unavailable for the active Lending V2 deployment.');
  }
  const request = response.data?.request;
  const history = response.data?.history;
  if (!request || String(response.data?.requestId) !== requestId || !Array.isArray(history)) {
    throw new Error('Canonical P2P request history response is malformed.');
  }
  const normalizedHistory = history.map((event) => {
    const logIndex = event.logIndex;
    if (!event.eventName || !p2pRequestLifecycleEvents.has(event.eventName as V2P2PRequestLifecycleEvent['eventName']) || typeof event.blockNumber !== 'string' || typeof event.transactionHash !== 'string' || typeof logIndex !== 'number' || !Number.isInteger(logIndex) || !event.args || typeof event.args !== 'object') {
      throw new Error('Canonical P2P request history contains an invalid lifecycle event.');
    }
    return { eventName: event.eventName as V2P2PRequestLifecycleEvent['eventName'], blockNumber: event.blockNumber, transactionHash: event.transactionHash, logIndex, args: event.args };
  });
  return {
    requestId,
    request: { requestId, borrower: String(request.borrower || ''), lender: String(request.lender || ''), principal: formatEther(BigInt(request.principal || '0')), collateralETH: formatEther(BigInt(request.collateral || '0')), termSeconds: String(request.term || ''), state: Number(request.state), loanId: String(request.loanId || ''), initialLtvBps: String(request.initialLtvBps || '') },
    history: normalizedHistory,
    nextCursor: typeof response.page?.nextCursor === 'string' ? response.page.nextCursor : null,
  };
}
/** Reads the P2P marketplace's own oracle-priced ETH capacity; React is never the financial authority. */
export async function getV2P2PRequestCapacity(collateral: string): Promise<V2P2PCapacity> {
  const collateralWei = requireAmount(collateral);
  await assertV2Read();
  const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, canonicalProvider);
  const [collateralUSD, maxPrincipal, initialLtvBps] = await Promise.all([
    readProtocol({ contract: 'LoanMarketplaceV2', address: v2Contracts().marketplace, functionName: 'collateralValueUSD' }, () => market.collateralValueUSD(collateralWei)),
    readProtocol({ contract: 'LoanMarketplaceV2', address: v2Contracts().marketplace, functionName: 'previewMaxP2PPrincipal' }, () => market.previewMaxP2PPrincipal(collateralWei)),
    readProtocol({ contract: 'LoanMarketplaceV2', address: v2Contracts().marketplace, functionName: 'P2P_INITIAL_LTV_BPS' }, () => market.P2P_INITIAL_LTV_BPS()),
  ]);
  return { collateralETH: formatEther(collateralWei), collateralUSD: formatEther(collateralUSD), maxPrincipal: formatEther(maxPrincipal), initialLtvBps: initialLtvBps.toString() };
}
export async function getV2WalletHistory(wallet: string): Promise<V2WalletHistory> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) throw new Error('Connected wallet address is invalid.');
  const response = await apiGet<{ status: string; source?: { kind?: string }; data: Omit<V2WalletHistory, 'status' | 'source'> }>(`/api/lending-v2/wallet/${wallet}?limit=100`);
  return { status: response.status, source: response.source, ...response.data };
}

/** Reads only the canonical deployment-scoped Lending V2 indexer checkpoint. */
export async function getV2IndexerStatus(): Promise<V2IndexerStatus> {
  const response = await apiGet<{ status?: string; checkpoint?: string; source?: { deploymentVersion?: string } }>('/api/lending-v2/status');
  return {
    status: response.status ?? 'UNAVAILABLE',
    checkpoint: typeof response.checkpoint === 'string' ? response.checkpoint : null,
    deploymentVersion: typeof response.source?.deploymentVersion === 'string' ? response.source.deploymentVersion : null,
  };
}

/**
 * Compact active-dashboard read model. The V2 indexer supplies only the
 * wallet's discoverable IDs; the lending-v2 API then refreshes every loan's
 * financial fields from the canonical V2 contracts. This deliberately never
 * falls back to the legacy V1 LendingPool or LoanNFT contracts.
 */
export async function getV2WalletSummary(wallet: string): Promise<V2WalletSummary> {
  const history = await getV2WalletHistory(wallet);
  if (history.status !== 'AVAILABLE' || history.source?.kind !== 'canonical-v2-indexed-on-chain') {
    throw new Error('Canonical Lending V2 wallet state is not available for this deployment.');
  }
  const expectedWallet = getAddress(wallet).toLowerCase();
  const asWei = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : 0n;
  let outstanding = 0n;
  let availableToBorrow = 0n;
  let lowestHealth: bigint | null = null;
  let completionCertificateCount = 0n;

  for (const deposit of history.directPositions) {
    if (deposit.active) availableToBorrow += asWei(deposit.maxBorrowable);
  }
  for (const entry of history.loans) {
    const previews = entry.previews as Record<string, unknown> | undefined;
    const debt = asWei(previews?.outstanding);
    outstanding += debt;
    const health = asWei(previews?.healthFactor);
    if (debt > 0n && health > 0n && (lowestHealth === null || health < lowestHealth)) lowestHealth = health;
    const certificates = Array.isArray(entry.certificates) ? entry.certificates : [];
    completionCertificateCount += BigInt(certificates.filter((certificate) => {
      const owner = certificate && typeof certificate === 'object' ? (certificate as Record<string, unknown>).owner : null;
      return typeof owner === 'string' && owner.toLowerCase() === expectedWallet;
    }).length);
  }
  return {
    outstanding: formatEther(outstanding),
    availableToBorrow: formatEther(availableToBorrow),
    healthFactor: lowestHealth === null ? null : formatEther(lowestHealth),
    completionCertificateCount: completionCertificateCount.toString(),
  };
}

/**
 * Reads the deployed V2 contracts for dashboard protocol facts. The terms and
 * grace period are manifest-backed only because V2 intentionally has no public
 * Solidity getter for those immutable source-level constants.
 */
export async function getV2ProtocolState(): Promise<V2ProtocolState> {
  await assertV2Read();
  const contracts = v2Contracts();
  const pool = new Contract(contracts.pool, PoolArtifact.abi, canonicalProvider);
  const manager = new Contract(contracts.manager, ManagerArtifact.abi, canonicalProvider);
  const liquid = new Contract(contracts.liquidation, LiquidationArtifact.abi, canonicalProvider);
  const reserve = new Contract(contracts.reserve, ['function availableBalance() view returns (uint256)'], canonicalProvider);
  const oracle = new Contract(contracts.oracle, ['function priceUSD(address) view returns (uint256)'], canonicalProvider);
  const token = new Contract(contracts.token, TokenArtifact.abi, canonicalProvider);
  // Use the deployed pool's own asset getters. This prevents a stale V1 token
  // configuration from ever selecting an oracle feed for a V2 dashboard read.
  const [ethAsset, abcdAsset] = await Promise.all([
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'ETH_ASSET' }, () => pool.ETH_ASSET()),
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'abcd' }, () => pool.abcd()),
  ]);
  const market = new Contract(contracts.marketplace, MarketplaceArtifact.abi, canonicalProvider);
  const [poolLiquidity, poolTokenBalance, reserveBalance, initialLtvBps, p2pInitialLtvBps, marginCallThresholdBps, marginCallCureSeconds, aprBps, p2pAprBps, liquidationThresholdBps, partialLiquidationTargetLtvBps, ethUsd, abcdUsd, saleAdapter] = await Promise.all([
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'liquidity' }, () => pool.liquidity()),
    readProtocol({ contract: 'ABCDToken', address: abcdAsset, functionName: 'balanceOf(LendingPoolV2)' }, () => token.balanceOf(contracts.pool)),
    readProtocol({ contract: 'InsuranceReserveV2', address: contracts.reserve, functionName: 'availableBalance' }, () => reserve.availableBalance()),
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'MAX_INITIAL_LTV_BPS' }, () => pool.MAX_INITIAL_LTV_BPS()),
    readProtocol({ contract: 'LoanMarketplaceV2', address: contracts.marketplace, functionName: 'P2P_INITIAL_LTV_BPS' }, () => market.P2P_INITIAL_LTV_BPS()),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'MARGIN_CALL_THRESHOLD_BPS' }, () => liquid.MARGIN_CALL_THRESHOLD_BPS()),
    readProtocol({ contract: 'LoanManagerV2', address: contracts.manager, functionName: 'MARGIN_CALL_CURE_PERIOD' }, () => manager.MARGIN_CALL_CURE_PERIOD()),
    readProtocol({ contract: 'LoanManagerV2', address: contracts.manager, functionName: 'newLoanAprBps' }, () => manager.newLoanAprBps()),
    readProtocol({ contract: 'LoanManagerV2', address: contracts.manager, functionName: 'P2P_ETH_APR_BPS' }, () => manager.P2P_ETH_APR_BPS()),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'LIQUIDATION_THRESHOLD_BPS' }, () => liquid.LIQUIDATION_THRESHOLD_BPS()),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'P2P_PARTIAL_TARGET_LTV_BPS' }, () => liquid.P2P_PARTIAL_TARGET_LTV_BPS()),
    readProtocol({ contract: 'OracleAdapterV2', address: contracts.oracle, functionName: 'priceUSD(ETH_ASSET)' }, () => oracle.priceUSD(ethAsset)),
    readProtocol({ contract: 'OracleAdapterV2', address: contracts.oracle, functionName: 'priceUSD(ABCD)' }, () => oracle.priceUSD(abcdAsset)),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'saleAdapter' }, () => liquid.saleAdapter()),
  ]);
  const partialLiquidationExecution = saleAdapter === ZeroAddress ? 'NOT_CONFIGURED' : await new Contract(saleAdapter, ['function configured() view returns (bool)'], canonicalProvider).configured() ? 'CONFIGURED' : 'NOT_CONFIGURED';
  const config = getLendingV2Configuration();
  return {
    poolLiquidity: formatEther(poolLiquidity), poolTokenBalance: formatEther(poolTokenBalance), reserveBalance: formatEther(reserveBalance),
    initialLtvBps: initialLtvBps.toString(), p2pInitialLtvBps: p2pInitialLtvBps.toString(), marginCallThresholdBps: marginCallThresholdBps.toString(), marginCallCureSeconds: marginCallCureSeconds.toString(), aprBps: aprBps.toString(), p2pAprBps: p2pAprBps.toString(),
    liquidationThresholdBps: liquidationThresholdBps.toString(), partialLiquidationTargetLtvBps: partialLiquidationTargetLtvBps.toString(),
    partialLiquidationExecution,
    ethUsd: formatEther(ethUsd), abcdUsd: formatEther(abcdUsd),
    supportedTermsDays: config?.supportedTermSeconds?.map((seconds) => String(seconds / 86_400)) ?? null,
    gracePeriodDays: config?.maturityGracePeriodSeconds === undefined ? null : String(config.maturityGracePeriodSeconds / 86_400),
  };
}

export async function depositV2Collateral(amount: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'depositV2Collateral' });
  const value = requireAmount(amount); await assertV2Write();
  const signer = await getSigner(); const borrower = await signer.getAddress(); const contracts = v2Contracts(); const pool = new Contract(contracts.pool, PoolArtifact.abi, signer);
  const gas = await pool.depositCollateral.estimateGas({ value }); await assertGasBalance(signer, gas, value);
  return depositReceipt(async () => pool.depositCollateral(await walletTransactionOverrides(signer, gas, value)), contracts.pool, borrower, value, progress);
}
export async function borrowV2(depositId: string, principal: string, termDays: number, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'borrowV2' });
  const amount = requireAmount(principal); requireId(depositId, 'Deposit ID');
  if (!terms.has(termDays * 86400)) throw new Error('Use a supported 30, 90, or 180 day term.'); await assertV2Write();
  const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.borrowABCD.estimateGas(depositId, amount, termDays * 86400); await assertGasBalance(signer, gas);
  return receipt('Borrow', async () => pool.borrowABCD(depositId, amount, termDays * 86400, await walletTransactionOverrides(signer, gas)), new Interface(PoolArtifact.abi), [], progress);
}
export async function repayV2(loanId: string, amount: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'repayV2' });
  const value = requireAmount(amount); requireId(loanId, 'Loan ID'); await assertV2Write();
  const approval = await approveIfNeeded(v2Contracts().pool, value, progress); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.repay.estimateGas(loanId, value); await assertGasBalance(signer, gas);
  return receipt('Repayment', async () => pool.repay(loanId, value, await walletTransactionOverrides(signer, gas)), new Interface(PoolArtifact.abi), approval ? [approval] : [], progress);
}
export async function payV2DirectInstallment(loanId: string, prepareCompletionMetadata: CompletionMetadataPreparer, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'payV2DirectInstallment' });
  requireId(loanId, 'Loan ID'); await assertV2Write();
  const contracts = v2Contracts(); const emiRead = new Contract(contracts.emi, EMIArtifact.abi, canonicalProvider);
  const manager = new Contract(contracts.manager, ManagerArtifact.abi, canonicalProvider);
  const [, amount,, completionRequired] = await emiRead.previewDirectInstallment(loanId);
  const completion = completionRequired ? completionMetadataArgument(await prepareCompletionMetadata(loanId)) : null;
  const approval = await approveIfNeeded(contracts.pool, await accruingLoanApprovalAmount(loanId, amount, manager), progress);
  const signer = await getSigner(); const pool = new Contract(contracts.pool, PoolArtifact.abi, signer);
  const gas = completion
    ? await pool.payDirectInstallmentWithCompletionMetadata.estimateGas(loanId, completion)
    : await pool.payDirectInstallment.estimateGas(loanId);
  await assertGasBalance(signer, gas);
  return receipt('Direct installment payment', async () => completion
    ? pool.payDirectInstallmentWithCompletionMetadata(loanId, completion, await walletTransactionOverrides(signer, gas))
    : pool.payDirectInstallment(loanId, await walletTransactionOverrides(signer, gas)), new Interface(PoolArtifact.abi), approval ? [approval] : [], progress);
}
export async function repayAllV2(loanId: string, prepareCompletionMetadata: CompletionMetadataPreparer, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'repayAllV2' });
  requireId(loanId, 'Loan ID'); await assertV2Write(); const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  // Interest accrues every second. Approval and repayment are separate MetaMask
  // transactions. Refresh after metadata preparation and again after any
  // approval, so a real user delay cannot leave the next transaction using a
  // stale preview. Each approval remains capped by repayAllApprovalAmount; the
  // pool still transfers exactly the then-current obligation.
  progress?.({ stage: 'preparing', action: 'prepareCompletionMetadata' });
  const completion = completionMetadataArgument(await prepareCompletionMetadata(loanId));
  const approvalHashes: string[] = [];
  const initialApproval = await approveIfNeeded(v2Contracts().pool, await currentRepayAllApprovalAmount(loanId, manager), progress);
  if (initialApproval) approvalHashes.push(initialApproval);
  // A wallet approval itself is a separate mined block. Re-read authoritative
  // debt/allowance once it confirms before estimating and opening the actual
  // repayment confirmation. This is intentionally a bounded refresh, not a
  // change to contractual interest or repayment accounting.
  const refreshedApproval = await approveIfNeeded(v2Contracts().pool, await currentRepayAllApprovalAmount(loanId, manager), progress);
  if (refreshedApproval) approvalHashes.push(refreshedApproval);
  const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.repayAllWithCompletionMetadata.estimateGas(loanId, completion); await assertGasBalance(signer, gas);
  return receipt('Full repayment', async () => pool.repayAllWithCompletionMetadata(loanId, completion, await walletTransactionOverrides(signer, gas)), new Interface(PoolArtifact.abi), approvalHashes, progress);
}
export async function withdrawV2Collateral(loanId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'withdrawV2Collateral' });
  requireId(loanId, 'Loan ID'); await assertV2Write(); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  const loan = await manager.getLoan(loanId);
  const residualSettlement = Number(loan.state) === 4;
  const gas = residualSettlement ? await pool.withdrawResidualLiquidationCollateral.estimateGas(loanId) : await pool.withdrawSettledCollateral.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Collateral withdrawal', async () => residualSettlement ? pool.withdrawResidualLiquidationCollateral(loanId, await walletTransactionOverrides(signer, gas)) : pool.withdrawSettledCollateral(loanId, await walletTransactionOverrides(signer, gas)), new Interface(PoolArtifact.abi), [], progress);
}
export async function addV2LoanCollateral(loanId: string, amount: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'addV2LoanCollateral' });
  requireId(loanId, 'Loan ID'); const value = requireAmount(amount); await assertV2Write();
  const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.addCollateralToLoan.estimateGas(loanId, { value }); await assertGasBalance(signer, gas, value);
  return receipt('Loan collateral top-up', async () => pool.addCollateralToLoan(loanId, await walletTransactionOverrides(signer, gas, value)), new Interface(PoolArtifact.abi), [], progress);
}
export async function syncV2LoanRisk(loanId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'syncV2LoanRisk' });
  requireId(loanId, 'Loan ID'); await assertV2Write();
  const signer = await getSigner(); const liquidation = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, signer);
  const gas = await liquidation.syncRisk.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Risk-state synchronization', async () => liquidation.syncRisk(loanId, await walletTransactionOverrides(signer, gas)), new Interface(LiquidationArtifact.abi), [], progress);
}
export async function createV2Request(principal: string, collateral: string, termDays: number, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'createV2Request' });
  const amount = requireAmount(principal); const value = requireAmount(collateral);
  if (!terms.has(termDays * 86400)) throw new Error('Use a supported 30, 90, or 180 day term.'); await assertV2Write();
  const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const maximum = await market.previewMaxP2PPrincipal(value);
  if (amount > maximum) throw new Error('Requested P2P principal exceeds the current on-chain 35% ETH LTV capacity.');
  const gas = await market.createRequest.estimateGas(amount, termDays * 86400, { value }); await assertGasBalance(signer, gas, value);
  return receipt('P2P request', async () => market.createRequest(amount, termDays * 86400, await walletTransactionOverrides(signer, gas, value)), new Interface(MarketplaceArtifact.abi), [], progress);
}
export async function fundV2Request(requestId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'fundV2Request' });
  requireId(requestId, 'Request ID'); await assertV2Write(); const request = await getV2Request(requestId);
  if (request.state !== 0) throw new Error('This P2P request is not open for funding.');
  const approval = await approveIfNeeded(v2Contracts().marketplace, parseEther(request.principal), progress); const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const gas = await market.fundRequest.estimateGas(requestId); await assertGasBalance(signer, gas);
  return receipt('P2P funding', async () => market.fundRequest(requestId, await walletTransactionOverrides(signer, gas)), new Interface(MarketplaceArtifact.abi), approval ? [approval] : [], progress);
}
export async function payV2Emi(loanId: string, prepareCompletionMetadata: CompletionMetadataPreparer, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'payV2Emi' });
  requireId(loanId, 'Loan ID'); await assertV2Write(); const emiRead = new Contract(v2Contracts().emi, EMIArtifact.abi, canonicalProvider);
  const [schedule, nextInstallment, latestBlock] = await Promise.all([emiRead.getSchedule(loanId), emiRead.nextInstallment(loanId), canonicalProvider.getBlock('latest')]);
  const installment = schedule[Number(nextInstallment)]; if (!installment) throw new Error('This EMI schedule is already settled.');
  if (!latestBlock || BigInt(latestBlock.timestamp) < installment.dueAt) {
    throw new Error(`The next P2P EMI is not due until canonical block time ${installment.dueAt.toString()}.`);
  }
  const isTerminal = Number(nextInstallment) + 1 >= Number(schedule.length);
  const completion = isTerminal ? completionMetadataArgument(await prepareCompletionMetadata(loanId)) : null;
  const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  const approvalAmount = await accruingLoanApprovalAmount(loanId, installment.amount, manager);
  const approval = await approveIfNeeded(v2Contracts().emi, approvalAmount, progress); const signer = await getSigner(); const emi = new Contract(v2Contracts().emi, EMIArtifact.abi, signer);
  const gas = completion ? await emi.payInstallmentWithCompletionMetadata.estimateGas(loanId, completion) : await emi.payInstallment.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('EMI payment', async () => completion ? emi.payInstallmentWithCompletionMetadata(loanId, completion, await walletTransactionOverrides(signer, gas)) : emi.payInstallment(loanId, await walletTransactionOverrides(signer, gas)), new Interface(EMIArtifact.abi), approval ? [approval] : [], progress);
}
/**
 * Permissionless canonical overdue-installment recovery. The protocol reads
 * the exact next schedule remainder, validates the current oracle snapshots
 * and configured route, then records the immutable DUE -> PARTIALLY_SETTLED
 * -> SETTLED transition. It is intentionally separate from the blocked P2P
 * partial-liquidation and terminal-default paths.
 */
export async function executeV2OverdueEmi(loanId: string, progress?: V2ProgressListener): Promise<V2Tx> {
  progress?.({ stage: 'preparing', action: 'executeV2OverdueEmi' });
  requireId(loanId, 'Loan ID'); await assertV2Write();
  const signer = await getSigner(); const liquidation = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, signer);
  const gas = await liquidation.executeOverdueInstallment.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Due-installment collateral recovery', async () => liquidation.executeOverdueInstallment(
    loanId, await walletTransactionOverrides(signer, gas),
  ), new Interface(LiquidationArtifact.abi), [], progress);
}
export async function payV2OutstandingEmi(loanId: string, amount: string, prepareCompletionMetadata: CompletionMetadataPreparer, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'payV2OutstandingEmi' });
  const value = requireAmount(amount); requireId(loanId, 'Loan ID'); await assertV2Write();
  const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  const outstanding = await manager.previewOutstanding(loanId);
  const terminal = value === outstanding;
  const completion = terminal ? completionMetadataArgument(await prepareCompletionMetadata(loanId)) : null;
  const approval = await approveIfNeeded(v2Contracts().emi, value, progress); const signer = await getSigner(); const emi = new Contract(v2Contracts().emi, EMIArtifact.abi, signer);
  const gas = completion ? await emi.payOutstandingWithCompletionMetadata.estimateGas(loanId, value, completion) : await emi.payOutstanding.estimateGas(loanId, value); await assertGasBalance(signer, gas);
  return receipt('Outstanding EMI repayment', async () => completion ? emi.payOutstandingWithCompletionMetadata(loanId, value, completion, await walletTransactionOverrides(signer, gas)) : emi.payOutstanding(loanId, value, await walletTransactionOverrides(signer, gas)), new Interface(EMIArtifact.abi), approval ? [approval] : [], progress);
}
export async function liquidateV2(loanId: string, progress?: V2ProgressListener): Promise<V2Tx> {
  progress?.({ stage: 'preparing', action: 'liquidateV2' });
  requireId(loanId, 'Loan ID'); await assertV2Write();
  const signer = await getSigner(); const liquidation = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, signer);
  const gas = await liquidation.liquidate.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Partial liquidation', async () => liquidation.liquidate(loanId, await walletTransactionOverrides(signer, gas)), new Interface(LiquidationArtifact.abi), [], progress);
}
export async function settleV2Default(requestId: string, progress?: V2ProgressListener) {
  requireId(requestId, 'Request ID');
  progress;
  throw new Error('P2P default settlement is blocked until the whitepaper-undefined recovery and bad-debt policy is approved.');
}
export const metadataHashForUri = (uri: string) => id(uri.trim());
export { stateLabel };
