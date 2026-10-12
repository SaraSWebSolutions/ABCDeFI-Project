import { Contract, type Log } from 'ethers';
import { getProvider, getSigner, checkNetwork } from './wallet';
import { ONE_Q_RUNTIME_FAMILY } from '../Config/oneQRuntime';

export type AdminModule = {
  name: string;
  available: boolean;
  status: 'CONFIGURED' | 'UNAVAILABLE' | 'OUT_OF_SCOPE';
  reason?: string;
  source: Record<string, string>;
  contracts?: Record<string, { address?: string } | null>;
  capabilities: string[];
  indexer?: { available: boolean; checkpoint: { lastProcessedBlock?: string; indexedAt?: string; sharedCheckpoint?: string } | null };
  authority?: { kind: 'AUTHORITATIVE_ON_CHAIN'; available: boolean; snapshot: AuthoritativeTokenSnapshot | null };
};
export type AuthoritativeTokenSnapshot = {
  runtimeFamily: '1Q_LOCAL'; chainId: number; rpcUrl: string; deploymentIdentity: string; deploymentVersion: string; deploymentBlock: number; tokenAddress: string;
  snapshotBlock: number; snapshotBlockHash: string; liveBytecode: { verified: boolean; codeHash: string };
  token: { name: string; symbol: string; decimals: number; totalSupply: string; maxSupply: string; supplyHeadroom: string; paused: boolean; owner: string; treasury: string };
  allocations: { name: string; wallet: string; originalAllocation: string; bps: number; currentBalance: string }[];
  roles: { name: string; id: string; held: boolean | null }[]; roleWallet: string | null;
};
export type AdminEvent = { module: string; eventName: string; blockNumber: string; transactionHash: string; transactionIndex?: number; logIndex: number; args: Record<string, unknown>; indexedAt?: string };
export type AdminSnapshot = { available: boolean; status: 'AVAILABLE' | 'UNAVAILABLE'; modules: AdminModule[]; history: AdminEvent[] };
export type RoleStatus = { module: string; roles: { label: string; held: boolean }[]; unavailable?: string };
export type AdminOperationState = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'REVERTED' | 'STALE' | 'UNAVAILABLE';
export type AdminAuditAction = 'pause' | 'unpause' | 'setEligibility' | 'setOracle' | 'setProceedsRecipient' | 'configureTge' | 'finalize' | 'cancel' | 'withdrawProceeds';
export type AdminAuditRecord = { _id: string; module: string; action: AdminAuditAction; state: AdminOperationState; transactionHash?: string | null; blockNumber?: string | null; expectedEventObserved?: boolean | null; indexerObserved?: boolean | null; detail?: string | null; reconciliation?: { receiptBlockHash: string; targetContract: string; sender: string; expectedEvent: string; eventLogIndex: number; indexerTransactionHash: string; indexerBlockHash: string; indexerLogIndex: number; reconciledAt: string } | null; createdAt: string; updatedAt: string };
export type AdminWriteResult = { state: AdminOperationState; transactionHash: string; blockNumber: number; eventObserved: boolean; indexerObserved: boolean; auditId: string };
export type AdminWalletCapability = {
  application: 'CONNECTED' | 'DISCONNECTED';
  provider: 'PROVIDER_ACCOUNT_AVAILABLE' | 'PROVIDER_ACCOUNT_UNAVAILABLE';
  signer: 'SIGNER_AVAILABLE' | 'SIGNER_UNAVAILABLE';
  chain: 'CORRECT_CHAIN' | 'WRONG_CHAIN';
  runtime: 'RUNTIME_AVAILABLE' | 'RUNTIME_UNAVAILABLE';
  role: 'ROLE_HELD' | 'ROLE_NOT_HELD' | 'ROLE_UNVERIFIED';
  applicationWallet: string | null;
  providerWallet: string | null;
  signerWallet: string | null;
  accountMatch: boolean;
  writeEligible: boolean;
  reason: string;
};

