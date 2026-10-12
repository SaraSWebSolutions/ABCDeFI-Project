import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../Context/AuthContext';
import { executeIcoV3AdminAction, icoV3RequiredRole, type IcoV3AdminAction } from '../Services/icoV3Admin';
import type { AdminOperationState, AdminWalletCapability, RoleStatus } from '../Services/canonicalAdmin';
import type { AdminCapability } from '../Services/adminCapability';
import { AdminWriteConfirmationDialog, BlockchainActionStatus, BlockchainCapabilityCard, CanonicalSourceUnavailable } from './AdminControlPlanePrimitives';

type IcoV3Status = { status: string; reason?: string; manifest?: { chainId: number; deploymentVersion: string; deploymentIdentity: string; address: string; abcdAddress: string; contractKind: string }; checkpoint?: { lastProcessedBlock: string; lastProcessedBlockHash: string }; data?: { lifecycle: string; totalAllocated: string; totalBnbCollected: string; totalBnbRefunded: string; totalBnbWithdrawn: string; deploymentInventory: string; tgeTimestamp: string; paused: boolean; currentStage: string; stages: Array<{ startTime: string; endTime: string; inventory: string; sold: string; priceUsdWad: string }>; oracle: { feed: string; feedDecimals: string; maxPriceAge: string; answer: string; updatedAt: string }; custody: { icoWallet: string; proceedsRecipient: string } } };
const life = (value: string) => ['Not started', 'Active', 'Finalized', 'Cancelled'][Number(value)] || 'Unknown';
const field = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50';
const expectedEffect: Record<IcoV3AdminAction, string> = {
  setEligibility: 'Updates eligibility for the supplied wallet using the canonical ICO V3 contract.',
  pause: 'Pauses the canonical ICO V3 contract.',
  unpause: 'Unpauses the canonical ICO V3 contract.',
  setOracle: 'Changes the BNB/USD feed only when the existing contract preconditions allow it.',
  setProceedsRecipient: 'Changes the proceeds recipient only when the existing contract preconditions allow it.',
  configureTge: 'Sets the TGE timestamp using the existing ICO V3 rules.',
  finalize: 'Finalizes the ICO only when the existing terminal lifecycle conditions are met.',
  cancel: 'Cancels the ICO only when the existing terminal lifecycle conditions are met.',
  withdrawProceeds: 'Withdraws finalized proceeds only through the existing custody rule.',
};
const actionLabel = (action: IcoV3AdminAction) => ({ setEligibility: 'Set eligibility', pause: 'Pause ICO V3', unpause: 'Unpause ICO V3', setOracle: 'Set BNB/USD oracle', setProceedsRecipient: 'Set proceeds recipient', configureTge: 'Configure TGE', finalize: 'Finalize ICO V3', cancel: 'Cancel ICO V3', withdrawProceeds: 'Withdraw finalized proceeds' }[action]);

