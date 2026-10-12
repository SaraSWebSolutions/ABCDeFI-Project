import { Contract, type Log } from 'ethers';
import LegionNFTV2Artifact from '../../artifacts/contracts/nft/LegionNFTV2.sol/LegionNFTV2.json';
import { ONE_Q_RUNTIME_CHAIN_ID, ONE_Q_RUNTIME_FAMILY, ONE_Q_RUNTIME_RPC_URL, oneQRuntime, requireOneQContractAddress } from '../Config/oneQRuntime';
import { checkNetwork, getProvider, getSigner } from './wallet';
import { createCanonicalAdminAudit, requireAdminWriteCapability, type AdminAuditAction, type AdminAuditRecord, type AdminOperationState, type AdminWalletCapability, updateCanonicalAdminAudit } from './canonicalAdmin';
import { getLegionNFTV2Availability, getLegionNFTV2History, getLegionNFTV2Territory, getLegionNFTV2TransferRequest, type LegionNFTV2Availability } from './legionNFTV2';
import { validateCanonicalLegionSource, type CanonicalLegionRuntime } from '../Utils/legionCanonicalSource';

export type LegionAdminAction = 'updateMetadata' | 'approveTransfer' | 'invalidateTransfer' | 'pause' | 'unpause';
export type LegionAdminParams = { tokenId?: string; requestId?: string; displayName?: string; population?: string; metadataURI?: string };
export type LegionAdminWriteResult = { state: AdminOperationState; transactionHash: string; blockNumber: number; eventObserved: boolean; indexerObserved: boolean; auditId: string };

const LEGION_ADMIN_ROLE = 'LEGION_ADMIN_ROLE';
const PAUSER_ROLE = 'PAUSER_ROLE';
const expectedEvent: Record<LegionAdminAction, string> = {
  updateMetadata: 'TerritoryMetadataUpdated', approveTransfer: 'TransferApproved', invalidateTransfer: 'TransferCancelled', pause: 'Paused', unpause: 'Unpaused',
};
const requiredRole: Record<LegionAdminAction, string> = {
  updateMetadata: LEGION_ADMIN_ROLE, approveTransfer: LEGION_ADMIN_ROLE, invalidateTransfer: LEGION_ADMIN_ROLE, pause: PAUSER_ROLE, unpause: PAUSER_ROLE,
};
const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
const positive = (value: string | undefined, label: string) => {
  if (!value || !/^\d+$/.test(value) || BigInt(value) === 0n) throw new Error(`${label} must be a positive canonical integer.`);
  return BigInt(value);
};

const activeCanonicalLegionRuntime = (): CanonicalLegionRuntime => Object.freeze({
  family: ONE_Q_RUNTIME_FAMILY,
  chainId: ONE_Q_RUNTIME_CHAIN_ID,
  rpcUrl: ONE_Q_RUNTIME_RPC_URL,
  deploymentIdentity: oneQRuntime.manifest.deploymentIdentity,
  legionDeploymentVersion: oneQRuntime.children.legion?.deploymentVersion,
  contractAddress: requireOneQContractAddress('LegionNFTV2'),
});

function requireCanonicalSource(availability: LegionNFTV2Availability) {
  const manifest = oneQRuntime.manifest;
  if (ONE_Q_RUNTIME_FAMILY !== '1Q_LOCAL' || manifest.chainId !== 31337 || manifest.rpcUrl !== 'http://127.0.0.1:8546') throw new Error('The explicit 1Q_LOCAL runtime configuration is invalid.');
  return validateCanonicalLegionSource(availability.available, availability.reason, availability.source, activeCanonicalLegionRuntime());
}

async function verifyRuntimeAndRole(action: LegionAdminAction, availability: LegionNFTV2Availability) {
  const address = requireCanonicalSource(availability);
  const network = await checkNetwork();
  if (!network.isCorrect || network.chainId !== ONE_Q_RUNTIME_CHAIN_ID) throw new Error(`Wrong chain: switch the connected wallet to chain ${ONE_Q_RUNTIME_CHAIN_ID}.`);
  const provider = await getProvider();
  const [liveNetwork, code] = await Promise.all([provider.getNetwork(), provider.getCode(address)]);
  if (liveNetwork.chainId !== ONE_Q_RUNTIME_CHAIN_ID) throw new Error('Live provider chain does not match the canonical 1Q runtime.');
  if (code === '0x' || code === '0x0') throw new Error('Canonical LegionNFTV2 bytecode is unavailable at the active manifest address.');
  const signer = await getSigner();
  const signerAddress = await signer.getAddress();
  const contract = new Contract(address, LegionNFTV2Artifact.abi, signer);
  const role = await contract[requiredRole[action]]();
  if (!await contract.hasRole(role, signerAddress)) throw new Error(`The connected wallet does not hold the live ${requiredRole[action]} required for ${action}.`);
  return { contract, signerAddress, address };
}

