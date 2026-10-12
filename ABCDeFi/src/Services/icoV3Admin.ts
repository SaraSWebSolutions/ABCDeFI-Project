import { Contract, isAddress } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, ICO_V3_CONTRACT } from '../Config/contracts';
import { CANONICAL_DEPLOYMENT_IDENTITY } from '../Config/canonicalDeploymentContext';
import { assertCanonicalContractDeployment } from './contractProvider';
import { checkNetwork, getSigner } from './wallet';
import { createCanonicalAdminAudit, requireAdminWriteCapability, updateCanonicalAdminAudit, type AdminAuditAction, type AdminOperationState, type AdminWalletCapability } from './canonicalAdmin';

export type IcoV3AdminAction = Exclude<AdminAuditAction, 'pause' | 'unpause'> | 'pause' | 'unpause';
export type IcoV3AdminInput = { wallet?: string; allowed?: boolean; address?: string; timestamp?: string };
export type IcoV3AdminResult = { state: AdminOperationState; transactionHash?: string; blockNumber?: number; detail?: string };

const ABI = [
  'function paused() view returns (bool)', 'function lifecycle() view returns (uint8)', 'function tgeTimestamp() view returns (uint256)', 'function stage(uint8) view returns (uint256 startTime,uint256 endTime,uint256 inventory,uint256 sold,uint256 priceUsdWad)',
  'function hasRole(bytes32,address) view returns (bool)', 'function ICO_ADMIN_ROLE() view returns (bytes32)', 'function PAUSER_ROLE() view returns (bytes32)', 'function ORACLE_ADMIN_ROLE() view returns (bytes32)', 'function ELIGIBILITY_ADMIN_ROLE() view returns (bytes32)', 'function CUSTODY_ADMIN_ROLE() view returns (bytes32)',
  'function setEligibility(address,bool)', 'function pause()', 'function unpause()', 'function setOracle(address)', 'function setProceedsRecipient(address)', 'function configureTge(uint256)', 'function finalize()', 'function cancel()', 'function withdrawProceeds()',
  'event EligibilityUpdated(address indexed wallet,bool eligible)', 'event Paused(address account)', 'event Unpaused(address account)', 'event OracleReplaced(address indexed previousFeed,address indexed nextFeed,uint8 decimals,uint256 maxPriceAge)', 'event ProceedsRecipientConfigured(address indexed previousRecipient,address indexed nextRecipient)', 'event TgeConfigured(uint256 indexed tgeTimestamp,address indexed configuredBy)', 'event IcoFinalized(uint256 indexed tgeTimestamp,uint256 unsoldReturned)', 'event IcoCancelled(address indexed admin)', 'event ProceedsWithdrawn(address indexed recipient,uint256 amount,uint256 totalWithdrawn)',
] as const;
const roleByAction: Record<IcoV3AdminAction, string> = { setEligibility: 'ELIGIBILITY_ADMIN_ROLE', pause: 'PAUSER_ROLE', unpause: 'PAUSER_ROLE', setOracle: 'ORACLE_ADMIN_ROLE', setProceedsRecipient: 'CUSTODY_ADMIN_ROLE', configureTge: 'ICO_ADMIN_ROLE', finalize: 'ICO_ADMIN_ROLE', cancel: 'ICO_ADMIN_ROLE', withdrawProceeds: 'CUSTODY_ADMIN_ROLE' };
const eventByAction: Record<IcoV3AdminAction, string> = { setEligibility: 'EligibilityUpdated', pause: 'Paused', unpause: 'Unpaused', setOracle: 'OracleReplaced', setProceedsRecipient: 'ProceedsRecipientConfigured', configureTge: 'TgeConfigured', finalize: 'IcoFinalized', cancel: 'IcoCancelled', withdrawProceeds: 'ProceedsWithdrawn' };
const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
export const icoV3RequiredRole = (action: IcoV3AdminAction) => roleByAction[action];