const roleAbi = ['function hasRole(bytes32 role,address account) view returns (bool)'];
const descriptors: Record<string, { contract: string; roles: string[] }> = {
  ABCDTokenV2: { contract: 'ABCDTokenV2', roles: ['DEFAULT_ADMIN_ROLE', 'MINTER_ROLE', 'BURNER_ROLE', 'PAUSER_ROLE', 'TREASURY_ROLE'] },
  'ICO V3': { contract: 'ICOManagerV3', roles: ['DEFAULT_ADMIN_ROLE', 'ICO_ADMIN_ROLE', 'PAUSER_ROLE', 'ORACLE_ADMIN_ROLE', 'ELIGIBILITY_ADMIN_ROLE', 'CUSTODY_ADMIN_ROLE'] },
  'Lending V2': { contract: 'LendingPoolV2', roles: ['DEFAULT_ADMIN_ROLE', 'LIQUIDITY_MANAGER_ROLE', 'LIQUIDATION_RECOVERY_ROLE'] },
  P2P: { contract: 'LoanMarketplaceV2', roles: ['DEFAULT_ADMIN_ROLE', 'LIQUIDATION_SETTLEMENT_ROLE'] },
  // EMIManagerV2 is shared by Direct Lending and P2P.  Its emergency role is
  // verified on the EMI target itself and is intentionally not a P2P role.
  EMIManagerV2: { contract: 'EMIManagerV2', roles: ['DEFAULT_ADMIN_ROLE'] },
  Referral: { contract: 'LendingReferralManagerV2', roles: ['DEFAULT_ADMIN_ROLE', 'LENDING_REFERRAL_OPERATOR_ROLE'] },
  Reserve: { contract: 'InsuranceReserveV2', roles: ['DEFAULT_ADMIN_ROLE', 'RESERVE_FUNDER_ROLE', 'RESERVE_OPERATOR_ROLE'] },
  'Loan NFTs': { contract: 'LoanNFTV2', roles: ['DEFAULT_ADMIN_ROLE', 'MINTER_ROLE', 'DIRECT_COMPLETION_OPERATOR_ROLE', 'P2P_COMPLETION_OPERATOR_ROLE', 'VALUATION_CONFIG_ROLE'] },
  Treasury: { contract: 'TreasuryV2', roles: ['DEFAULT_ADMIN_ROLE', 'ASSET_MANAGER_ROLE', 'FUNDER_MANAGER_ROLE', 'TREASURY_FUNDER_ROLE', 'RECIPIENT_MANAGER_ROLE', 'TREASURY_OPERATOR_ROLE', 'PAUSER_ROLE', 'UNPAUSER_ROLE'] },
  Marketplace: { contract: 'ABCDNFTMarketplaceV2', roles: ['DEFAULT_ADMIN_ROLE', 'MARKETPLACE_ADMIN_ROLE', 'PAUSER_ROLE'] },
  Legion: { contract: 'LegionNFTV2', roles: ['DEFAULT_ADMIN_ROLE', 'LEGION_ADMIN_ROLE', 'LEGION_MINTER_ROLE', 'LEGION_MARKETPLACE_SETTLER_ROLE', 'PAUSER_ROLE'] },
  Franchise: { contract: 'FranchiseRegistry', roles: ['DEFAULT_ADMIN_ROLE', 'REGISTRY_ADMIN_ROLE', 'ISSUER_ROLE', 'LIFECYCLE_ROLE', 'PAUSER_ROLE', 'UNPAUSER_ROLE'] },
  'Legion Marketplace': { contract: 'LegionMarketplaceSettlementAdapterV2', roles: ['DEFAULT_ADMIN_ROLE', 'SETTLEMENT_ADMIN_ROLE', 'PAUSER_ROLE'] },
};

