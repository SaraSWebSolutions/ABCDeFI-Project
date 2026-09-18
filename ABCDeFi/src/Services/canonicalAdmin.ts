import { Contract, type Log } from 'ethers';
import { getProvider, getSigner, checkNetwork } from './wallet';

export type AdminModule = {
  name: string;
  available: boolean;
  status: 'CONFIGURED' | 'UNAVAILABLE' | 'OUT_OF_SCOPE';
  reason?: string;
  source: Record<string, string>;
  contracts?: Record<string, { address?: string } | null>;
  capabilities: string[];
  indexer?: { available: boolean; checkpoint: { lastProcessedBlock?: string; indexedAt?: string } | null };
};
export type AdminEvent = { module: string; eventName: string; blockNumber: string; transactionHash: string; transactionIndex?: number; logIndex: number; args: Record<string, unknown>; indexedAt?: string };
export type AdminSnapshot = { available: boolean; status: 'AVAILABLE' | 'UNAVAILABLE'; modules: AdminModule[]; history: AdminEvent[] };
export type RoleStatus = { module: string; roles: { label: string; held: boolean }[]; unavailable?: string };
export type AdminWriteResult = { transactionHash: string; blockNumber: number; eventObserved: boolean; indexerObserved: boolean };

const roleAbi = ['function hasRole(bytes32 role,address account) view returns (bool)'];
const descriptors: Record<string, { contract: string; roles: string[] }> = {
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

export async function getCanonicalAdminSnapshot(token: string): Promise<AdminSnapshot> {
  const [status, history] = await Promise.all([api('/status', token), api('/history?limit=200', token)]);
  if (!status.available) return { available: false, status: 'UNAVAILABLE', modules: status.modules || [], history: [] };
  const ordered = Array.isArray(history.data) ? history.data.slice().sort((a: AdminEvent, b: AdminEvent) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.transactionIndex || 0) - Number(b.transactionIndex || 0) || Number(a.logIndex) - Number(b.logIndex)) : [];
  return { available: true, status: 'AVAILABLE', modules: status.modules || [], history: ordered };
}

export async function getConnectedAdminRoleStatus(modules: AdminModule[]): Promise<{ wallet: string | null; roles: RoleStatus[] }> {
  try {
    const provider = await getProvider();
    const accounts = await provider.send('eth_accounts', []);
    const wallet = accounts[0] || null;
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

export function permittedEmergencyAction(module: AdminModule, roleStatus: RoleStatus | undefined, paused: boolean): 'pause' | 'unpause' | null {
  const action = pauseActions[module.name];
  if (!action || !roleStatus) return null;
  const requiredRole = paused ? action.unpauseRole : action.pauseRole;
  return roleStatus.roles.some((role) => role.label === requiredRole && role.held) ? (paused ? 'unpause' : 'pause') : null;
}

export async function getModulePauseState(module: AdminModule): Promise<boolean | null> {
  const definition = pauseActions[module.name];
  const address = definition ? module.contracts?.[definition.contract]?.address : undefined;
  if (!definition || !address) return null;
  try { return Boolean(await new Contract(address, ['function paused() view returns (bool)'], await getProvider()).paused()); }
  catch { return null; }
}

async function waitForIndexedTransaction(token: string, transactionHash: string): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const history = await api('/history?limit=200', token);
    if (Array.isArray(history.data) && history.data.some((event: AdminEvent) => event.transactionHash?.toLowerCase() === transactionHash.toLowerCase())) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));
  }
  return false;
}

export async function executeEmergencyPauseAction(module: AdminModule, roleStatus: RoleStatus | undefined, paused: boolean, token: string): Promise<AdminWriteResult> {
  const action = permittedEmergencyAction(module, roleStatus, paused);
  const definition = pauseActions[module.name];
  const address = definition ? module.contracts?.[definition.contract]?.address : undefined;
  if (!action || !definition || !address) throw new Error('The connected wallet does not hold the module-local emergency role for this action.');
  const network = await checkNetwork();
  if (!network.isCorrect) throw new Error(`Wrong network: switch to ${network.networkName} before submitting an Admin action.`);
  const signer = await getSigner();
  const contract = new Contract(address, [
    'function paused() view returns (bool)', 'function pause()', 'function unpause()',
    'event Paused(address account)', 'event Unpaused(address account)',
    'event TreasuryPaused(address administrator)', 'event TreasuryUnpaused(address administrator)',
  ], signer);
  if (Boolean(await contract.paused()) !== paused) throw new Error('The module pause state changed before confirmation. Refresh canonical state and try again.');
  const transaction = await contract[action]();
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error('The wallet transaction did not succeed on chain.');
  const expectedEvents = action === 'pause' ? new Set(['Paused', 'TreasuryPaused']) : new Set(['Unpaused', 'TreasuryUnpaused']);
  const eventObserved = receipt.logs.some((log: Log) => {
    if (log.address.toLowerCase() !== address.toLowerCase()) return false;
    try { return expectedEvents.has(contract.interface.parseLog(log)?.name || ''); } catch { return false; }
  });
  if (!eventObserved) throw new Error('The transaction receipt did not contain the expected canonical module event.');
  const indexerObserved = await waitForIndexedTransaction(token, transaction.hash);
  return { transactionHash: transaction.hash, blockNumber: receipt.blockNumber, eventObserved, indexerObserved };
}