async function status() {
  const response = await fetch('/api/ico-v3/status'); const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status !== 'AVAILABLE') throw new Error(body.reason || 'Canonical ICO V3 API is unavailable.');
  if (body.manifest?.chainId !== Number(DEPLOYMENT_CHAIN_ID) || body.manifest?.deploymentIdentity !== CANONICAL_DEPLOYMENT_IDENTITY.unified || String(body.manifest?.address).toLowerCase() !== ICO_V3_CONTRACT.toLowerCase()) throw new Error('ICO V3 deployment identity does not match the selected canonical runtime.');
  return body;
}
function inputAddress(value: string | undefined, label: string) { if (!value || !isAddress(value)) throw new Error(`${label} must be a valid address.`); return value; }
function fail(error: unknown): IcoV3AdminResult { const value = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string }; const detail = value.shortMessage || value.reason || value.message || 'ICO V3 Admin operation failed.'; return { state: value.code === 4001 || value.code === 'ACTION_REJECTED' ? 'REVERTED' : 'FAILED', detail }; }
async function indexed(hash: string, block: number, eventName: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { const [s, h] = await Promise.all([fetch('/api/ico-v3/status'), fetch('/api/ico-v3/history')]); const statusBody = await s.json(); const history = await h.json(); if (statusBody.status === 'AVAILABLE' && statusBody.manifest?.deploymentIdentity === CANONICAL_DEPLOYMENT_IDENTITY.unified && BigInt(statusBody.checkpoint?.lastProcessedBlock || '-1') >= BigInt(block) && Array.isArray(history?.data?.events) && history.data.events.some((event: any) => String(event.transactionHash).toLowerCase() === hash.toLowerCase() && event.eventName === eventName)) return true; } catch { /* bounded fail-closed wait */ }
    await delay(1_000);
  }
  return false;
}
function eventObserved(contract: Contract, receipt: any, eventName: string) { return receipt.logs.some((log: any) => { if (String(log.address).toLowerCase() !== ICO_V3_CONTRACT.toLowerCase()) return false; try { return contract.interface.parseLog(log)?.name === eventName; } catch { return false; } }); }
async function preflight(action: IcoV3AdminAction, input: IcoV3AdminInput) {
  await status(); await assertCanonicalContractDeployment('ICOManagerV3', ICO_V3_CONTRACT);
  const network = await checkNetwork(); if (!network.isCorrect) throw new Error(`Switch the connected wallet to canonical chain ${DEPLOYMENT_CHAIN_ID.toString()}.`);
  const signer = await getSigner(); const wallet = await signer.getAddress(); const contract = new Contract(ICO_V3_CONTRACT, ABI, signer);
  const [paused, lifecycle, tge, stageTwo] = await Promise.all([contract.paused(), contract.lifecycle(), contract.tgeTimestamp(), contract.stage(1)]);
  const requiredRole = roleByAction[action]; if (!await contract.hasRole(await contract[requiredRole](), wallet)) throw new Error(`The connected wallet does not hold ${requiredRole} on canonical ICOManagerV3.`);
  if ((action === 'setOracle' || action === 'setProceedsRecipient') && !paused) throw new Error(`${action} is permitted only while ICO V3 is paused.`);
  if ((action === 'setEligibility' || action === 'configureTge' || action === 'finalize' || action === 'cancel' || action === 'withdrawProceeds') && paused) throw new Error(`${action} is unavailable while ICO V3 is paused.`);
  if (action === 'setEligibility') inputAddress(input.wallet, 'Eligibility wallet');
  if (action === 'setOracle') inputAddress(input.address, 'Oracle feed');
  if (action === 'setProceedsRecipient') inputAddress(input.address, 'Proceeds recipient');
  if (action === 'configureTge') { const next = BigInt(input.timestamp || ''); if (next < stageTwo.endTime || tge !== 0n || lifecycle === 2n || lifecycle === 3n) throw new Error('TGE must be configured once, no earlier than Stage 2 end, before a terminal lifecycle state.'); }
  if (action === 'finalize') { const latest = await signer.provider!.getBlock('latest'); if (!latest || BigInt(latest.timestamp) < stageTwo.endTime || tge === 0n || tge > BigInt(latest.timestamp) || lifecycle === 2n || lifecycle === 3n) throw new Error('Finalization requires an ended Stage 2, an effective configured TGE, and a nonterminal lifecycle.'); }
  if (action === 'cancel') { const latest = await signer.provider!.getBlock('latest'); if (!latest || lifecycle === 2n || lifecycle === 3n || (tge !== 0n && BigInt(latest.timestamp) >= tge)) throw new Error('Cancellation is permitted only before TGE and before a terminal lifecycle state.'); }
  return { contract, paused };
}
function invoke(contract: Contract, action: IcoV3AdminAction, input: IcoV3AdminInput) {
  if (action === 'setEligibility') return contract.setEligibility(inputAddress(input.wallet, 'Eligibility wallet'), Boolean(input.allowed));
  if (action === 'setOracle') return contract.setOracle(inputAddress(input.address, 'Oracle feed'));
  if (action === 'setProceedsRecipient') return contract.setProceedsRecipient(inputAddress(input.address, 'Proceeds recipient'));
  if (action === 'configureTge') return contract.configureTge(BigInt(input.timestamp || ''));
  return contract[action]();
}
export async function executeIcoV3AdminAction(token: string, action: IcoV3AdminAction, input: IcoV3AdminInput, capability: AdminWalletCapability | null | undefined, onState?: (state: AdminOperationState, detail?: string) => void): Promise<IcoV3AdminResult> {
  let audit: any = null; let terminal = false;
  try {
    try { requireAdminWriteCapability(capability); }
    catch (error) { const detail = error instanceof Error ? error.message : 'Admin write capability is unavailable.'; onState?.('UNAVAILABLE', detail); return { state: 'UNAVAILABLE', detail }; }
    const { contract } = await preflight(action, input);
    // A missing role or another deterministic preflight failure cannot create
    // a PENDING audit record or suggest that a wallet transaction was started.
    onState?.('PENDING', 'Wallet, role, runtime, bytecode, and lifecycle preflight passed. Waiting for wallet confirmation.');
    const transaction = await invoke(contract, action, input);
    onState?.('SUBMITTED', transaction.hash); audit = await createCanonicalAdminAudit(token, 'ICO V3', action, transaction.hash);
    const receipt = await transaction.wait();
    if (!receipt || Number(receipt.status) !== 1) { terminal = true; await updateCanonicalAdminAudit(token, audit._id, 'REVERTED', { transactionHash: transaction.hash, detail: 'Receipt did not report success.' }); onState?.('REVERTED', 'The transaction receipt did not report success.'); return { state: 'REVERTED', transactionHash: transaction.hash }; }
    const observed = eventObserved(contract, receipt, eventByAction[action]);
    if (!observed) { terminal = true; await updateCanonicalAdminAudit(token, audit._id, 'FAILED', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: false, detail: 'Expected canonical ICO V3 event was absent.' }); onState?.('FAILED', 'Expected canonical event was absent.'); return { state: 'FAILED', transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber) }; }
    const confirmed = await indexed(transaction.hash, Number(receipt.blockNumber), eventByAction[action]);
    if (!confirmed) { terminal = true; await updateCanonicalAdminAudit(token, audit._id, 'STALE', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: true, indexerObserved: false, detail: 'ICO V3 indexer/API did not reconcile within the bounded wait.' }); onState?.('STALE', 'Confirmed on-chain; canonical ICO V3 projection is still behind.'); return { state: 'STALE', transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber) }; }
    terminal = true; await updateCanonicalAdminAudit(token, audit._id, 'CONFIRMED', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: true, indexerObserved: true }); onState?.('CONFIRMED', transaction.hash); return { state: 'CONFIRMED', transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber) };
  } catch (error) { const result = fail(error); if (audit && !terminal) try { await updateCanonicalAdminAudit(token, audit._id, result.state, { detail: result.detail }); } catch { /* audit failure must not fabricate success */ } onState?.(result.state, result.detail); return result; }
}
