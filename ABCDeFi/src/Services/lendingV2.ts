import { Contract, Interface, formatEther, getAddress, id, isAddress, parseEther } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, LENDING_V2_CONTRACTS, CONTRACTS, getLendingV2Configuration, getLendingV2DeploymentBlock } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getProvider, getSigner } from './wallet';
import PoolArtifact from '../../artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json';
import VaultArtifact from '../../artifacts/contracts/lending/v2/CollateralVaultV2.sol/CollateralVaultV2.json';
import ManagerArtifact from '../../artifacts/contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json';
import MarketplaceArtifact from '../../artifacts/contracts/lending/v2/LoanMarketplaceV2.sol/LoanMarketplaceV2.json';
import EMIArtifact from '../../artifacts/contracts/lending/v2/EMIManagerV2.sol/EMIManagerV2.json';
import LiquidationArtifact from '../../artifacts/contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json';
import LoanNftArtifact from '../../artifacts/contracts/nft/LoanNFTV2.sol/LoanNFTV2.json';
import TokenArtifact from '../../artifacts/contracts/token/ABCDToken.sol/ABCDToken.json';

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

async function confirmedTransaction(action: string, send: () => Promise<any>, progress?: V2ProgressListener) {
  progress?.({ stage: 'wallet', action });
  const tx = await send();
  progress?.({ stage: 'submitted', action, hash: tx.hash });
  progress?.({ stage: 'confirming', action, hash: tx.hash });
  const mined = await tx.wait();
  if (!mined || mined.status !== 1) throw new Error(`${action} was not confirmed successfully.`);
  progress?.({ stage: 'confirmed', action, hash: tx.hash, blockNumber: String(mined.blockNumber) });
  return { tx, mined };
}

export type V2Tx = { hash: string; blockNumber: string; loanId: string | null; requestId: string | null; depositId: string | null; approvalHashes: string[] };
export type V2Read = {
  loan: Record<string, unknown>; aprBps: string; start: string; isDirect: boolean; principal: string; collateralETH: string; borrower: string; lender: string; maturity: string; marginCallAt: string; marginCallCureEnd: string;
  accruedInterest: string; outstanding: string; lateFee: string; totalRepayment: string; state: number; ltvBps: string | null; healthFactor: string | null; liquidatable: boolean | null; riskError: string | null;
  metadata: { tokenId: string; owner: string; uri: string; hash: string; loanId: string } | null;
  certificates: Array<{ tokenId: string; role: 'Lender' | 'Borrower' | 'Platform'; owner: string; uri: string; hash: string; loanId: string; valuation: string }>;
  schedule: { installmentAmount: string; installmentCount: string; paidInstallments: string; nextDueAt: string; completed: boolean } | null;
};
export type V2PendingDeposit = { depositId: string; borrower: string; collateralETH: string; maxBorrowable: string; collateralUSD: string; active: boolean };
export type V2Request = { requestId: string; borrower: string; lender: string; principal: string; collateralETH: string; termSeconds: string; state: number; loanId: string; initialLtvBps: string };
export type V2P2PCapacity = { collateralETH: string; collateralUSD: string; maxPrincipal: string; initialLtvBps: string };
export type V2WalletHistory = { status: string; source?: { kind?: string }; directPositions: V2PendingDeposit[]; loans: Array<Record<string, unknown>>; requests: V2Request[]; events: Array<Record<string, unknown>> };
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
  initialLtvBps: string; marginCallThresholdBps: string; marginCallCureSeconds: string; aprBps: string; lateFeeBps: string;
  liquidationThresholdBps: string; closeFactorBps: string; liquidationBonusBps: string;
  ethUsd: string; abcdUsd: string; supportedTermsDays: string[] | null; gracePeriodDays: string | null;
};

type V2Installment = { amount: bigint; dueAt: bigint };

/**
 * Direct loans have no EMI schedule. Ethers returns that empty Solidity array
 * as a Result proxy, which throws "out of result range" if index 0 is read.
 * Check the authoritative returned length before indexing it.
 */
