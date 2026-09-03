import { Contract, Interface, formatEther, id, parseEther } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, LENDING_V2_CONTRACTS, CONTRACTS, getLendingV2Configuration } from '../Config/contracts';
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
const terms = new Set([30 * 86400, 90 * 86400, 180 * 86400]);
const REPAY_ALL_ALLOWANCE_BUFFER_SECONDS = 600n;
const APR_DENOMINATOR = 10_000n * 365n * 86_400n;

export type V2Tx = { hash: string; blockNumber: string; loanId: string | null; requestId: string | null; depositId: string | null; approvalHashes: string[] };
export type V2Read = {
  loan: Record<string, unknown>; principal: string; collateralETH: string; borrower: string; lender: string; maturity: string;
  accruedInterest: string; outstanding: string; lateFee: string; totalRepayment: string; state: number; ltvBps: string; healthFactor: string; liquidatable: boolean;
  metadata: { tokenId: string; owner: string; uri: string; hash: string; loanId: string } | null;
  schedule: { installmentAmount: string; installmentCount: string; paidInstallments: string; nextDueAt: string; completed: boolean } | null;
};
export type V2PendingDeposit = { depositId: string; borrower: string; collateralETH: string; maxBorrowable: string; active: boolean };
export type V2Request = { requestId: string; borrower: string; lender: string; principal: string; collateralETH: string; termSeconds: string; state: number; loanId: string; metadataURI: string; metadataHash: string };
export type V2WalletHistory = { status: string; source?: { kind?: string }; directPositions: V2PendingDeposit[]; loans: Array<Record<string, unknown>>; requests: V2Request[]; events: Array<Record<string, unknown>> };
export type V2ProtocolState = {
  poolLiquidity: string; poolTokenBalance: string; reserveBalance: string;
  initialLtvBps: string; aprBps: string; lateFeeBps: string;
  liquidationThresholdBps: string; closeFactorBps: string; liquidationBonusBps: string;
  ethUsd: string; abcdUsd: string; supportedTermsDays: string[] | null; gracePeriodDays: string | null;
};

function errorMessage(error: unknown) {
  const info = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; data?: string; error?: { data?: string }; info?: { error?: { data?: string; message?: string } } };
  const message = info.shortMessage || info.reason || info.message || info.info?.error?.message || 'Lending V2 transaction failed.';
  if (info.code === 4001 || info.code === 'ACTION_REJECTED' || /rejected|denied/i.test(message)) return 'Transaction rejected in MetaMask. No on-chain state changed.';
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
function stateLabel(state: number) { return ['Active', 'Repaid', 'Grace period', 'Defaulted', 'Liquidated', 'Closed'][state] || `Unknown (${state})`; }
function v2Contracts() {
  if (!LENDING_V2_CONTRACTS) throw new Error('Lending V2 is not available on the current canonical deployment. Deploy the isolated lendingV2 namespace before using this feature.');
  return LENDING_V2_CONTRACTS;
}

