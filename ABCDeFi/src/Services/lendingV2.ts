import { Contract, Interface, formatEther, id, parseEther } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, LENDING_V2_CONTRACTS, CONTRACTS } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getProvider, getSigner } from './wallet';
import PoolArtifact from '../../artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json';
import ManagerArtifact from '../../artifacts/contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json';
import MarketplaceArtifact from '../../artifacts/contracts/lending/v2/LoanMarketplaceV2.sol/LoanMarketplaceV2.json';
import EMIArtifact from '../../artifacts/contracts/lending/v2/EMIManagerV2.sol/EMIManagerV2.json';
import LiquidationArtifact from '../../artifacts/contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json';
import LoanNftArtifact from '../../artifacts/contracts/nft/LoanNFTV2.sol/LoanNFTV2.json';
import TokenArtifact from '../../artifacts/contracts/token/ABCDToken.sol/ABCDToken.json';

const interfaces = [new Interface(PoolArtifact.abi), new Interface(ManagerArtifact.abi), new Interface(MarketplaceArtifact.abi), new Interface(EMIArtifact.abi), new Interface(LiquidationArtifact.abi), new Interface(TokenArtifact.abi)];
const terms = new Set([30 * 86400, 90 * 86400, 180 * 86400]);
export type V2Tx = { hash: string; blockNumber: string; loanId: string | null; requestId: string | null; depositId: string | null };
export type V2Read = { loan: Record<string, unknown>; accruedInterest: string; outstanding: string; lateFee: string; totalRepayment: string; state: number; ltvBps: string; healthFactor: string; liquidatable: boolean; metadata: { tokenId: string; owner: string; uri: string; hash: string } | null };

