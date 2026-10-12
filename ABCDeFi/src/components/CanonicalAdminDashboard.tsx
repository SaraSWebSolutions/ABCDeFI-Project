import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'ethers';
import { Activity, RefreshCcw, ShieldCheck } from 'lucide-react';
import { executeEmergencyPauseAction, getAdminWalletCapability, getCanonicalAdminAudits, getCanonicalAdminSnapshot, getConnectedAdminRoleStatus, getModulePauseState, permittedEmergencyAction, reconcileCanonicalAdminAudit, requiredEmergencyRole, updateCanonicalAdminAudit, type AdminAuditRecord, type AdminOperationState, type AdminSnapshot, type AdminWalletCapability, type RoleStatus } from '../Services/canonicalAdmin';
import { useAuth } from '../Context/AuthContext';
import { useWallet } from '../Context/WalletContext';
import { CanonicalIcoV3Admin } from './CanonicalIcoV3Admin';
import { CanonicalLegionNFTV2Admin } from './CanonicalLegionNFTV2Admin';
import { CanonicalP2PAdmin } from './CanonicalP2PAdmin';
import { CanonicalDirectLendingAdmin } from './CanonicalDirectLendingAdmin';
import { executeLegionAdminAction } from '../Services/legionNFTV2Admin';
import { AdminUserManagement } from './AdminUserManagement';
import { ONE_Q_ADMIN_IDENTITY } from '../Config/oneQRuntime';
import { ADMIN_ROLE_NOT_CONFIGURED, adminCapability, can, type AdminPermission } from '../Services/adminCapability';
import { AdminAccountSwitcher } from './AdminAccountSwitcher';
import { AdminConsoleNavigation, type AdminConsoleSection } from './AdminConsoleNavigation';
import { AdminWriteConfirmationDialog, BlockchainActionStatus, BlockchainCapabilityCard, CanonicalSourceUnavailable } from './AdminControlPlanePrimitives';

const empty: AdminSnapshot = { available: false, status: 'UNAVAILABLE', modules: [], history: [] };
type Module = AdminSnapshot['modules'][number];
const short = (value: string) => value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
const amount = (value: string) => { try { return formatUnits(BigInt(value), 18); } catch { return value; } };