async function assertV2Read() {
  if ((await canonicalProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Canonical RPC is not Hardhat Local (31337).');
  for (const [name, address] of Object.entries(v2Contracts())) if (await canonicalProvider.getCode(address) === '0x') throw new Error(`Lending V2 ${name} has no bytecode at its canonical manifest address.`);
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
async function receipt(action: string, send: () => Promise<any>, iface: Interface, approvalHashes: string[] = []): Promise<V2Tx> {
  await assertV2Write();
  const tx = await send();
  const mined = await tx.wait();
  if (!mined || mined.status !== 1) throw new Error(`${action} was not confirmed successfully.`);
  let loanId: string | null = null; let requestId: string | null = null; let depositId: string | null = null;
  for (const log of mined.logs) try {
    const event = iface.parseLog(log);
    if (event?.args.loanId !== undefined) loanId = event.args.loanId.toString();
    if (event?.args.requestId !== undefined) requestId = event.args.requestId.toString();
    if (event?.args.depositId !== undefined) depositId = event.args.depositId.toString();
  } catch { /* unrelated log */ }
  return { hash: tx.hash, blockNumber: String(mined.blockNumber), loanId, requestId, depositId, approvalHashes };
}
async function approveIfNeeded(spender: string, amount: bigint): Promise<string | null> {
  const signer = await getSigner();
  const owner = await signer.getAddress();
  const token = new Contract(CONTRACTS.token, TokenArtifact.abi, signer);
  if (await token.allowance(owner, spender) >= amount) return null;
  const gas = await token.approve.estimateGas(spender, amount);
  await assertGasBalance(signer, gas);
  const tx = await token.approve(spender, amount, { gasLimit: gas });
  const mined = await tx.wait();
  if (!mined || mined.status !== 1) throw new Error('ABCD approval was not confirmed successfully.');
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
  const [loan, accruedInterest, outstanding, lateFee, totalRepayment, state, ltvBps, healthFactor, liquidatable, certificate, installments, nextInstallment] = await Promise.all([
    manager.getLoan(loanId), manager.previewAccruedInterest(loanId), manager.previewOutstanding(loanId), manager.previewLateFee(loanId), manager.previewTotalRepayment(loanId), manager.previewLoanStatus(loanId), liquid.currentLtvBps(loanId), liquid.healthFactor(loanId), liquid.isLiquidatable(loanId), nft.loanCertificate(loanId), emi.getSchedule(loanId).catch(() => []), emi.nextInstallment(loanId).catch(() => 0n),
  ]);
  const metadata = certificate === 0n ? null : {
    tokenId: certificate.toString(), owner: await nft.ownerOf(certificate), uri: await nft.tokenURI(certificate), hash: (await nft.certificates(certificate)).metadataHash, loanId,
  };
  const currentInstallment = installments[Number(nextInstallment)];
  const p2pSchedule = installments.length ? { installmentAmount: currentInstallment ? formatEther(currentInstallment.amount) : '0.0', installmentCount: String(installments.length), paidInstallments: nextInstallment.toString(), nextDueAt: currentInstallment ? currentInstallment.dueAt.toString() : '0', completed: Number(nextInstallment) >= installments.length } : null;
  return {
    loan, principal: formatEther(loan.principal), collateralETH: formatEther(loan.collateralETH), borrower: loan.borrower, lender: loan.lender, maturity: loan.maturity.toString(),
    accruedInterest: formatEther(accruedInterest), outstanding: formatEther(outstanding), lateFee: formatEther(lateFee), totalRepayment: formatEther(totalRepayment), state: Number(state), ltvBps: ltvBps.toString(), healthFactor: healthFactor.toString(), liquidatable, metadata, schedule: p2pSchedule,
  };
}

export async function getV2PendingDeposit(depositId: string): Promise<V2PendingDeposit> {
  requireId(depositId, 'Deposit ID');
  await assertV2Read();
  const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, canonicalProvider);
  const vault = new Contract(v2Contracts().vault, VaultArtifact.abi, canonicalProvider);
  const [pending, collateral, maxBorrowable] = await Promise.all([pool.pendingCollateral(depositId), vault.directDepositCollateral(depositId), pool.maxBorrowable(depositId)]);
  return { depositId, borrower: pending.borrower, collateralETH: formatEther(collateral), maxBorrowable: formatEther(maxBorrowable), active: Boolean(pending.active) };
}
export async function getV2Request(requestId: string): Promise<V2Request> {
  requireId(requestId, 'Request ID');
  await assertV2Read();
  const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, canonicalProvider);
  const request = await market.requests(requestId);
  return { requestId, borrower: request.borrower, lender: request.lender, principal: formatEther(request.principal), collateralETH: formatEther(request.collateral), termSeconds: request.term.toString(), state: Number(request.state), loanId: request.loanId.toString(), metadataURI: request.metadataURI, metadataHash: request.metadataHash };
}
export async function getV2WalletHistory(wallet: string): Promise<V2WalletHistory> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) throw new Error('Connected wallet address is invalid.');
  const response = await apiGet<{ status: string; source?: { kind?: string }; data: Omit<V2WalletHistory, 'status' | 'source'> }>(`/api/lending-v2/wallet/${wallet}?limit=100`);
  return { status: response.status, source: response.source, ...response.data };
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
  const [poolLiquidity, poolTokenBalance, reserveBalance, initialLtvBps, aprBps, lateFeeBps, liquidationThresholdBps, closeFactorBps, liquidationBonusBps, ethUsd, abcdUsd] = await Promise.all([
    pool.liquidity(), token.balanceOf(contracts.pool), reserve.availableBalance(), pool.MAX_INITIAL_LTV_BPS(), pool.FIXED_APR_BPS(), manager.LATE_FEE_BPS(),
    liquid.LIQUIDATION_THRESHOLD_BPS(), liquid.CLOSE_FACTOR_BPS(), liquid.LIQUIDATION_BONUS_BPS(),
    oracle.priceUSD('0x0000000000000000000000000000000000000001'), oracle.priceUSD(CONTRACTS.token),
  ]);
  const config = getLendingV2Configuration();
  return {
    poolLiquidity: formatEther(poolLiquidity), poolTokenBalance: formatEther(poolTokenBalance), reserveBalance: formatEther(reserveBalance),
    initialLtvBps: initialLtvBps.toString(), aprBps: aprBps.toString(), lateFeeBps: lateFeeBps.toString(),
    liquidationThresholdBps: liquidationThresholdBps.toString(), closeFactorBps: closeFactorBps.toString(), liquidationBonusBps: liquidationBonusBps.toString(),
    ethUsd: formatEther(ethUsd), abcdUsd: formatEther(abcdUsd),
    supportedTermsDays: config?.supportedTermSeconds?.map((seconds) => String(seconds / 86_400)) ?? null,
    gracePeriodDays: config?.gracePeriodSeconds === undefined ? null : String(config.gracePeriodSeconds / 86_400),
  };
}

