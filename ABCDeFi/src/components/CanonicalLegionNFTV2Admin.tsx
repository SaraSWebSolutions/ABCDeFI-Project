import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, ShieldAlert } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { getLegionNFTV2Availability, getLegionNFTV2Territory, getLegionNFTV2TransferRequest, hasLegionNFTV2AdminCapability, legionNFTV2ErrorMessage, type LegionNFTV2Availability, type LegionNFTV2Territory, type LegionNFTV2TransferRequest } from '../Services/legionNFTV2';
import { executeLegionAdminAction, type LegionAdminAction, type LegionAdminParams } from '../Services/legionNFTV2Admin';
import { useAuth } from '../Context/AuthContext';
import type { AdminWalletCapability, RoleStatus } from '../Services/canonicalAdmin';
import type { AdminCapability } from '../Services/adminCapability';
import type { AdminOperationState } from '../Services/canonicalAdmin';
import { AdminWriteConfirmationDialog, BlockchainActionStatus, BlockchainCapabilityCard, CanonicalSourceUnavailable } from './AdminControlPlanePrimitives';

const unavailable: LegionNFTV2Availability = { available: false, status: 'UNAVAILABLE', paused: false };

/**
 * Canonical Phase 8 administrative read/write surface. Every record comes
 * from the hash-verified LegionNFTV2 API and every write remains role-gated
 * by LegionNFTV2 itself. It deliberately provides no public mint or market.
 */