export const CanonicalAdminDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const applicationCapability = adminCapability(user?.adminRole);
  const applicationWallet = useWallet();
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(empty);
  const [roles, setRoles] = useState<RoleStatus[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [pausedByModule, setPausedByModule] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [transactionState, setTransactionState] = useState<string | null>(null);
  const [operationState, setOperationState] = useState<AdminOperationState | null>(null);
  const [audits, setAudits] = useState<AdminAuditRecord[]>([]);
  const [capability, setCapability] = useState<AdminWalletCapability | null>(null);
  const [activeConsoleSection, setActiveConsoleSection] = useState<AdminConsoleSection>('overview');
  const [pendingEmergencyModule, setPendingEmergencyModule] = useState<Module | null>(null);
  const connectedOperator = Boolean(ONE_Q_ADMIN_IDENTITY && wallet && ONE_Q_ADMIN_IDENTITY.operationalAdminWallet.toLowerCase() === wallet.toLowerCase());

  const refresh = useCallback(async () => {
    if (!token) { setLoading(false); setReason('Authenticated administrator session is required.'); return; }
    if (!applicationCapability.role) { setLoading(false); setReason(ADMIN_ROLE_NOT_CONFIGURED); return; }
    setLoading(true); setReason(null);
    try {
      const nextCapability = await getAdminWalletCapability(applicationWallet.address, applicationWallet.isConnected);
      setCapability(nextCapability);
      // History requires audit.read; a support-only session must be able to
      // render its legitimate dashboard.read status without a 403 request.
      const next = await getCanonicalAdminSnapshot(token, nextCapability.providerWallet, can(applicationCapability, 'audit.read'));
      setSnapshot(next);
      setAudits(can(applicationCapability, 'audit.read') ? await getCanonicalAdminAudits(token) : []);
      const onChain = await getConnectedAdminRoleStatus(next.modules, nextCapability.providerWallet);
      setWallet(onChain.wallet); setRoles(onChain.roles);
      const pauseStates = await Promise.all(next.modules.map(async (module) => [module.name, await getModulePauseState(module)] as const));
      setPausedByModule(Object.fromEntries(pauseStates));
    } catch (error) {
      setSnapshot(empty); setRoles([]); setReason(error instanceof Error ? error.message : 'Canonical Admin API is unavailable.');
    } finally { setLoading(false); }
  }, [applicationCapability.role, applicationWallet.address, applicationWallet.isConnected, token]);
  useEffect(() => { void refresh(); }, [refresh]);
  // A server-authoritative application-account switch never switches the
  // connected wallet. Start the new identity at its own safe Overview.
  useEffect(() => { setActiveConsoleSection('overview'); }, [applicationCapability.role]);

  const visibleModule = useCallback((name: string): boolean => {
    if (applicationCapability.role === 'super_admin') return name !== 'Franchise';
    const permission: Record<string, AdminPermission | undefined> = {
      P2P: 'p2p.read', 'Lending V2': 'lending.read', EMIManagerV2: 'lending.read',
      'ICO V3': 'ico.read', Legion: 'legion.read', Marketplace: 'marketplace.read', 'Legion Marketplace': 'marketplace.read',
    };
    return Boolean(permission[name] && can(applicationCapability, permission[name]!));
  }, [applicationCapability]);

  const moduleMatchesConsole = (module: Module): boolean => {
    const name = module.name;
    if (activeConsoleSection === 'system') return true;
    if (activeConsoleSection === 'security') return Boolean(requiredEmergencyRole(module, Boolean(pausedByModule[name])));
    if (activeConsoleSection === 'operations') return ['ICO V3', 'Legion', 'Marketplace', 'Legion Marketplace'].includes(name);
    if (activeConsoleSection === 'lending') return ['Lending V2', 'EMIManagerV2'].includes(name);
    if (activeConsoleSection === 'p2p') return name === 'P2P';
    if (activeConsoleSection === 'token') return name === 'ABCDTokenV2';
    if (activeConsoleSection === 'treasury') return name === 'Treasury';
    if (activeConsoleSection === 'reserve') return name === 'Reserve';
    if (activeConsoleSection === 'referral') return name === 'Referral';
    if (activeConsoleSection === 'loan-nfts') return name === 'Loan NFTs';
    return false;
  };
  const allVisibleModules = useMemo(() => snapshot.modules.filter((module) => module.name !== 'Franchise' && visibleModule(module.name)), [snapshot.modules, visibleModule]);
  const selectedModules = allVisibleModules.filter(moduleMatchesConsole);

  const submitEmergencyAction = async (module: Module) => {
    if (!can(applicationCapability, 'emergency.execute')) {
      setOperationState('UNAVAILABLE'); setTransactionState('ADMIN_PERMISSION_DENIED: the authenticated application role does not permit emergency execution.'); return;
    }
    if (!capability?.writeEligible) {
      setOperationState('UNAVAILABLE'); setTransactionState(capability?.reason || 'Connect the application wallet before an Admin write is eligible.'); return;
    }
    const role = roles.find((entry) => entry.module === module.name);
    const paused = pausedByModule[module.name];
    const action = permittedEmergencyAction(module, role, Boolean(paused));
    if (!action || !token) return;
    setOperationState('PENDING'); setTransactionState(`Waiting for wallet confirmation to ${action} ${module.name}…`);
    try {
      const result = module.name === 'Legion'
        ? await executeLegionAdminAction(token, action, {}, capability, (state, detail) => { setOperationState(state); setTransactionState(detail || state); })
        : await executeEmergencyPauseAction(module, role, Boolean(paused), token, capability, (state, detail) => { setOperationState(state); setTransactionState(detail || state); });
      setOperationState(result.state);
      setTransactionState(result.state === 'CONFIRMED' ? `Confirmed on chain and indexed: ${result.transactionHash}` : `Canonical indexer is stale for ${result.transactionHash}; no success is reported.`);
      await refresh();
    } catch (error) { setOperationState('FAILED'); setTransactionState(`Action failed: ${error instanceof Error ? error.message : 'unknown error'}`); }
  };
  const reconcileNoSubmissionAudit = async (audit: AdminAuditRecord) => {
    if (!token || audit.state !== 'PENDING' || audit.transactionHash || audit.blockNumber || audit.expectedEventObserved !== null || audit.indexerObserved !== null) return;
    setOperationState('PENDING'); setTransactionState('Reconciling an audit record that has no submitted blockchain transaction…');
    try {
      const resolved = await updateCanonicalAdminAudit(token, audit._id, 'FAILED', { detail: 'No transaction was submitted.' });
      setAudits((records) => records.map((record) => record._id === resolved._id ? resolved : record));
      setOperationState('FAILED'); setTransactionState('Audit record resolved: no blockchain transaction was submitted.');
    } catch (error) { setOperationState('UNAVAILABLE'); setTransactionState(`Audit reconciliation was not applied: ${error instanceof Error ? error.message : 'unknown error'}`); }
  };
  const reconcileStaleAudit = async (audit: AdminAuditRecord) => {
    if (!token || audit.state !== 'STALE' || !audit.transactionHash) return;
    setOperationState('PENDING'); setTransactionState('Reconciling canonical evidence. This submits no blockchain transaction.');
    try {
      const resolved = await reconcileCanonicalAdminAudit(token, audit._id);
      setAudits((records) => records.map((record) => record._id === resolved._id ? resolved : record));
      setOperationState(resolved.state); setTransactionState('Canonical evidence reconciled; no blockchain transaction was submitted.');
    } catch (error) { setOperationState('STALE'); setTransactionState(error instanceof Error ? error.message : 'Canonical reconciliation evidence is insufficient.'); }
  };
  const selectedEmergency = pendingEmergencyModule ? (() => {
    const role = roles.find((entry) => entry.module === pendingEmergencyModule.name);
    const paused = pausedByModule[pendingEmergencyModule.name];
    return { action: permittedEmergencyAction(pendingEmergencyModule, role, Boolean(paused)), role: requiredEmergencyRole(pendingEmergencyModule, Boolean(paused)) };
  })() : null;

  return <section aria-label="Canonical Phase 12 Admin" className="space-y-5 rounded-3xl border border-cyan-500/30 bg-slate-900 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4"><div><p className="text-xs font-black uppercase tracking-wide text-cyan-300">ABCDeFi / Administration</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-white"><ShieldCheck className="h-6 w-6" />{activeConsoleSection === 'overview' ? 'Administration overview' : 'Administration console'}</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Application permissions determine UI/API visibility. Blockchain authority is independently determined by the connected wallet and each live module role; this dashboard never grants a blockchain role.</p></div><button onClick={() => void refresh()} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100"><RefreshCcw className="mr-2 inline h-4 w-4" />Refresh</button></header>
    <AdminConsoleNavigation capability={applicationCapability} activeSection={activeConsoleSection} onSelect={setActiveConsoleSection} />
    {activeConsoleSection === 'overview' && <><Overview applicationRole={applicationCapability.role} modules={allVisibleModules} capability={capability} wallet={wallet} /><AdminAccountSwitcher /></>}
    {loading ? <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">Loading canonical manifests and indexed provenance…</p> : reason || !snapshot.available ? <CanonicalSourceUnavailable reason={reason || 'Canonical Admin state is unavailable.'} onOpenProvenance={() => setActiveConsoleSection('system')} /> : <>
      {activeConsoleSection === 'system' && <SystemProvenance capability={capability} applicationRole={applicationCapability.role} permissions={applicationCapability.permissions} applicationWallet={applicationWallet.address} connectedWallet={wallet} connectedOperator={connectedOperator} />}
      {activeConsoleSection === 'security' && (can(applicationCapability, 'emergency.read') ? <SecurityCenter modules={selectedModules} roles={roles} wallet={wallet} capability={capability} pausedByModule={pausedByModule} canExecute={can(applicationCapability, 'emergency.execute')} onReview={setPendingEmergencyModule} operationState={operationState} transactionState={transactionState} /> : <CanonicalSourceUnavailable reason="This application role has no Security or Emergency Center permission." onOpenProvenance={() => setActiveConsoleSection('system')} />)}
      {!['overview', 'users', 'compliance', 'audit', 'security'].includes(activeConsoleSection) && <div className="grid gap-3 md:grid-cols-2">{selectedModules.map((module) => <ModuleReadCard key={module.name} module={module} role={roles.find((entry) => entry.module === module.name)} paused={pausedByModule[module.name]} onOpenProvenance={() => setActiveConsoleSection('system')} />)}</div>}
      {activeConsoleSection === 'audit' && can(applicationCapability, 'audit.read') && <AuditAndHistory audits={audits} history={snapshot.history} canReconcile={can(applicationCapability, 'emergency.execute')} onReconcile={reconcileNoSubmissionAudit} onReconcileStale={reconcileStaleAudit} />}
      {activeConsoleSection === 'operations' && can(applicationCapability, 'legion.read') && snapshot.modules.some((module) => module.name === 'Legion' && module.available) && <CanonicalLegionNFTV2Admin capability={capability} roleStatus={roles.find((entry) => entry.module === 'Legion')} applicationCapability={applicationCapability} />}
      {activeConsoleSection === 'operations' && can(applicationCapability, 'ico.read') && snapshot.modules.some((module) => module.name === 'ICO V3' && module.available) && <CanonicalIcoV3Admin capability={capability} roleStatus={roles.find((entry) => entry.module === 'ICO V3')} applicationCapability={applicationCapability} />}
      {activeConsoleSection === 'p2p' && can(applicationCapability, 'p2p.read') && snapshot.modules.some((module) => module.name === 'P2P' && module.available) && <CanonicalP2PAdmin />}
      {activeConsoleSection === 'lending' && can(applicationCapability, 'lending.read') && snapshot.modules.some((module) => module.name === 'Lending V2' && module.available) && <CanonicalDirectLendingAdmin />}
      {activeConsoleSection === 'compliance' && <CanonicalSourceUnavailable reason="No KYB, AML case-management, provider decision, analytics, TVL, revenue, or on-chain eligibility source is configured. The visible KYC application flag does not grant or alter on-chain eligibility." onOpenProvenance={() => setActiveConsoleSection('system')} />}
      {(activeConsoleSection === 'users' || activeConsoleSection === 'compliance') && can(applicationCapability, 'users.read') && <AdminUserManagement applicationCapability={applicationCapability} />}
    </>}
    <AdminWriteConfirmationDialog open={Boolean(pendingEmergencyModule && selectedEmergency?.action && selectedEmergency.role)} action={`Emergency ${selectedEmergency?.action || 'action'}`} target={pendingEmergencyModule?.name || 'Canonical module'} connectedWallet={wallet} requiredRole={selectedEmergency?.role || 'Module-local role'} expectedEffect={`${selectedEmergency?.action || 'This action'} affects only the named canonical module according to its existing contract method.`} busy={operationState === 'PENDING' || operationState === 'SUBMITTED'} onCancel={() => setPendingEmergencyModule(null)} onConfirm={() => { const module = pendingEmergencyModule; setPendingEmergencyModule(null); if (module) void submitEmergencyAction(module); }} />
  </section>;
};