// Phase 12 deliberately exposes only pre-existing module-local emergency
// actions.  This is not a generic contract-call facility and cannot be used
// to route assets, rewrite protocol state, or bypass a registry.
const pauseActions: Record<string, { contract: string; pauseRole: string; unpauseRole: string }> = {
  ABCDTokenV2: { contract: 'ABCDTokenV2', pauseRole: 'PAUSER_ROLE', unpauseRole: 'PAUSER_ROLE' },
  'ICO V3': { contract: 'ICOManagerV3', pauseRole: 'PAUSER_ROLE', unpauseRole: 'PAUSER_ROLE' },
  'Lending V2': { contract: 'LendingPoolV2', pauseRole: 'DEFAULT_ADMIN_ROLE', unpauseRole: 'DEFAULT_ADMIN_ROLE' },
  P2P: { contract: 'LoanMarketplaceV2', pauseRole: 'DEFAULT_ADMIN_ROLE', unpauseRole: 'DEFAULT_ADMIN_ROLE' },
  EMIManagerV2: { contract: 'EMIManagerV2', pauseRole: 'DEFAULT_ADMIN_ROLE', unpauseRole: 'DEFAULT_ADMIN_ROLE' },
  Referral: { contract: 'LendingReferralManagerV2', pauseRole: 'DEFAULT_ADMIN_ROLE', unpauseRole: 'DEFAULT_ADMIN_ROLE' },
  Reserve: { contract: 'InsuranceReserveV2', pauseRole: 'DEFAULT_ADMIN_ROLE', unpauseRole: 'DEFAULT_ADMIN_ROLE' },
  Treasury: { contract: 'TreasuryV2', pauseRole: 'PAUSER_ROLE', unpauseRole: 'UNPAUSER_ROLE' },
  Marketplace: { contract: 'ABCDNFTMarketplaceV2', pauseRole: 'PAUSER_ROLE', unpauseRole: 'PAUSER_ROLE' },
  Legion: { contract: 'LegionNFTV2', pauseRole: 'PAUSER_ROLE', unpauseRole: 'PAUSER_ROLE' },
  Franchise: { contract: 'FranchiseRegistry', pauseRole: 'PAUSER_ROLE', unpauseRole: 'UNPAUSER_ROLE' },
  'Legion Marketplace': { contract: 'LegionMarketplaceSettlementAdapterV2', pauseRole: 'PAUSER_ROLE', unpauseRole: 'PAUSER_ROLE' },
};

async function api(path: string, token: string): Promise<any> {
  const response = await fetch(`/api/admin/canonical${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.reason || `Canonical Admin API request failed (${response.status}).`);
  return data;
}

async function writeApi(path: string, token: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<any> {
  const response = await fetch(`/api/admin/canonical${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.reason || `Canonical Admin audit request failed (${response.status}).`);
  return data;
}

export async function getCanonicalAdminAudits(token: string): Promise<AdminAuditRecord[]> {
  const response = await api('/audit?limit=50', token);
  return Array.isArray(response.data) ? response.data : [];
}

export async function createCanonicalAdminAudit(token: string, module: string, action: AdminAuditAction, transactionHash: string): Promise<AdminAuditRecord> {
  const response = await writeApi('/audit', token, 'POST', { module, action, transactionHash });
  return response.audit;
}

export async function updateCanonicalAdminAudit(token: string, auditId: string, state: AdminOperationState, values: Record<string, unknown> = {}): Promise<AdminAuditRecord> {
  const response = await writeApi(`/audit/${auditId}`, token, 'PATCH', { state, ...values });
  return response.audit;
}

export async function reconcileCanonicalAdminAudit(token: string, auditId: string): Promise<AdminAuditRecord> {
  const response = await writeApi(`/audit/${auditId}/reconcile`, token, 'POST', {});
  return response.audit;
}

// `history` is an audit/provenance resource with its own backend permission.
// A dashboard-read-only role must not request it merely to render the module
// status snapshot.
export async function getCanonicalAdminSnapshot(token: string, walletAddress?: string | null, includeHistory = true): Promise<AdminSnapshot> {
  const walletQuery = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : '';
  const status = await api(`/status${walletQuery}`, token);
  if (!status.available) return { available: false, status: 'UNAVAILABLE', modules: status.modules || [], history: [] };
  if (!includeHistory) return { available: true, status: 'AVAILABLE', modules: status.modules || [], history: [] };
  const history = await api('/history?limit=200', token);
  const ordered = Array.isArray(history.data) ? history.data.slice().sort((a: AdminEvent, b: AdminEvent) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.transactionIndex || 0) - Number(b.transactionIndex || 0) || Number(a.logIndex) - Number(b.logIndex)) : [];
  return { available: true, status: 'AVAILABLE', modules: status.modules || [], history: ordered };
}