export async function depositV2Collateral(amount: string) {
  const value = requireAmount(amount); await assertV2Write();
  const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.depositCollateral.estimateGas({ value }); await assertGasBalance(signer, gas, value);
  return receipt('Collateral deposit', () => pool.depositCollateral({ value, gasLimit: gas }), new Interface(PoolArtifact.abi));
}
export async function borrowV2(depositId: string, principal: string, termDays: number, uri: string, hash: string) {
  const amount = requireAmount(principal); requireId(depositId, 'Deposit ID');
  if (!terms.has(termDays * 86400)) throw new Error('Use a supported 30, 90, or 180 day term.'); requireMetadata(uri, hash); await assertV2Write();
  const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.borrowABCD.estimateGas(depositId, amount, termDays * 86400, uri.trim(), hash); await assertGasBalance(signer, gas);
  return receipt('Borrow', () => pool.borrowABCD(depositId, amount, termDays * 86400, uri.trim(), hash, { gasLimit: gas }), new Interface(PoolArtifact.abi));
}
export async function repayV2(loanId: string, amount: string) {
  const value = requireAmount(amount); requireId(loanId, 'Loan ID'); await assertV2Write();
  const approval = await approveIfNeeded(v2Contracts().pool, value); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.repay.estimateGas(loanId, value); await assertGasBalance(signer, gas);
  return receipt('Repayment', () => pool.repay(loanId, value, { gasLimit: gas }), new Interface(PoolArtifact.abi), approval ? [approval] : []);
}
export async function repayAllV2(loanId: string) {
  requireId(loanId, 'Loan ID'); await assertV2Write(); const manager = new Contract(v2Contracts().manager, ManagerArtifact.abi, canonicalProvider);
  const [outstanding, loan] = await Promise.all([manager.previewOutstanding(loanId), manager.getLoan(loanId)]);
  // Interest accrues every second. Approval and repayment are separate MetaMask
  // transactions, so approving the exact preview can be one wei short by the
  // time repayAll is mined. This grants only a bounded ten-minute allowance
  // buffer; the contract still transfers exactly the then-current obligation.
  const approvalAmount = outstanding + (loan.principalOutstanding * 1_200n * REPAY_ALL_ALLOWANCE_BUFFER_SECONDS / APR_DENOMINATOR) + 1n;
  const approval = await approveIfNeeded(v2Contracts().pool, approvalAmount); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.repayAll.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Full repayment', () => pool.repayAll(loanId, { gasLimit: gas }), new Interface(PoolArtifact.abi), approval ? [approval] : []);
}
export async function withdrawV2Collateral(loanId: string) {
  requireId(loanId, 'Loan ID'); await assertV2Write(); const signer = await getSigner(); const pool = new Contract(v2Contracts().pool, PoolArtifact.abi, signer);
  const gas = await pool.withdrawSettledCollateral.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Collateral withdrawal', () => pool.withdrawSettledCollateral(loanId, { gasLimit: gas }), new Interface(PoolArtifact.abi));
}
export async function createV2Request(principal: string, collateral: string, termDays: number, uri: string, hash: string) {
  const amount = requireAmount(principal); const value = requireAmount(collateral);
  if (!terms.has(termDays * 86400)) throw new Error('Use a supported 30, 90, or 180 day term.'); requireMetadata(uri, hash); await assertV2Write();
  const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const gas = await market.createRequest.estimateGas(amount, termDays * 86400, uri.trim(), hash, { value }); await assertGasBalance(signer, gas, value);
  return receipt('P2P request', () => market.createRequest(amount, termDays * 86400, uri.trim(), hash, { value, gasLimit: gas }), new Interface(MarketplaceArtifact.abi));
}
export async function fundV2Request(requestId: string) {
  requireId(requestId, 'Request ID'); await assertV2Write(); const request = await getV2Request(requestId);
  if (request.state !== 0) throw new Error('This P2P request is not open for funding.');
  const approval = await approveIfNeeded(v2Contracts().marketplace, parseEther(request.principal)); const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const gas = await market.fundRequest.estimateGas(requestId); await assertGasBalance(signer, gas);
  return receipt('P2P funding', () => market.fundRequest(requestId, { gasLimit: gas }), new Interface(MarketplaceArtifact.abi), approval ? [approval] : []);
}
export async function payV2Emi(loanId: string) {
  requireId(loanId, 'Loan ID'); await assertV2Write(); const emiRead = new Contract(v2Contracts().emi, EMIArtifact.abi, canonicalProvider);
  const [schedule, nextInstallment] = await Promise.all([emiRead.getSchedule(loanId), emiRead.nextInstallment(loanId)]);
  const installment = schedule[Number(nextInstallment)]; if (!installment) throw new Error('This EMI schedule is already settled.');
  const approval = await approveIfNeeded(v2Contracts().emi, installment.amount); const signer = await getSigner(); const emi = new Contract(v2Contracts().emi, EMIArtifact.abi, signer);
  const gas = await emi.payInstallment.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('EMI payment', () => emi.payInstallment(loanId, { gasLimit: gas }), new Interface(EMIArtifact.abi), approval ? [approval] : []);
}
export async function payV2OutstandingEmi(loanId: string, amount: string) {
  const value = requireAmount(amount); requireId(loanId, 'Loan ID'); await assertV2Write();
  const approval = await approveIfNeeded(v2Contracts().emi, value); const signer = await getSigner(); const emi = new Contract(v2Contracts().emi, EMIArtifact.abi, signer);
  const gas = await emi.payOutstanding.estimateGas(loanId, value); await assertGasBalance(signer, gas);
  return receipt('Outstanding EMI repayment', () => emi.payOutstanding(loanId, value, { gasLimit: gas }), new Interface(EMIArtifact.abi), approval ? [approval] : []);
}
export async function liquidateV2(loanId: string) {
  requireId(loanId, 'Loan ID'); await assertV2Write(); const liquidRead = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, canonicalProvider);
  const quote = await liquidRead.previewLiquidation(loanId); const approval = await approveIfNeeded(v2Contracts().liquidation, quote[1]); const signer = await getSigner(); const liquid = new Contract(v2Contracts().liquidation, LiquidationArtifact.abi, signer);
  const gas = await liquid.liquidate.estimateGas(loanId); await assertGasBalance(signer, gas);
  return receipt('Liquidation', () => liquid.liquidate(loanId, { gasLimit: gas }), new Interface(LiquidationArtifact.abi), approval ? [approval] : []);
}
export async function settleV2Default(requestId: string) {
  requireId(requestId, 'Request ID'); await assertV2Write(); const signer = await getSigner(); const market = new Contract(v2Contracts().marketplace, MarketplaceArtifact.abi, signer);
  const gas = await market.settleDefault.estimateGas(requestId); await assertGasBalance(signer, gas);
  return receipt('P2P default settlement', () => market.settleDefault(requestId, { gasLimit: gas }), new Interface(MarketplaceArtifact.abi));
}
export const metadataHashForUri = (uri: string) => id(uri.trim());
export { stateLabel };