function errorMessage(error: unknown) {
  const info = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; data?: string; error?: { data?: string }; info?: { error?: { data?: string; message?: string } } };
  const message = info.shortMessage || info.reason || info.message || info.info?.error?.message || 'Lending V2 transaction failed.';
  if (info.code === 4001 || info.code === 'ACTION_REJECTED' || /rejected|denied/i.test(message)) return 'Transaction rejected in MetaMask. No on-chain state changed.';
  if (/insufficient funds/i.test(message)) return 'Insufficient ETH to pay network gas.';
  const data = info.data || info.error?.data || info.info?.error?.data;
  if (data) for (const iface of interfaces) try { const decoded = iface.parseError(data); if (decoded) return `Contract reverted: ${decoded.name}.`; } catch { /* next ABI */ }
  return message;
}
export const lendingV2ErrorMessage = errorMessage;
function requireAmount(value: string) { if (!/^\d+(\.\d+)?$/.test(value) || parseEther(value) <= 0n) throw new Error('Amount must be greater than zero.'); return parseEther(value); }
function requireMetadata(uri: string, hash: string) { if (!/^(ipfs:\/\/|https?:\/\/).+/.test(uri.trim())) throw new Error('A valid ipfs:// or https:// metadata URI is required.'); if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error('Metadata hash must be a 32-byte hexadecimal value.'); }
async function assertV2Read() {
  if ((await canonicalProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Canonical RPC is not Hardhat Local (31337).');
  for (const [name, address] of Object.entries(LENDING_V2_CONTRACTS)) if (await canonicalProvider.getCode(address) === '0x') throw new Error(`Lending V2 ${name} has no bytecode at its canonical manifest address.`);
}
async function assertV2Write() {
  await assertV2Read();
  const walletProvider = await getProvider(); if ((await walletProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Switch MetaMask to Hardhat Local (31337).');
}
async function receipt(action: string, send: () => Promise<any>, iface: Interface): Promise<V2Tx> {
  await assertV2Write(); const tx = await send(); const mined = await tx.wait(); if (!mined || mined.status !== 1) throw new Error(`${action} was not confirmed successfully.`);
  let loanId: string | null = null; let requestId: string | null = null; let depositId: string | null = null;
  for (const log of mined.logs) try { const event = iface.parseLog(log); if (event?.args.loanId !== undefined) loanId = event.args.loanId.toString(); if (event?.args.requestId !== undefined) requestId = event.args.requestId.toString(); if (event?.args.depositId !== undefined) depositId = event.args.depositId.toString(); } catch { /* unrelated log */ }
  return { hash: tx.hash, blockNumber: String(mined.blockNumber), loanId, requestId, depositId };
}
async function signerContract(address: string, abi: any) { return new Contract(address, abi, await getSigner()); }
async function approveIfNeeded(spender: string, amount: bigint) {
  const signer = await getSigner(); const owner = await signer.getAddress(); const token = new Contract(CONTRACTS.token, TokenArtifact.abi, signer);
  if (await token.allowance(owner, spender) >= amount) return;
  const gas = await token.approve.estimateGas(spender, amount); const tx = await token.approve(spender, amount, { gasLimit: gas }); const mined = await tx.wait(); if (!mined || mined.status !== 1) throw new Error('ABCD approval was not confirmed successfully.');
}
export async function getV2Loan(loanId: string): Promise<V2Read> {
  if (!/^\d+$/.test(loanId) || BigInt(loanId) === 0n) throw new Error('Loan ID must be a positive integer.'); await assertV2Read();
  const manager = new Contract(LENDING_V2_CONTRACTS.manager, ManagerArtifact.abi, canonicalProvider); const liquid = new Contract(LENDING_V2_CONTRACTS.liquidation, LiquidationArtifact.abi, canonicalProvider); const nft = new Contract(LENDING_V2_CONTRACTS.loanNFT, LoanNftArtifact.abi, canonicalProvider);
  const [loan, accruedInterest, outstanding, lateFee, totalRepayment, state, ltvBps, healthFactor, liquidatable, certificate] = await Promise.all([manager.getLoan(loanId), manager.previewAccruedInterest(loanId), manager.previewOutstanding(loanId), manager.previewLateFee(loanId), manager.previewTotalRepayment(loanId), manager.previewLoanStatus(loanId), liquid.currentLtvBps(loanId), liquid.healthFactor(loanId), liquid.isLiquidatable(loanId), nft.loanCertificate(loanId)]);
  const metadata = certificate[0] === 0n ? null : { tokenId: certificate[0].toString(), owner: await nft.ownerOf(certificate[0]), uri: await nft.tokenURI(certificate[0]), hash: (await nft.certificates(certificate[0])).metadataHash };
  return { loan, accruedInterest: formatEther(accruedInterest), outstanding: formatEther(outstanding), lateFee: formatEther(lateFee), totalRepayment: formatEther(totalRepayment), state: Number(state), ltvBps: ltvBps.toString(), healthFactor: healthFactor.toString(), liquidatable, metadata };
}
export async function depositV2Collateral(amount: string) { const value = requireAmount(amount); await assertV2Write(); const pool = await signerContract(LENDING_V2_CONTRACTS.pool, PoolArtifact.abi); const gas = await pool.depositCollateral.estimateGas({ value }); return receipt('Collateral deposit', () => pool.depositCollateral({ value, gasLimit: gas }), new Interface(PoolArtifact.abi)); }
export async function borrowV2(depositId: string, principal: string, termDays: number, uri: string, hash: string) { const amount = requireAmount(principal); if (!/^\d+$/.test(depositId) || !terms.has(termDays * 86400)) throw new Error('Use a pending deposit ID and a supported 30, 90, or 180 day term.'); requireMetadata(uri, hash); await assertV2Write(); const pool = await signerContract(LENDING_V2_CONTRACTS.pool, PoolArtifact.abi); const gas = await pool.borrowABCD.estimateGas(depositId, amount, termDays * 86400, uri.trim(), hash); return receipt('Borrow', () => pool.borrowABCD(depositId, amount, termDays * 86400, uri.trim(), hash, { gasLimit: gas }), new Interface(PoolArtifact.abi)); }
export async function repayV2(loanId: string, amount: string) { const value = requireAmount(amount); await assertV2Write(); await approveIfNeeded(LENDING_V2_CONTRACTS.pool, value); const pool = await signerContract(LENDING_V2_CONTRACTS.pool, PoolArtifact.abi); const gas = await pool.repay.estimateGas(loanId, value); return receipt('Repayment', () => pool.repay(loanId, value, { gasLimit: gas }), new Interface(PoolArtifact.abi)); }
export async function repayAllV2(loanId: string) { await assertV2Write(); const manager = new Contract(LENDING_V2_CONTRACTS.manager, ManagerArtifact.abi, canonicalProvider); await approveIfNeeded(LENDING_V2_CONTRACTS.pool, await manager.previewOutstanding(loanId)); const pool = await signerContract(LENDING_V2_CONTRACTS.pool, PoolArtifact.abi); const gas = await pool.repayAll.estimateGas(loanId); return receipt('Full repayment', () => pool.repayAll(loanId, { gasLimit: gas }), new Interface(PoolArtifact.abi)); }
export async function withdrawV2Collateral(loanId: string) { await assertV2Write(); const pool = await signerContract(LENDING_V2_CONTRACTS.pool, PoolArtifact.abi); const gas = await pool.withdrawSettledCollateral.estimateGas(loanId); return receipt('Collateral withdrawal', () => pool.withdrawSettledCollateral(loanId, { gasLimit: gas }), new Interface(PoolArtifact.abi)); }
export async function createV2Request(principal: string, collateral: string, termDays: number, uri: string, hash: string) { const amount = requireAmount(principal); const value = requireAmount(collateral); if (!terms.has(termDays * 86400)) throw new Error('Use a supported 30, 90, or 180 day term.'); requireMetadata(uri, hash); await assertV2Write(); const market = await signerContract(LENDING_V2_CONTRACTS.marketplace, MarketplaceArtifact.abi); const gas = await market.createRequest.estimateGas(amount, termDays * 86400, uri.trim(), hash, { value }); return receipt('P2P request', () => market.createRequest(amount, termDays * 86400, uri.trim(), hash, { value, gasLimit: gas }), new Interface(MarketplaceArtifact.abi)); }
export async function fundV2Request(requestId: string, principal: string) { const value = requireAmount(principal); await assertV2Write(); await approveIfNeeded(LENDING_V2_CONTRACTS.marketplace, value); const market = await signerContract(LENDING_V2_CONTRACTS.marketplace, MarketplaceArtifact.abi); const gas = await market.fundRequest.estimateGas(requestId); return receipt('P2P funding', () => market.fundRequest(requestId, { gasLimit: gas }), new Interface(MarketplaceArtifact.abi)); }
export async function payV2Emi(loanId: string, amount: string, all = false) { const value = requireAmount(amount); await assertV2Write(); await approveIfNeeded(LENDING_V2_CONTRACTS.emi, value); const emi = await signerContract(LENDING_V2_CONTRACTS.emi, EMIArtifact.abi); if (all) { const gas = await emi.payOutstanding.estimateGas(loanId, value); return receipt('Outstanding EMI repayment', () => emi.payOutstanding(loanId, value, { gasLimit: gas }), new Interface(EMIArtifact.abi)); } const gas = await emi.payInstallment.estimateGas(loanId); return receipt('EMI payment', () => emi.payInstallment(loanId, { gasLimit: gas }), new Interface(EMIArtifact.abi)); }
export async function liquidateV2(loanId: string) { await assertV2Write(); const liquid = new Contract(LENDING_V2_CONTRACTS.liquidation, LiquidationArtifact.abi, canonicalProvider); const quote = await liquid.previewLiquidation(loanId); await approveIfNeeded(LENDING_V2_CONTRACTS.liquidation, quote[1]); const signerLiquid = await signerContract(LENDING_V2_CONTRACTS.liquidation, LiquidationArtifact.abi); const gas = await signerLiquid.liquidate.estimateGas(loanId); return receipt('Liquidation', () => signerLiquid.liquidate(loanId, { gasLimit: gas }), new Interface(LiquidationArtifact.abi)); }
export const metadataHashForUri = (uri: string) => id(uri.trim());