export function v2EmiSchedule(installments: ArrayLike<V2Installment>, nextInstallment: bigint): V2Read['schedule'] {
  const installmentCount = Number(installments.length);
  if (!Number.isSafeInteger(installmentCount) || installmentCount === 0) return null;
  const nextIndex = Number(nextInstallment);
  if (!Number.isSafeInteger(nextIndex) || nextIndex < 0) throw new Error('Canonical EMI schedule returned an invalid next-installment index.');
  const currentInstallment = nextIndex < installmentCount ? installments[nextIndex] : null;
  return {
    installmentAmount: currentInstallment ? formatEther(currentInstallment.amount) : '0.0',
    installmentCount: String(installmentCount),
    paidInstallments: nextInstallment.toString(),
    nextDueAt: currentInstallment ? currentInstallment.dueAt.toString() : '0',
    completed: nextIndex >= installmentCount,
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
function stateLabel(state: number) { return ['Active', 'Repaid', 'Grace period', 'Defaulted', 'Liquidated', 'Closed', 'Margin call'][state] || `Unknown (${state})`; }
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
  const token = new Contract(CONTRACTS.token, TokenArtifact.abi, signer);
  if (await token.allowance(owner, spender) >= amount) return null;
  const gas = await token.approve.estimateGas(spender, amount);
  await assertGasBalance(signer, gas);
  const { tx } = await confirmedTransaction('Approve ABCD', () => token.approve(spender, amount, { gasLimit: gas }), progress);
  return tx.hash;
}
async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === 'UNAVAILABLE') throw new Error(body.reason || body.message || 'Lending V2 indexed data is unavailable for the current deployment.');
  return body as T;
}