async function preflight(action: LegionAdminAction, params: LegionAdminParams, contract: Contract) {
  const paused = Boolean(await contract.paused());
  if (action === 'pause') {
    if (paused) throw new Error('LegionNFTV2 is already paused.');
    await contract.pause.staticCall(); return [];
  }
  if (action === 'unpause') {
    if (!paused) throw new Error('LegionNFTV2 is already active.');
    await contract.unpause.staticCall(); return [];
  }
  if (paused) throw new Error('LegionNFTV2 is paused; this operation fails closed until the contract is unpaused by its authorized role.');
  if (action === 'updateMetadata') {
    const tokenId = positive(params.tokenId, 'Territory token ID');
    if (!params.population || !/^\d+$/.test(params.population) || !params.metadataURI?.trim()) throw new Error('Display metadata requires a whole-number population and a non-empty canonical metadata URI.');
    const args = [tokenId, params.displayName || '', BigInt(params.population), params.metadataURI] as const;
    await contract.updateMetadata.staticCall(...args); return args;
  }
  const requestId = positive(params.requestId, 'Transfer request ID');
  const request = await contract.getTransferRequest(requestId);
  if (!request.active) throw new Error('The canonical transfer request is no longer active.');
  if (action === 'approveTransfer' && request.approved) throw new Error('The canonical transfer request is already approved.');
  if (action === 'approveTransfer') await contract.approveTransfer.staticCall(requestId);
  else await contract.invalidateTransfer.staticCall(requestId);
  return [requestId] as const;
}

async function adminHistoryObserved(token: string, hash: string, eventName: string) {
  const response = await fetch('/api/admin/canonical/history?limit=250', { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({})) as { data?: { module?: string; transactionHash?: string; eventName?: string }[] };
  if (!response.ok || !Array.isArray(body.data)) throw new Error('Canonical Admin provenance is unavailable.');
  return body.data.some((entry) => entry.module === 'Legion' && entry.transactionHash?.toLowerCase() === hash.toLowerCase() && entry.eventName === eventName);
}

async function indexerAndApiReconciled(token: string, action: LegionAdminAction, params: LegionAdminParams, hash: string, blockNumber: number): Promise<'CONFIRMED' | 'STALE' | 'FAILED' | 'UNAVAILABLE'> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const status = await getLegionNFTV2Availability();
      requireCanonicalSource(status);
      if (!status.checkpoint || BigInt(status.checkpoint) < BigInt(blockNumber)) { await wait(1_500); continue; }
      let tokenId = params.tokenId;
      if (action === 'updateMetadata') {
        const territory = await getLegionNFTV2Territory(params.tokenId!);
        if (territory.displayName !== (params.displayName || '') || territory.population !== params.population || territory.metadataURI !== params.metadataURI) { await wait(1_500); continue; }
      } else if (action === 'approveTransfer') {
        const request = await getLegionNFTV2TransferRequest(params.requestId!);
        if (!request.active || !request.approved) { await wait(1_500); continue; }
        tokenId = request.tokenId;
      } else if (action === 'invalidateTransfer') {
        const request = await getLegionNFTV2TransferRequest(params.requestId!);
        if (request.active) { await wait(1_500); continue; }
        tokenId = request.tokenId;
      } else if (Boolean(status.paused) !== (action === 'pause')) { await wait(1_500); continue; }
      const observed = action === 'pause' || action === 'unpause'
        ? await adminHistoryObserved(token, hash, expectedEvent[action])
        : (await getLegionNFTV2History(tokenId!)).some((event) => event.transactionHash.toLowerCase() === hash.toLowerCase() && event.eventName === expectedEvent[action]);
      if (observed) return 'CONFIRMED';
    } catch (error) {
      if (attempt === 7) return error instanceof Error && /unavailable|checkpoint|RPC|indexer/i.test(error.message) ? 'UNAVAILABLE' : 'FAILED';
    }
    await wait(1_500);
  }
  return 'STALE';
}