export const CanonicalLegionNFTV2Admin: React.FC<{ capability?: AdminWalletCapability | null; roleStatus?: RoleStatus; applicationCapability?: AdminCapability | null }> = ({ capability = null, roleStatus, applicationCapability = null }) => {
  const wallet = useWallet();
  const { token } = useAuth();
  const [availability, setAvailability] = useState<LegionNFTV2Availability>(unavailable);
  const [isLegionAdmin, setIsLegionAdmin] = useState(false);
  const [tokenId, setTokenId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [territory, setTerritory] = useState<LegionNFTV2Territory | null>(null);
  const [request, setRequest] = useState<LegionNFTV2TransferRequest | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [population, setPopulation] = useState('');
  const [metadataURI, setMetadataURI] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<AdminOperationState | null>(null);
  const [pendingAction, setPendingAction] = useState<{ key: string; action: LegionAdminAction; params: LegionAdminParams; effect: string } | null>(null);

  const refreshCapability = useCallback(async () => {
    try {
      const next = await getLegionNFTV2Availability();
      setAvailability(next);
      const reportedRole = roleStatus?.roles.find((entry) => entry.label === 'LEGION_ADMIN_ROLE')?.held;
      const onChainRole = reportedRole ?? Boolean(wallet.address && wallet.isCorrectNetwork && next.available && await hasLegionNFTV2AdminCapability(wallet.address, next));
      setIsLegionAdmin(Boolean(applicationCapability?.permissions.includes('legion.operate') && capability?.writeEligible && onChainRole));
    } catch (error) {
      setAvailability(unavailable); setIsLegionAdmin(false); setMessage(legionNFTV2ErrorMessage(error));
    }
  }, [applicationCapability, capability?.writeEligible, roleStatus, wallet.address, wallet.isCorrectNetwork]);
  useEffect(() => { void refreshCapability(); }, [refreshCapability]);

  const loadTerritory = async () => {
    setBusy('territory'); setMessage(null);
    try {
      const result = await getLegionNFTV2Territory(tokenId);
      setTerritory(result); setDisplayName(result.displayName); setPopulation(result.population); setMetadataURI(result.metadataURI);
    } catch (error) { setTerritory(null); setMessage(legionNFTV2ErrorMessage(error)); }
    finally { setBusy(null); }
  };
  const loadRequest = async () => {
    setBusy('request'); setMessage(null);
    try { setRequest(await getLegionNFTV2TransferRequest(requestId)); }
    catch (error) { setRequest(null); setMessage(legionNFTV2ErrorMessage(error)); }
    finally { setBusy(null); }
  };
  const submit = async (key: string, action: LegionAdminAction, params: LegionAdminParams) => {
    if (!isLegionAdmin || !token || busy) return;
    setBusy(key); setMessage(null); setOperation('PENDING');
    try {
      const result = await executeLegionAdminAction(token, action, params, capability, (state, detail) => { setOperation(state); setMessage(`${state}: ${detail || state}`); });
      setOperation(result.state);
      setMessage(result.state === 'CONFIRMED' ? `CONFIRMED: receipt, ${action === 'updateMetadata' ? 'territory' : action === 'pause' || action === 'unpause' ? 'pause state' : 'transfer request'} API reconciliation, Legion indexer observation, and Admin audit are complete.` : `${result.state}: canonical reconciliation is incomplete; no success is reported.`);
      if (result.state === 'CONFIRMED') {
        await refreshCapability();
        if ((key === 'approve' || key === 'invalidate') && requestId) await loadRequest();
        if (key === 'metadata' && tokenId) await loadTerritory();
      }
    } catch (error) { setOperation('FAILED'); setMessage(legionNFTV2ErrorMessage(error)); }
    finally { setBusy(null); }
  };

  return <section aria-label="Canonical LegionNFTV2 administration" className="space-y-4 border-t border-slate-800 pt-5">
    <header><p className="text-xs font-black uppercase tracking-wide text-cyan-300">Canonical Phase 8 administration</p><h3 className="mt-1 text-lg font-black text-white">Legion territory controls</h3><p className="mt-1 text-xs text-slate-400">Reads require a hash-verified canonical checkpoint. Controls appear only for the connected wallet holding the live <code>LEGION_ADMIN_ROLE</code>; the contract independently enforces that role.</p></header>
    {!availability.available ? <CanonicalSourceUnavailable reason={availability.reason || 'Canonical LegionNFTV2 state is unavailable; no administration control is exposed.'} /> : <BlockchainCapabilityCard requiredRole="LEGION_ADMIN_ROLE" connectedWallet={wallet.address} authorized={isLegionAdmin} applicationPermission="legion.operate" reason={!token ? 'An authenticated Admin session is required before any Legion control is exposed.' : capability?.reason || 'The connected wallet has no verified Legion administrator capability. Read lookup remains available; writes are hidden.'} />}
    <BlockchainActionStatus state={operation} detail={message} />
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4"><h4 className="font-bold text-white">Territory lookup and metadata</h4><div className="flex gap-2"><input value={tokenId} onChange={(event) => setTokenId(event.target.value)} inputMode="numeric" placeholder="Territory token ID" className="field flex-1" /><button disabled={busy !== null} onClick={() => void loadTerritory()} className="rounded-lg border border-slate-600 px-3 text-xs font-bold text-slate-100 disabled:opacity-50"><Search className="mr-1 inline h-3 w-3" />Lookup</button></div>{territory && <><dl className="grid gap-2 text-xs sm:grid-cols-2"><Field label="Level" value={territory.level} /><Field label="Owner" value={territory.owner} /><Field label="Parent" value={territory.parentId} /><Field label="Identifier" value={territory.canonicalIdentifier} /><Field label="Metadata URI" value={territory.metadataURI} /></dl>{isLegionAdmin && token && <div className="space-y-2 border-t border-slate-800 pt-3"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" className="field w-full" /><input value={population} onChange={(event) => setPopulation(event.target.value)} inputMode="numeric" placeholder="Informational population" className="field w-full" /><input value={metadataURI} onChange={(event) => setMetadataURI(event.target.value)} placeholder="ipfs:// metadata URI" className="field w-full" /><button disabled={busy !== null} onClick={() => setPendingAction({ key: 'metadata', action: 'updateMetadata', params: { tokenId: territory.tokenId, displayName, population, metadataURI }, effect: 'Updates only the selected territory metadata through the allowlisted LegionNFTV2 method.' })} className="rounded-lg border border-cyan-400/60 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50">{busy === 'metadata' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Review metadata update</button></div>}</>}</article>
      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4"><h4 className="font-bold text-white">Controlled transfer administration</h4><div className="flex gap-2"><input value={requestId} onChange={(event) => setRequestId(event.target.value)} inputMode="numeric" placeholder="Transfer request ID" className="field flex-1" /><button disabled={busy !== null} onClick={() => void loadRequest()} className="rounded-lg border border-slate-600 px-3 text-xs font-bold text-slate-100 disabled:opacity-50"><Search className="mr-1 inline h-3 w-3" />Lookup</button></div>{request && <><dl className="grid gap-2 text-xs sm:grid-cols-2"><Field label="Token" value={`#${request.tokenId}`} /><Field label="Current owner" value={request.currentOwner} /><Field label="Proposed owner" value={request.proposedOwner} /><Field label="State" value={request.active ? request.approved ? 'ACTIVE / APPROVED' : 'ACTIVE / AWAITING APPROVAL' : 'INACTIVE'} /></dl>{isLegionAdmin && token && request.active && <div className="flex flex-wrap gap-2">{!request.approved && <button disabled={busy !== null} onClick={() => setPendingAction({ key: 'approve', action: 'approveTransfer', params: { requestId: request.requestId }, effect: 'Approves only the selected active controlled-transfer request.' })} className="rounded-lg border border-cyan-400/60 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50">{busy === 'approve' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Review transfer approval</button>}<button disabled={busy !== null} onClick={() => setPendingAction({ key: 'invalidate', action: 'invalidateTransfer', params: { requestId: request.requestId }, effect: 'Invalidates only the selected active controlled-transfer request.' })} className="rounded-lg border border-amber-400/60 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-50">{busy === 'invalidate' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Review transfer invalidation</button></div>}</>}</article>
    </div>
    <AdminWriteConfirmationDialog open={Boolean(pendingAction)} action={pendingAction?.action || 'Legion action'} target="LegionNFTV2" connectedWallet={wallet.address} requiredRole="LEGION_ADMIN_ROLE" expectedEffect={pendingAction?.effect || 'No action selected.'} busy={busy !== null} onCancel={() => setPendingAction(null)} onConfirm={() => { const pending = pendingAction; setPendingAction(null); if (pending) void submit(pending.key, pending.action, pending.params); }} />
  </section>;
};

const Field = ({ label, value }: { label: string; value: string }) => <div><dt className="uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-all text-slate-200">{value}</dd></div>;