export async function getV2Loan(loanId: string): Promise<V2Read> {
  requireId(loanId, 'Loan ID');
  await assertV2Read();
  const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  const liquid = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, canonicalProvider);
  const emi = new Contract(v2Contracts().emi, EMIArtifact.abi, canonicalProvider);
  const nft = new Contract(v2Contracts().loanNFT, LoanNftArtifact.abi, canonicalProvider);
  const [loan, accruedInterest, outstanding, lateFee, totalRepayment, state, certificatesByRole, installments, nextInstallment] = await Promise.all([
    manager.getLoan(loanId), manager.previewAccruedInterest(loanId), manager.previewOutstanding(loanId), manager.previewLateFee(loanId), manager.previewTotalRepayment(loanId), manager.previewLoanStatus(loanId), Promise.all([0, 1, 2].map(role => nft.loanCertificates(loanId, role))), emi.getSchedule(loanId), emi.nextInstallment(loanId),
  ]);
  // Risk/oracle failure must not hide a real settled loan or its vault balance.
  let risk: { ltvBps: string; healthFactor: string; liquidatable: boolean } | null = null;
  let riskError: string | null = null;
  try {
    const [ltvBps, healthFactor, liquidatable] = await Promise.all([liquid.currentLtvBps(loanId), liquid.healthFactor(loanId), liquid.isLiquidatable(loanId)]);
    risk = { ltvBps: ltvBps.toString(), healthFactor: healthFactor.toString(), liquidatable: Boolean(liquidatable) };
  } catch (error) { riskError = errorMessage(error); }
  const certificateRoles = ['Lender', 'Borrower', 'Platform'] as const;
  const certificates = (await Promise.all(certificatesByRole.map(async (certificate: bigint, index: number) => {
    if (certificate === 0n) return null;
    const [owner, uri, info] = await Promise.all([nft.ownerOf(certificate), nft.tokenURI(certificate), nft.getCertificate(certificate)]);
    return { tokenId: certificate.toString(), role: certificateRoles[index], owner, uri, hash: info.metadataHash, loanId, valuation: formatEther(info.certificateValue) };
  }))).filter((certificate): certificate is NonNullable<typeof certificate> => certificate !== null);
  const metadata = certificates.find(certificate => certificate.role === 'Borrower') ?? null;
  const vault = new Contract(v2Contracts().vault, VaultArtifact.abi, canonicalProvider);
  const liveCollateral = await vault.loanCollateral(loanId);
  const p2pSchedule = v2EmiSchedule(installments, nextInstallment);
  return {
    loan, aprBps: loan.aprBps.toString(), start: loan.start.toString(), isDirect: loan.lender.toLowerCase() === v2Contracts().pool.toLowerCase(), principal: formatEther(loan.principal), collateralETH: formatEther(liveCollateral), borrower: loan.borrower, lender: loan.lender, maturity: loan.maturity.toString(), marginCallAt: loan.marginCallAt.toString(), marginCallCureEnd: loan.marginCallCureEnd.toString(),
    accruedInterest: formatEther(accruedInterest), outstanding: formatEther(outstanding), lateFee: formatEther(lateFee), totalRepayment: formatEther(totalRepayment), state: Number(state), ltvBps: risk?.ltvBps ?? null, healthFactor: risk?.healthFactor ?? null, liquidatable: risk?.liquidatable ?? null, riskError, metadata, certificates, schedule: p2pSchedule,
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
  const token = new Contract(CONTRACTS.token, TokenArtifact.abi, canonicalProvider);
  // Use the deployed pool's own asset getters. This prevents a stale V1 token
  // configuration from ever selecting an oracle feed for a V2 dashboard read.
  const [ethAsset, abcdAsset] = await Promise.all([
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'ETH_ASSET' }, () => pool.ETH_ASSET()),
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'abcd' }, () => pool.abcd()),
  ]);
  const [poolLiquidity, poolTokenBalance, reserveBalance, initialLtvBps, marginCallThresholdBps, marginCallCureSeconds, aprBps, lateFeeBps, liquidationThresholdBps, closeFactorBps, liquidationBonusBps, ethUsd, abcdUsd] = await Promise.all([
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'liquidity' }, () => pool.liquidity()),
    readProtocol({ contract: 'ABCDToken', address: abcdAsset, functionName: 'balanceOf(LendingPoolV2)' }, () => token.balanceOf(contracts.pool)),
    readProtocol({ contract: 'InsuranceReserveV2', address: contracts.reserve, functionName: 'availableBalance' }, () => reserve.availableBalance()),
    readProtocol({ contract: 'LendingPoolV2', address: contracts.pool, functionName: 'MAX_INITIAL_LTV_BPS' }, () => pool.MAX_INITIAL_LTV_BPS()),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'MARGIN_CALL_THRESHOLD_BPS' }, () => liquid.MARGIN_CALL_THRESHOLD_BPS()),
    readProtocol({ contract: 'LoanManagerV2', address: contracts.manager, functionName: 'MARGIN_CALL_CURE_PERIOD' }, () => manager.MARGIN_CALL_CURE_PERIOD()),
    readProtocol({ contract: 'LoanManagerV2', address: contracts.manager, functionName: 'newLoanAprBps' }, () => manager.newLoanAprBps()),
    readProtocol({ contract: 'LoanManagerV2', address: contracts.manager, functionName: 'LATE_FEE_BPS' }, () => manager.LATE_FEE_BPS()),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'LIQUIDATION_THRESHOLD_BPS' }, () => liquid.LIQUIDATION_THRESHOLD_BPS()),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'CLOSE_FACTOR_BPS' }, () => liquid.CLOSE_FACTOR_BPS()),
    readProtocol({ contract: 'LiquidationV2', address: contracts.liquidation, functionName: 'LIQUIDATION_BONUS_BPS' }, () => liquid.LIQUIDATION_BONUS_BPS()),
    readProtocol({ contract: 'OracleAdapterV2', address: contracts.oracle, functionName: 'priceUSD(ETH_ASSET)' }, () => oracle.priceUSD(ethAsset)),
    readProtocol({ contract: 'OracleAdapterV2', address: contracts.oracle, functionName: 'priceUSD(ABCD)' }, () => oracle.priceUSD(abcdAsset)),
  ]);
  const config = getLendingV2Configuration();
  return {
    poolLiquidity: formatEther(poolLiquidity), poolTokenBalance: formatEther(poolTokenBalance), reserveBalance: formatEther(reserveBalance),
    initialLtvBps: initialLtvBps.toString(), marginCallThresholdBps: marginCallThresholdBps.toString(), marginCallCureSeconds: marginCallCureSeconds.toString(), aprBps: aprBps.toString(), lateFeeBps: lateFeeBps.toString(),
    liquidationThresholdBps: liquidationThresholdBps.toString(), closeFactorBps: closeFactorBps.toString(), liquidationBonusBps: liquidationBonusBps.toString(),
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
  return depositReceipt(() => pool.depositCollateral({ value, gasLimit: gas }), contracts.pool, borrower, value, progress);
}
export async function borrowV2(depositId: string, principal: string, termDays: number, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'borrowV2' });
  const amount = requireAmount(principal); requireId(depositId, 'Deposit ID');
  if (!terms.has(termDays * 86400)) throw new Error('Use a supported 30, 90, or 180 day term.'); await assertV2Write();
  const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.borrowABCD.estimateGas(depositId, amount, termDays * 86400); await assertGasBalance(signer, gas);
  return receipt('Borrow', () => pool.borrowABCD(depositId, amount, termDays * 86400, { gasLimit: gas }), new Interface(PoolArtifact.abi), [], progress);
}
export async function repayV2(loanId: string, amount: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'repayV2' });
  const value = requireAmount(amount); requireId(loanId, 'Loan ID'); await assertV2Write();
  const approval = await approveIfNeeded(v2Contracts().pool, value, progress); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.repay.estimateGas(loanId, value); await assertGasBalance(signer, gas);
  return receipt('Repayment', () => pool.repay(loanId, value, { gasLimit: gas }), new Interface(PoolArtifact.abi), approval ? [approval] : [], progress);
}
export async function repayAllV2(loanId: string, prepareCompletionMetadata: CompletionMetadataPreparer, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'repayAllV2' });
  requireId(loanId, 'Loan ID'); await assertV2Write(); const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  const [outstanding, loan, latestBlock] = await Promise.all([manager.previewOutstanding(loanId), manager.getLoan(loanId), canonicalProvider.getBlock('latest')]);
  if (!latestBlock) throw new Error('Unable to read the latest canonical block before repayment.');
  // Interest accrues every second. Approval and repayment are separate MetaMask
  // transactions. On localhost, the next mined block can also advance a stale
  // latest-block timestamp. Cover both cases with a capped buffer; the pool
  // still transfers exactly the then-current obligation.
  progress?.({ stage: 'preparing', action: 'prepareCompletionMetadata' });
  const completion = completionMetadataArgument(await prepareCompletionMetadata(loanId));
  const approvalAmount = repayAllApprovalAmount(outstanding, loan, BigInt(latestBlock.timestamp));
  const approval = await approveIfNeeded(v2Contracts().pool, approvalAmount, progress); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.repayAllWithCompletionMetadata.estimateGas(loanId, completion); await assertGasBalance(signer, gas);
  return receipt('Full repayment', () => pool.repayAllWithCompletionMetadata(loanId, completion, { gasLimit: gas }), new Interface(PoolArtifact.abi), approval ? [approval] : [], progress);
}
export async function withdrawV2Collateral(loanId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'withdrawV2Collateral' });
  requireId(loanId, 'Loan ID'); await assertV2Write(); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.withdrawSettledCollateral.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Collateral withdrawal', () => pool.withdrawSettledCollateral(loanId, { gasLimit: gas }), new Interface(PoolArtifact.abi), [], progress);
}
export async function addV2LoanCollateral(loanId: string, amount: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'addV2LoanCollateral' });
  requireId(loanId, 'Loan ID'); const value = requireAmount(amount); await assertV2Write();
  const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.addCollateralToLoan.estimateGas(loanId, { value }); await assertGasBalance(signer, gas, value);
  return receipt('Loan collateral top-up', () => pool.addCollateralToLoan(loanId, { value, gasLimit: gas }), new Interface(PoolArtifact.abi), [], progress);
}
export async function syncV2LoanRisk(loanId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'syncV2LoanRisk' });
  requireId(loanId, 'Loan ID'); await assertV2Write();
  const signer = await getSigner(); const liquidation = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, signer);
  const gas = await liquidation.syncRisk.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Risk-state synchronization', () => liquidation.syncRisk(loanId, { gasLimit: gas }), new Interface(LiquidationArtifact.abi), [], progress);
}
export async function createV2Request(principal: string, collateral: string, termDays: number, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'createV2Request' });
  const amount = requireAmount(principal); const value = requireAmount(collateral);
  if (!terms.has(termDays * 86400)) throw new Error('Use a supported 30, 90, or 180 day term.'); await assertV2Write();
  const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const maximum = await market.previewMaxP2PPrincipal(value);
  if (amount > maximum) throw new Error('Requested P2P principal exceeds the current on-chain 35% ETH LTV capacity.');
  const gas = await market.createRequest.estimateGas(amount, termDays * 86400, { value }); await assertGasBalance(signer, gas, value);
  return receipt('P2P request', () => market.createRequest(amount, termDays * 86400, { value, gasLimit: gas }), new Interface(MarketplaceArtifact.abi), [], progress);
}
export async function fundV2Request(requestId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'fundV2Request' });
  requireId(requestId, 'Request ID'); await assertV2Write(); const request = await getV2Request(requestId);
  if (request.state !== 0) throw new Error('This P2P request is not open for funding.');
  const approval = await approveIfNeeded(v2Contracts().marketplace, parseEther(request.principal), progress); const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const gas = await market.fundRequest.estimateGas(requestId); await assertGasBalance(signer, gas);
  return receipt('P2P funding', () => market.fundRequest(requestId, { gasLimit: gas }), new Interface(MarketplaceArtifact.abi), approval ? [approval] : [], progress);
}
export async function payV2Emi(loanId: string, prepareCompletionMetadata: CompletionMetadataPreparer, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'payV2Emi' });
  requireId(loanId, 'Loan ID'); await assertV2Write(); const emiRead = new Contract(v2Contracts().emi, EMIArtifact.abi, canonicalProvider);
  const [schedule, nextInstallment] = await Promise.all([emiRead.getSchedule(loanId), emiRead.nextInstallment(loanId)]);
  const installment = schedule[Number(nextInstallment)]; if (!installment) throw new Error('This EMI schedule is already settled.');
  const isTerminal = Number(nextInstallment) + 1 >= Number(schedule.length);
  const completion = isTerminal ? completionMetadataArgument(await prepareCompletionMetadata(loanId)) : null;
  const approval = await approveIfNeeded(v2Contracts().emi, installment.amount, progress); const signer = await getSigner(); const emi = new Contract(v2Contracts().emi, EMIArtifact.abi, signer);
  const gas = completion ? await emi.payInstallmentWithCompletionMetadata.estimateGas(loanId, completion) : await emi.payInstallment.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('EMI payment', () => completion ? emi.payInstallmentWithCompletionMetadata(loanId, completion, { gasLimit: gas }) : emi.payInstallment(loanId, { gasLimit: gas }), new Interface(EMIArtifact.abi), approval ? [approval] : [], progress);
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
  return receipt('Outstanding EMI repayment', () => completion ? emi.payOutstandingWithCompletionMetadata(loanId, value, completion, { gasLimit: gas }) : emi.payOutstanding(loanId, value, { gasLimit: gas }), new Interface(EMIArtifact.abi), approval ? [approval] : [], progress);
}
export async function liquidateV2(loanId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'liquidateV2' });
  requireId(loanId, 'Loan ID'); await assertV2Write(); const liquidRead = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, canonicalProvider);
  const quote = await liquidRead.previewLiquidation(loanId); const approval = await approveIfNeeded(v2Contracts().liquidation, quote[1], progress); const signer = await getSigner(); const liquid = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, signer);
  const gas = await liquid.liquidate.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Liquidation', () => liquid.liquidate(loanId, { gasLimit: gas }), new Interface(LiquidationArtifact.abi), approval ? [approval] : [], progress);
}
export async function settleV2Default(requestId: string, progress?: V2ProgressListener) {
  progress?.({ stage: 'preparing', action: 'settleV2Default' });
  requireId(requestId, 'Request ID'); await assertV2Write(); const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const gas = await market.settleDefault.estimateGas(requestId); await assertGasBalance(signer, gas);
  return receipt('P2P default settlement', () => market.settleDefault(requestId, { gasLimit: gas }), new Interface(MarketplaceArtifact.abi), [], progress);
}
export const metadataHashForUri = (uri: string) => id(uri.trim());
export { stateLabel };