const sameAddress = (left: string | null | undefined, right: string | null | undefined) => Boolean(left && right && left.toLowerCase() === right.toLowerCase());

/**
 * Reads provider, signer, chain, and explicit application-connection state
 * separately. A passive provider account never becomes an application wallet
 * connection and therefore cannot make a write eligible by itself.
 */
export async function getAdminWalletCapability(applicationWallet: string | null, applicationConnected: boolean): Promise<AdminWalletCapability> {
  const base: Omit<AdminWalletCapability, 'provider' | 'signer' | 'chain' | 'providerWallet' | 'signerWallet' | 'accountMatch' | 'writeEligible' | 'reason'> = {
    application: applicationConnected && Boolean(applicationWallet) ? 'CONNECTED' : 'DISCONNECTED',
    runtime: ONE_Q_RUNTIME_FAMILY === '1Q_LOCAL' ? 'RUNTIME_AVAILABLE' : 'RUNTIME_UNAVAILABLE',
    role: 'ROLE_UNVERIFIED',
    applicationWallet: applicationWallet || null,
  };
  try {
    const provider = await getProvider();
    const accounts = await provider.send('eth_accounts', []);
    const providerWallet = typeof accounts[0] === 'string' ? accounts[0] : null;
    const network = await checkNetwork();
    const accountMatch = sameAddress(applicationWallet, providerWallet);
    let signerWallet: string | null = null;
    let signer: AdminWalletCapability['signer'] = 'SIGNER_UNAVAILABLE';
    if (providerWallet) {
      try {
        signerWallet = await (await getSigner()).getAddress();
        signer = sameAddress(signerWallet, providerWallet) ? 'SIGNER_AVAILABLE' : 'SIGNER_UNAVAILABLE';
      } catch { /* A read-only capability check must never request a signature. */ }
    }
    const chain = network.isCorrect ? 'CORRECT_CHAIN' : 'WRONG_CHAIN';
    const writeEligible = base.application === 'CONNECTED' && Boolean(providerWallet) && accountMatch && signer === 'SIGNER_AVAILABLE' && chain === 'CORRECT_CHAIN' && base.runtime === 'RUNTIME_AVAILABLE';
    const reason = !providerWallet ? 'No provider account is available.'
      : base.application !== 'CONNECTED' ? 'Connect this wallet through the application before any Admin write is eligible.'
        : !accountMatch ? 'The application wallet and provider wallet differ; switch or reconnect before any Admin write.'
          : signer !== 'SIGNER_AVAILABLE' ? 'The selected provider account cannot provide a signer.'
            : chain !== 'CORRECT_CHAIN' ? `The connected wallet is on ${network.networkName}; canonical 1Q_LOCAL requires chain 31337.`
              : base.runtime !== 'RUNTIME_AVAILABLE' ? 'The explicit canonical runtime is unavailable.'
                : 'Wallet, signer, chain, and runtime prerequisites are satisfied. Role verification is module-specific.';
    return { ...base, provider: providerWallet ? 'PROVIDER_ACCOUNT_AVAILABLE' : 'PROVIDER_ACCOUNT_UNAVAILABLE', signer, chain, providerWallet, signerWallet, accountMatch, writeEligible, reason };
  } catch {
    return { ...base, provider: 'PROVIDER_ACCOUNT_UNAVAILABLE', signer: 'SIGNER_UNAVAILABLE', chain: 'WRONG_CHAIN', providerWallet: null, signerWallet: null, accountMatch: false, writeEligible: false, reason: 'The injected wallet provider is unavailable.' };
  }
}

export function requireAdminWriteCapability(capability: AdminWalletCapability | null | undefined): void {
  if (!capability?.writeEligible) throw new Error(capability?.reason || 'A connected application wallet, matching provider signer, canonical chain, and canonical runtime are required before an Admin write.');
}