const Overview: React.FC<{ applicationRole: string | null; modules: Module[]; capability: AdminWalletCapability | null; wallet: string | null }> = ({ applicationRole, modules, capability, wallet }) => <section aria-label="Administration overview" className="grid gap-3 lg:grid-cols-3"><article className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs text-slate-300"><p className="font-bold text-white">Application authorization</p><p className="mt-3 text-slate-400">Application role</p><p className="mt-1 text-base font-black text-cyan-100">{applicationRole?.replace('_', ' ').toUpperCase() || ADMIN_ROLE_NOT_CONFIGURED}</p><p className="mt-3 text-slate-400">Application access</p><p className="mt-1 font-bold text-emerald-300">{applicationRole ? 'Active' : 'Unavailable'}</p><p className="mt-3 text-slate-500">Permissions and session provenance are available in System / Provenance.</p></article><article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs text-slate-300"><p className="font-bold text-white">Blockchain capability</p><p className="mt-3 break-all">Connected wallet: <span className="font-mono">{wallet || 'Not connected'}</span></p><p className="mt-2">Chain: <b>{capability?.chain || 'WRONG_CHAIN'}</b> · runtime: <b>{capability?.runtime || 'RUNTIME_UNAVAILABLE'}</b></p><p className="mt-3 text-slate-500">Blockchain authority is determined independently from the application role through provider, signer, chain, runtime, and live module roles.</p></article><article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs text-slate-300"><p className="font-bold text-white">Canonical module availability</p><p className="mt-2 text-slate-400">{modules.filter((module) => module.available).length} of {modules.length} visible modules report a canonical source.</p><div className="mt-3 flex flex-wrap gap-2">{modules.map((module) => <span key={module.name} className={module.available ? 'rounded-md border border-emerald-500/30 px-2 py-1 text-emerald-200' : 'rounded-md border border-amber-500/30 px-2 py-1 text-amber-100'}>{module.name}: {module.status}</span>)}</div></article></section>;