function receiptHasExpectedEvent(receipt: { logs: readonly Log[] }, contract: Contract, address: string, action: LegionAdminAction) {
  return receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== address.toLowerCase()) return false;
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name !== expectedEvent[action]) return false;
      return action !== 'invalidateTransfer' || Boolean(parsed.args.byAdministrator);
    } catch { return false; }
  });
}

async function auditTerminal(token: string, audit: AdminAuditRecord, state: Exclude<AdminOperationState, 'PENDING' | 'SUBMITTED'>, values: Record<string, unknown>) {
  try { await updateCanonicalAdminAudit(token, audit._id, state, values); } catch { /* an unavailable audit endpoint never becomes a success signal */ }
}

/** Canonical allowlisted Legion administration: no minting, no generic calls, and no owner transfer overrides. */
export async function executeLegionAdminAction(token: string, action: LegionAdminAction, params: LegionAdminParams = {}, capability?: AdminWalletCapability | null, onState?: (state: AdminOperationState, detail?: string) => void): Promise<LegionAdminWriteResult> {
  // Capability failure is a deterministic local preflight outcome. Keep it
  // outside the transaction/audit catch so it cannot be overwritten as a
  // generic FAILED operation or create an audit record.
  try { requireAdminWriteCapability(capability); }
  catch (error) { const detail = error instanceof Error ? error.message : 'Admin write capability is unavailable.'; onState?.('UNAVAILABLE', detail); throw error; }
  let audit: AdminAuditRecord | null = null;
  let terminal = false;
  try {
    const availability = await getLegionNFTV2Availability();
    const { contract, address } = await verifyRuntimeAndRole(action, availability);
    const args = await preflight(action, params, contract);
    // The backend's separate Legion allowlist is the authority for these
    // action names; create an audit only after role and state preflight pass.
    onState?.('PENDING', 'Wallet, role, runtime, bytecode, and contract preflight passed. Waiting for wallet confirmation.');
    const transaction = await contract[action](...args);
    onState?.('SUBMITTED', transaction.hash);
    audit = await createCanonicalAdminAudit(token, 'Legion', action as AdminAuditAction, transaction.hash);
    const receipt = await transaction.wait();
    if (!receipt || Number(receipt.status) !== 1) {
      await auditTerminal(token, audit, 'REVERTED', { transactionHash: transaction.hash, detail: 'Transaction receipt did not report success.' }); terminal = true;
      onState?.('REVERTED', transaction.hash); throw new Error('The Legion transaction was reverted or did not confirm.');
    }
    const eventObserved = receiptHasExpectedEvent(receipt, contract, address, action);
    if (!eventObserved) {
      await auditTerminal(token, audit, 'FAILED', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: false, detail: `Expected ${expectedEvent[action]} event was absent.` }); terminal = true;
      onState?.('FAILED', `Expected ${expectedEvent[action]} event was absent.`); throw new Error('The receipt did not contain the expected canonical Legion event.');
    }
    const reconciliation = await indexerAndApiReconciled(token, action, params, transaction.hash, Number(receipt.blockNumber));
    if (reconciliation !== 'CONFIRMED') {
      const state: 'STALE' | 'FAILED' | 'UNAVAILABLE' = reconciliation;
      await auditTerminal(token, audit, state, { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: true, indexerObserved: false, detail: `Canonical Legion indexer/API reconciliation is ${state.toLowerCase()}.` }); terminal = true;
      onState?.(state, 'On-chain receipt succeeded but canonical Legion reconciliation is not complete.');
      return { state, transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber), eventObserved: true, indexerObserved: false, auditId: audit._id };
    }
    await auditTerminal(token, audit, 'CONFIRMED', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: true, indexerObserved: true }); terminal = true;
    onState?.('CONFIRMED', transaction.hash);
    return { state: 'CONFIRMED', transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber), eventObserved: true, indexerObserved: true, auditId: audit._id };
  } catch (error) {
    if (audit && !terminal) await auditTerminal(token, audit, 'FAILED', { detail: error instanceof Error ? error.message : 'Unknown Legion control failure.' });
    onState?.('FAILED', error instanceof Error ? error.message : 'Unknown Legion control failure.');
    throw error;
  }
}

export const legionAdminExpectedEvent = (action: LegionAdminAction) => expectedEvent[action];