export async function getConnectedAdminRoleStatus(modules: AdminModule[], selectedWallet?: string | null): Promise<{ wallet: string | null; roles: RoleStatus[] }> {
  try {
    const provider = await getProvider();
    const accounts = await provider.send('eth_accounts', []);
    const wallet = selectedWallet || accounts[0] || null;
    if (!wallet) return { wallet: null, roles: [] };
    const roles = await Promise.all(modules.filter((module) => module.available && descriptors[module.name]).map(async (module) => {
      const descriptor = descriptors[module.name];
      const address = module.contracts?.[descriptor.contract]?.address;
      if (!address) return { module: module.name, roles: [], unavailable: 'The canonical contract address is unavailable.' };
      try {
        const contract = new Contract(address, [...roleAbi, ...descriptor.roles.map((name) => `function ${name}() view returns (bytes32)`)], provider);
        const values = await Promise.all(descriptor.roles.map(async (label) => ({ label, held: Boolean(await contract.hasRole(await contract[label](), wallet)) })));
        return { module: module.name, roles: values };
      } catch (error) { return { module: module.name, roles: [], unavailable: error instanceof Error ? error.message : 'On-chain role verification failed.' }; }
    }));
    return { wallet, roles };
  } catch { return { wallet: null, roles: [] }; }
}

export async function getConnectedWalletAddress(): Promise<string | null> {
  try {
    const accounts = await (await getProvider()).send('eth_accounts', []);
    return accounts[0] || null;
  } catch { return null; }
}

export function permittedEmergencyAction(module: AdminModule, roleStatus: RoleStatus | undefined, paused: boolean): 'pause' | 'unpause' | null {
  const action = pauseActions[module.name];
  if (!action || !roleStatus) return null;
  const requiredRole = paused ? action.unpauseRole : action.pauseRole;
  return roleStatus.roles.some((role) => role.label === requiredRole && role.held) ? (paused ? 'unpause' : 'pause') : null;
}

export function requiredEmergencyRole(module: AdminModule, paused: boolean): string | null {
  const action = pauseActions[module.name];
  return action ? (paused ? action.unpauseRole : action.pauseRole) : null;
}

export async function getModulePauseState(module: AdminModule): Promise<boolean | null> {
  const definition = pauseActions[module.name];
  const address = definition ? module.contracts?.[definition.contract]?.address : undefined;
  if (!definition || !address) return null;
  try { return Boolean(await new Contract(address, ['function paused() view returns (bool)'], await getProvider()).paused()); }
  catch { return null; }
}

function expectedEmergencyEvent(moduleName: string, action: 'pause' | 'unpause'): string {
  // Treasury deliberately uses its own event names. Every other existing
  // canonical pause target, including LendingPoolV2 and EMIManagerV2, emits
  // OpenZeppelin Paused/Unpaused from that exact target contract.
  if (moduleName === 'Treasury') return action === 'pause' ? 'TreasuryPaused' : 'TreasuryUnpaused';
  return action === 'pause' ? 'Paused' : 'Unpaused';
}

async function waitForIndexedTransaction(
  token: string,
  moduleName: string,
  transactionHash: string,
  expectedEvent: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const history = await api('/history?limit=200', token);
    if (Array.isArray(history.data) && history.data.some((event: AdminEvent) => (
      event.module === moduleName
      && event.eventName === expectedEvent
      && event.transactionHash?.toLowerCase() === transactionHash.toLowerCase()
    ))) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));
  }
  return false;
}