const SystemProvenance: React.FC<{ capability: AdminWalletCapability | null; applicationRole: string | null; permissions: string[]; applicationWallet: string | null; connectedWallet: string | null; connectedOperator: boolean }> = ({ capability, applicationRole, permissions, applicationWallet, connectedWallet, connectedOperator }) => <section className="space-y-3"><article aria-label="Application Permissions" className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs text-slate-300"><p className="font-bold text-white">Application permissions</p><p className="mt-2">Application role: <b>{applicationRole || ADMIN_ROLE_NOT_CONFIGURED}</b></p><p className="mt-2 break-words">Permissions: {permissions.length ? permissions.join(' · ') : 'None — privileged role-specific surfaces are fail-closed.'}</p><p className="mt-2 text-slate-500">Application permissions control UI/API access only; every blockchain write separately requires the connected wallet and live contract role.</p></article><article aria-label="Admin Wallet identity" className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs text-slate-300"><p className="font-bold text-white">Admin Wallet identity</p>{ONE_Q_ADMIN_IDENTITY ? <><p className="mt-2 break-all">Operational Admin Wallet: <span className="font-mono">{ONE_Q_ADMIN_IDENTITY.operationalAdminWallet}</span></p><p className="mt-1">Runtime scope: <b>{ONE_Q_ADMIN_IDENTITY.runtimeFamily}</b> · Configuration provenance: {ONE_Q_ADMIN_IDENTITY.provenance}</p><p className={connectedOperator ? 'mt-1 text-emerald-300' : 'mt-1 text-amber-200'}>Connected Operator: <b>{connectedOperator ? 'CONNECTED OPERATOR WALLET' : 'CONFIGURED, NOT CONNECTED'}</b></p><p className="mt-1 break-all">Connected Wallet: <span className="font-mono">{connectedWallet || 'not available'}</span></p><p className="mt-1 break-all">Root/DEFAULT_ADMIN identity: <span className="font-mono">{ONE_Q_ADMIN_IDENTITY.rootDefaultAdminWallet}</span></p><p className="mt-2 text-slate-500">Display-only configuration. It never selects a provider account, creates a signer, grants a role, or bypasses live module hasRole() verification.</p></> : <CanonicalSourceUnavailable reason="Operational Admin Wallet identity is unavailable because the explicit runtime-scoped configuration is missing or invalid. Authorization remains unchanged." />}</article><article aria-label="Connected Wallet / Blockchain Capabilities" className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs text-slate-300"><p className="font-bold text-white">Connected Wallet / Blockchain Capabilities</p><p className="mt-2 break-all">Application: <b>{capability?.application || 'DISCONNECTED'}</b> · application wallet: {applicationWallet || 'not connected'}</p><p className="mt-1 break-all">Provider: <b>{capability?.provider || 'PROVIDER_ACCOUNT_UNAVAILABLE'}</b> · provider wallet: {connectedWallet || 'not available'}</p><p className="mt-1">Signer: <b>{capability?.signer || 'SIGNER_UNAVAILABLE'}</b> · chain: <b>{capability?.chain || 'WRONG_CHAIN'}</b> · runtime: <b>{capability?.runtime || 'RUNTIME_UNAVAILABLE'}</b></p><p className={capability?.writeEligible ? 'mt-2 text-emerald-300' : 'mt-2 text-amber-200'}>{capability?.writeEligible ? 'CONNECTED: this application wallet matches the provider signer and may be evaluated for module-local roles.' : capability?.reason || 'Connect the wallet through the application before an Admin write is eligible.'}</p></article></section>;