/** Canonical ICOManagerV3 administration. Every control is an explicit allowlisted contract method. */
export const CanonicalIcoV3Admin: React.FC<{ capability?: AdminWalletCapability | null; roleStatus?: RoleStatus; applicationCapability?: AdminCapability | null }> = ({ capability = null, roleStatus, applicationCapability = null }) => {
  const { token } = useAuth();
  const [status, setStatus] = useState<IcoV3Status | null>(null);
  const [reason, setReason] = useState('Loading canonical ICO V3 indexed state…');
  const [operation, setOperation] = useState<AdminOperationState | null>(null);
  const [detail, setDetail] = useState('');
  const [pendingAction, setPendingAction] = useState<IcoV3AdminAction | null>(null);
  const [wallet, setWallet] = useState(''); const [allowed, setAllowed] = useState(true); const [oracle, setOracle] = useState(''); const [recipient, setRecipient] = useState(''); const [tge, setTge] = useState('');

  const load = useCallback(async () => { try { const response = await fetch('/api/ico-v3/status'); const body = await response.json().catch(() => ({})); if (!response.ok || body.status !== 'AVAILABLE') throw new Error(body.reason || 'Canonical ICO V3 API is unavailable.'); setStatus(body); setReason(''); } catch (error) { setStatus(null); setReason(error instanceof Error ? error.message : 'Canonical ICO V3 API is unavailable.'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const roleHeld = (action: IcoV3AdminAction) => Boolean(roleStatus?.roles.some((entry) => entry.label === icoV3RequiredRole(action) && entry.held));
  const applicationPermits = (action: IcoV3AdminAction) => action === 'pause' || action === 'unpause'
    ? applicationCapability?.permissions.includes('emergency.execute')
    : applicationCapability?.permissions.includes('ico.operate');
  const writeEligible = (action: IcoV3AdminAction) => Boolean(token && applicationPermits(action) && capability?.writeEligible && roleHeld(action));
  const writeReason = (action: IcoV3AdminAction) => !applicationPermits(action)
    ? 'ADMIN_PERMISSION_DENIED: the authenticated application role does not permit this ICO V3 operation.'
    : !capability?.writeEligible
    ? capability?.reason || 'Connect the application wallet before an ICO V3 write is eligible.'
    : !roleHeld(action) ? `ROLE_NOT_HELD: ${icoV3RequiredRole(action)} is required for this control.` : undefined;
  const run = async (action: IcoV3AdminAction) => {
    if (!token) { setOperation('UNAVAILABLE'); setDetail('Authenticated application Admin access is required.'); return; }
    if (!applicationPermits(action)) { setOperation('UNAVAILABLE'); setDetail('ADMIN_PERMISSION_DENIED: the authenticated application role does not permit this ICO V3 operation.'); return; }
    if (!capability?.writeEligible) { setOperation('UNAVAILABLE'); setDetail(capability?.reason || 'Connect the application wallet before an ICO V3 write is eligible.'); return; }
    if (!roleHeld(action)) { setOperation('UNAVAILABLE'); setDetail(`ROLE_NOT_HELD: ${icoV3RequiredRole(action)} is required for ${action}. No transaction or PENDING audit operation was created.`); return; }
    try {
      const result = await executeIcoV3AdminAction(token, action, { wallet, allowed, address: action === 'setOracle' ? oracle : recipient, timestamp: tge }, capability, (state, text) => { setOperation(state); setDetail(text || state); });
      setOperation(result.state); setDetail(result.detail || result.transactionHash || result.state); await load();
    } catch (error) { setOperation('FAILED'); setDetail(error instanceof Error ? error.message : 'ICO V3 operation failed before confirmation.'); }
  };
  if (!status?.data || !status.manifest || !status.checkpoint) return <section aria-label="Canonical ICO V3 Admin"><CanonicalSourceUnavailable reason={reason} /></section>;
  const data = status.data; const terminal = data.lifecycle === '2' || data.lifecycle === '3';
  const pausedAction: IcoV3AdminAction = data.paused ? 'unpause' : 'pause';
  const permissionFor = (action: IcoV3AdminAction) => action === 'pause' || action === 'unpause' ? 'emergency.execute' : 'ico.operate';
  const ControlCapability = ({ action }: { action: IcoV3AdminAction }) => <BlockchainCapabilityCard requiredRole={icoV3RequiredRole(action)} connectedWallet={capability?.providerWallet} authorized={writeEligible(action)} applicationPermission={permissionFor(action)} reason={writeReason(action)} />;
  const ControlButton = ({ action, disabled }: { action: IcoV3AdminAction; disabled: boolean }) => <button disabled={!writeEligible(action) || disabled} onClick={() => setPendingAction(action)} className="mt-2 rounded border border-cyan-400/50 px-3 py-2 font-bold text-cyan-100 disabled:opacity-50">Review {actionLabel(action)}</button>;
  return <section aria-label="Canonical ICO V3 Admin" className="space-y-4 rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs"><header className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-cyan-200">Canonical ICO V3</p><p className="mt-1 max-w-3xl text-slate-400">Allowlisted operational controls only. Confirmation requires Admin access, connected wallet, role, chain, bytecode, lifecycle preconditions, receipt event, and canonical indexer/API reconciliation.</p></div><button onClick={() => void load()} className="rounded-lg border border-slate-700 px-3 py-2 font-bold text-slate-100">Refresh</button></header>
    <p className="break-all text-slate-400">Chain {status.manifest.chainId} · deployment {status.manifest.deploymentVersion} · runtime {status.manifest.deploymentIdentity} · checkpoint {status.checkpoint.lastProcessedBlock} / {status.checkpoint.lastProcessedBlockHash}</p>
    <section aria-label="ICO Status" className="rounded-xl border border-slate-700 p-3"><h4 className="font-bold text-white">ICO Status</h4><div className="mt-3 grid gap-2 text-slate-300 sm:grid-cols-2 xl:grid-cols-3"><p>Lifecycle: {life(data.lifecycle)}</p><p>Allocated: {data.totalAllocated}</p><p>Inventory: {data.deploymentInventory}</p><p>Pause: {data.paused ? 'PAUSED' : 'ACTIVE'}</p><p>TGE: {data.tgeTimestamp || 'not configured'}</p><p>Current stage: {data.currentStage === '255' ? 'none' : data.currentStage}</p><p className="break-all">ICOManagerV3: {status.manifest.address}</p><p className="break-all">ABCDTokenV2: {status.manifest.abcdAddress}</p><p className="break-all">Oracle: {data.oracle.feed}</p><p className="break-all">Proceeds recipient: {data.custody.proceedsRecipient}</p><p>API health: {status.status} · reconciliation: checkpoint verified</p></div></section>
    <BlockchainActionStatus state={operation} detail={detail} />
    <div className="grid gap-3 xl:grid-cols-2">
      <section aria-label="ICO Configuration" className="space-y-3 rounded-xl border border-slate-700 p-3"><h4 className="font-bold text-white">ICO Configuration</h4><p className="text-slate-400">Eligibility, oracle, and proceeds configuration retain their exact existing contract preconditions.</p><ControlCapability action="setEligibility" /><input aria-label="Eligibility wallet" value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="Wallet address" className={field} disabled={!writeEligible('setEligibility')} /><label className="flex gap-2 text-slate-300"><input type="checkbox" checked={allowed} onChange={(event) => setAllowed(event.target.checked)} disabled={!writeEligible('setEligibility')} />Allowed</label><ControlButton action="setEligibility" disabled={data.paused || operation === 'PENDING' || operation === 'SUBMITTED'} />
        <div className="border-t border-slate-800 pt-3"><ControlCapability action="setOracle" /><input aria-label="BNB USD oracle address" value={oracle} onChange={(event) => setOracle(event.target.value)} placeholder="BNB/USD feed address" className={field} disabled={!writeEligible('setOracle')} /><ControlButton action="setOracle" disabled={!data.paused || operation === 'PENDING' || operation === 'SUBMITTED'} /></div>
        <div className="border-t border-slate-800 pt-3"><ControlCapability action="setProceedsRecipient" /><input aria-label="Proceeds recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Recipient address" className={field} disabled={!writeEligible('setProceedsRecipient')} /><ControlButton action="setProceedsRecipient" disabled={!data.paused || operation === 'PENDING' || operation === 'SUBMITTED'} /></div>
      </section>
      <section aria-label="ICO Finalization" className="space-y-3 rounded-xl border border-slate-700 p-3"><h4 className="font-bold text-white">ICO Finalization</h4><p className="text-slate-400">TGE and terminal lifecycle actions remain limited to the existing ICO V3 contract rules.</p><ControlCapability action="configureTge" /><input aria-label="TGE timestamp" value={tge} onChange={(event) => setTge(event.target.value)} placeholder="Unix TGE timestamp" className={field} disabled={!writeEligible('configureTge')} /><div className="flex flex-wrap gap-2"><ControlButton action="configureTge" disabled={data.paused || terminal || operation === 'PENDING' || operation === 'SUBMITTED'} /><ControlButton action="finalize" disabled={data.paused || terminal || operation === 'PENDING' || operation === 'SUBMITTED'} /><ControlButton action="cancel" disabled={data.paused || terminal || operation === 'PENDING' || operation === 'SUBMITTED'} /></div><div className="border-t border-slate-800 pt-3"><ControlCapability action="withdrawProceeds" /><ControlButton action="withdrawProceeds" disabled={data.paused || data.lifecycle !== '2' || operation === 'PENDING' || operation === 'SUBMITTED'} /></div></section>
      <section aria-label="ICO Security" className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><h4 className="font-bold text-amber-100">Security</h4><p className="text-amber-100/80">Emergency pause is separate from ordinary configuration. It never bypasses the module-local PAUSER_ROLE.</p><ControlCapability action={pausedAction} /><ControlButton action={pausedAction} disabled={operation === 'PENDING' || operation === 'SUBMITTED'} /></section>
    </div>
    <AdminWriteConfirmationDialog open={Boolean(pendingAction)} action={pendingAction ? actionLabel(pendingAction) : 'ICO V3 action'} target="ICOManagerV3" connectedWallet={capability?.providerWallet} requiredRole={pendingAction ? icoV3RequiredRole(pendingAction) : 'Role unavailable'} expectedEffect={pendingAction ? expectedEffect[pendingAction] : 'No action selected.'} busy={operation === 'PENDING' || operation === 'SUBMITTED'} onCancel={() => setPendingAction(null)} onConfirm={() => { const action = pendingAction; setPendingAction(null); if (action) void run(action); }} />
  </section>;
};