export async function executeEmergencyPauseAction(module: AdminModule, roleStatus: RoleStatus | undefined, paused: boolean, token: string, capability: AdminWalletCapability | null | undefined, onState?: (state: AdminOperationState, detail?: string) => void): Promise<AdminWriteResult> {
  const action = permittedEmergencyAction(module, roleStatus, paused);
  const definition = pauseActions[module.name];
  const address = definition ? module.contracts?.[definition.contract]?.address : undefined;
  try { requireAdminWriteCapability(capability); }
  catch (error) { onState?.('UNAVAILABLE', error instanceof Error ? error.message : 'Admin write capability is unavailable.'); throw error; }
  if (!action || !definition || !address) {
    const error = new Error('The connected wallet does not hold the module-local emergency role for this action.');
    onState?.('UNAVAILABLE', error.message); throw error;
  }
  let audit: AdminAuditRecord | null = null;
  let terminalAuditState = false;
  try {
    const network = await checkNetwork();
    if (!network.isCorrect) throw new Error(`Wrong network: switch to ${network.networkName} before submitting an Admin action.`);
    const signer = await getSigner();
    const contract = new Contract(address, [
      'function paused() view returns (bool)', 'function hasRole(bytes32 role,address account) view returns (bool)', `function ${paused ? definition.unpauseRole : definition.pauseRole}() view returns (bytes32)`, 'function pause()', 'function unpause()',
      'event Paused(address account)', 'event Unpaused(address account)',
      'event TreasuryPaused(address administrator)', 'event TreasuryUnpaused(address administrator)',
    ], signer);
    const requiredRole = paused ? definition.unpauseRole : definition.pauseRole;
    const signerAddress = await signer.getAddress();
    if (!await contract.hasRole(await contract[requiredRole](), signerAddress)) {
      throw new Error('The selected wallet does not currently hold the required on-chain emergency role.');
    }
    if (Boolean(await contract.paused()) !== paused) throw new Error('The module pause state changed before confirmation. Refresh canonical state and try again.');
    // Do not create an audit record in PENDING before the deterministic role
    // and contract-state preflight has passed.
    onState?.('PENDING', 'Wallet, role, chain, and current pause-state preflight passed. Waiting for wallet confirmation.');
    const transaction = await contract[action]();
    onState?.('SUBMITTED', transaction.hash);
    audit = await createCanonicalAdminAudit(token, module.name, action, transaction.hash);
    const receipt = await transaction.wait();
    if (!receipt || receipt.status !== 1) {
      await updateCanonicalAdminAudit(token, audit._id, 'REVERTED', { transactionHash: transaction.hash, detail: 'Transaction receipt did not report success.' });
      terminalAuditState = true;
      onState?.('REVERTED', transaction.hash);
      throw new Error('The wallet transaction did not succeed on chain.');
    }
    const expectedEvent = expectedEmergencyEvent(module.name, action);
    const eventObserved = receipt.logs.some((log: Log) => {
      if (log.address.toLowerCase() !== address.toLowerCase()) return false;
      try { return contract.interface.parseLog(log)?.name === expectedEvent; } catch { return false; }
    });
    if (!eventObserved) {
      await updateCanonicalAdminAudit(token, audit._id, 'FAILED', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: false, detail: 'Expected canonical pause event was absent.' });
      terminalAuditState = true;
      onState?.('FAILED', 'Expected canonical event was absent.');
      throw new Error('The transaction receipt did not contain the expected canonical module event.');
    }
    const indexerObserved = await waitForIndexedTransaction(token, module.name, transaction.hash, expectedEvent);
    if (!indexerObserved) {
      await updateCanonicalAdminAudit(token, audit._id, 'STALE', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: true, indexerObserved: false, detail: 'Canonical indexer did not observe the event within the bounded wait.' });
      terminalAuditState = true;
      onState?.('STALE', 'Confirmed on-chain; canonical indexer is still behind.');
      return { state: 'STALE', transactionHash: transaction.hash, blockNumber: receipt.blockNumber, eventObserved, indexerObserved, auditId: audit._id };
    }
    await updateCanonicalAdminAudit(token, audit._id, 'CONFIRMED', { transactionHash: transaction.hash, blockNumber: String(receipt.blockNumber), expectedEventObserved: true, indexerObserved: true });
    terminalAuditState = true;
    onState?.('CONFIRMED', transaction.hash);
    return { state: 'CONFIRMED', transactionHash: transaction.hash, blockNumber: receipt.blockNumber, eventObserved, indexerObserved, auditId: audit._id };
  } catch (error) {
    if (audit && !terminalAuditState) {
      try { await updateCanonicalAdminAudit(token, audit._id, 'FAILED', { detail: error instanceof Error ? error.message : 'Unknown emergency control failure.' }); } catch { /* audit availability must not fabricate a successful operation */ }
    }
    onState?.('FAILED', error instanceof Error ? error.message : 'Unknown emergency control failure.');
    throw error;
  }
}