const SecurityCenter: React.FC<{ modules: Module[]; roles: RoleStatus[]; wallet: string | null; capability: AdminWalletCapability | null; pausedByModule: Record<string, boolean | null>; canExecute: boolean; onReview: (module: Module) => void; operationState: AdminOperationState | null; transactionState: string | null }> = ({ modules, roles, wallet, capability, pausedByModule, canExecute, onReview, operationState, transactionState }) => <section className="space-y-3"><article aria-label="Unified Emergency Center" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><h3 className="font-black text-amber-100">Unified Emergency Center</h3><p className="mt-1 text-xs text-amber-100/80">Security actions are isolated from ordinary operations. Each requires application authorization, connected signer, correct chain/runtime, module-local role, preflight, wallet confirmation, receipt, expected event, indexer/API reconciliation, and a terminal audit record.</p></article><BlockchainActionStatus state={operationState} detail={transactionState} /><div className="grid gap-3 md:grid-cols-2">{modules.map((module) => { const role = roles.find((entry) => entry.module === module.name); const paused = pausedByModule[module.name]; const action = capability?.writeEligible && canExecute ? permittedEmergencyAction(module, role, Boolean(paused)) : null; const requiredRole = requiredEmergencyRole(module, Boolean(paused)); return <article key={module.name} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs"><div className="flex justify-between gap-2"><strong className="text-white">{module.name}</strong><span className={paused ? 'text-amber-200' : 'text-emerald-300'}>{paused ? 'PAUSED' : 'ACTIVE'}</span></div><p className="mt-2 break-all text-slate-400">Target: {Object.values(module.contracts || {}).find((entry) => entry?.address)?.address || 'Canonical source unavailable'}</p><div className="mt-3"><BlockchainCapabilityCard requiredRole={requiredRole} connectedWallet={wallet} authorized={Boolean(action)} applicationPermission="emergency.execute" reason={capability?.reason || role?.unavailable || 'The live target-specific role determines write availability.'} /></div>{action && <button type="button" onClick={() => onReview(module)} className="mt-3 rounded-lg border border-amber-400/50 px-3 py-2 font-bold text-amber-100">Review emergency {action}</button>}</article>; })}</div></section>;

const ModuleReadCard: React.FC<{ module: Module; role?: RoleStatus; paused?: boolean | null; onOpenProvenance: () => void }> = ({ module, role, paused, onOpenProvenance }) => {
  const tokenAuthority = module.authority?.kind === 'AUTHORITATIVE_ON_CHAIN' ? module.authority.snapshot : null;
  if (!module.available) return <CanonicalSourceUnavailable reason={module.reason} onOpenProvenance={onOpenProvenance} />;
  return <article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs"><div className="flex items-center justify-between gap-2"><strong className="text-white">{module.name}</strong><span className="text-emerald-300">{module.status}</span></div>{tokenAuthority ? <div className="mt-3 space-y-1 text-slate-300"><p className="text-emerald-300">Authority: authoritative on-chain snapshot · block {tokenAuthority.snapshotBlock}</p><p className="break-all text-slate-500">Block hash: {tokenAuthority.snapshotBlockHash} · bytecode verified</p><p>{tokenAuthority.token.name} ({tokenAuthority.token.symbol}) · {tokenAuthority.token.decimals} decimals · {tokenAuthority.token.paused ? 'PAUSED' : 'ACTIVE'}</p><p>Supply: {amount(tokenAuthority.token.totalSupply)} / {amount(tokenAuthority.token.maxSupply)} ABCD · headroom {amount(tokenAuthority.token.supplyHeadroom)}</p><p>Owner: <span className="font-mono">{short(tokenAuthority.token.owner)}</span> · Treasury: <span className="font-mono">{short(tokenAuthority.token.treasury)}</span></p><CanonicalSourceUnavailable reason="Token event-indexed emergency reconciliation is not configured; no pause/unpause action is exposed here." /><details><summary className="cursor-pointer text-cyan-200">Immutable allocation wallets and current balances</summary>{tokenAuthority.allocations.map((entry) => <p key={entry.name} className="mt-1">{entry.name}: <span className="font-mono">{short(entry.wallet)}</span> · original {amount(entry.originalAllocation)} · current {amount(entry.currentBalance)} ABCD</p>)}</details><details><summary className="cursor-pointer text-cyan-200">Connected-wallet role reads</summary><p className="mt-1 text-slate-500">Wallet: {tokenAuthority.roleWallet ? short(tokenAuthority.roleWallet) : 'not connected'}</p>{tokenAuthority.roles.map((entry) => <p key={entry.name} className={entry.held ? 'mt-1 text-emerald-300' : 'mt-1 text-slate-500'}>{entry.name}: {entry.held === null ? 'not queried' : entry.held ? 'ROLE_HELD' : 'ROLE_NOT_HELD'}</p>)}</details></div> : <div className="mt-3 space-y-1 text-slate-300"><p>Chain {module.source.chainId} · {module.source.deploymentVersion}</p>{module.source.deploymentIdentity && <p className="break-all text-slate-500">Runtime identity: {module.source.deploymentIdentity}</p>}{paused !== null && paused !== undefined && <p className={paused ? 'text-amber-200' : 'text-emerald-300'}>Emergency state: {paused ? 'PAUSED' : 'ACTIVE'}</p>}<p className={module.indexer?.available ? 'text-emerald-300' : 'text-amber-200'}>{module.indexer?.available ? `Indexer checkpoint: ${module.indexer.checkpoint?.lastProcessedBlock || 'recorded'}` : 'Canonical source unavailable — canonical event state is fail-closed.'}</p><div className="mt-2 space-y-1">{Object.entries(module.contracts || {}).map(([name, entry]) => entry?.address ? <p key={name}>{name}: <span className="font-mono">{short(entry.address)}</span></p> : null)}</div>{role?.roles.map((item) => <p key={item.label} className={item.held ? 'text-emerald-300' : 'text-slate-500'}>{item.label}: {item.held ? 'ROLE_HELD' : 'ROLE_NOT_HELD'}</p>)}</div>}</article>;
};

const AuditAndHistory: React.FC<{ audits: AdminAuditRecord[]; history: AdminSnapshot['history']; canReconcile: boolean; onReconcile: (audit: AdminAuditRecord) => void; onReconcileStale: (audit: AdminAuditRecord) => void }> = ({ audits, history, canReconcile, onReconcile, onReconcileStale }) => <><section aria-label="Canonical Admin Audit" className="space-y-3 border-t border-slate-800 pt-5"><h3 className="font-black text-white">Admin operation audit</h3>{audits.map((audit) => { const noSubmissionPending = audit.state === 'PENDING' && !audit.transactionHash && !audit.blockNumber && audit.expectedEventObserved === null && audit.indexerObserved === null; const submittedStale = audit.state === 'STALE' && Boolean(audit.transactionHash); return <article key={audit._id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs"><strong className="text-cyan-200">{audit.module} · {audit.action} · {audit.state}</strong><p className="mt-1 text-slate-400">{audit.transactionHash || 'No submitted transaction'}{audit.blockNumber ? ` · block ${audit.blockNumber}` : ''}</p>{audit.detail && <p className="mt-1 text-amber-100">{audit.detail}</p>}{audit.reconciliation && <p className="mt-1 text-emerald-200">Reconciled {audit.reconciliation.expectedEvent} at block {audit.blockNumber}; target {audit.reconciliation.targetContract}.</p>}{noSubmissionPending && canReconcile && <button onClick={() => onReconcile(audit)} className="mt-2 rounded-lg border border-amber-400/50 px-3 py-2 font-bold text-amber-100">Mark failed — no transaction submitted</button>}{submittedStale && canReconcile && <><p className="mt-1 text-amber-200">Read-only receipt, indexer, and API verification; no blockchain transaction is submitted.</p><button onClick={() => onReconcileStale(audit)} className="mt-2 rounded-lg border border-cyan-400/50 px-2 py-1 font-bold text-cyan-100">Reconcile canonical evidence</button></>}</article>; })}</section><section aria-label="Canonical Admin History" className="space-y-3 border-t border-slate-800 pt-5"><h3 className="font-black text-white">Canonical admin provenance</h3>{history.map((event) => <article key={`${event.module}-${event.transactionHash}-${event.logIndex}`} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs"><strong className="text-cyan-200">{event.module}: {event.eventName}</strong><p className="mt-1 font-mono text-slate-400">{event.transactionHash}</p></article>)}</section></>;
