import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCcw, ShieldCheck } from 'lucide-react';
import { executeEmergencyPauseAction, getCanonicalAdminSnapshot, getConnectedAdminRoleStatus, getModulePauseState, permittedEmergencyAction, type AdminSnapshot, type RoleStatus } from '../Services/canonicalAdmin';
import { useAuth } from '../Context/AuthContext';
import { CanonicalIcoV3Admin } from './CanonicalIcoV3Admin';
import { CanonicalLegionNFTV2Admin } from './CanonicalLegionNFTV2Admin';
import { CanonicalFranchiseV2Admin } from './CanonicalFranchiseV2Admin';

const empty: AdminSnapshot = { available: false, status: 'UNAVAILABLE', modules: [], history: [] };
const short = (value: string) => value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;

export const CanonicalAdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(empty);
  const [roles, setRoles] = useState<RoleStatus[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [pausedByModule, setPausedByModule] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [transactionState, setTransactionState] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!token) { setLoading(false); setReason('Authenticated administrator session is required.'); return; }
    setLoading(true); setReason(null);
    try {
      const next = await getCanonicalAdminSnapshot(token);
      setSnapshot(next);
      const onChain = await getConnectedAdminRoleStatus(next.modules);
      setWallet(onChain.wallet); setRoles(onChain.roles);
      const pauseStates = await Promise.all(next.modules.map(async (module) => [module.name, await getModulePauseState(module)] as const));
      setPausedByModule(Object.fromEntries(pauseStates));
    } catch (error) { setSnapshot(empty); setRoles([]); setReason(error instanceof Error ? error.message : 'Canonical Admin API is unavailable.'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void refresh(); }, [refresh]);
  const submitEmergencyAction = async (module: AdminSnapshot['modules'][number]) => {
    const role = roles.find((entry) => entry.module === module.name);
    const paused = pausedByModule[module.name];
    const action = permittedEmergencyAction(module, role, Boolean(paused));
    if (!action || !token) return;
    setTransactionState(`Waiting for wallet confirmation to ${action} ${module.name}…`);
    try {
      const result = await executeEmergencyPauseAction(module, role, Boolean(paused), token);
      setTransactionState(result.indexerObserved ? `Confirmed on chain and indexed: ${result.transactionHash}` : `Confirmed on chain — waiting for indexer: ${result.transactionHash}`);
      await refresh();
    } catch (error) { setTransactionState(`Action failed: ${error instanceof Error ? error.message : 'unknown error'}`); }
  };

  return <section aria-label="Canonical Phase 12 Admin" className="space-y-5 rounded-3xl border border-cyan-500/30 bg-slate-900 p-6">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4"><div><p className="text-xs font-black uppercase tracking-wide text-cyan-300">Canonical Phase 12</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-white"><ShieldCheck className="h-6 w-6" />Administration console</h2><p className="mt-1 text-sm text-slate-400">Authenticated visibility and module-local wallet capability checks. This dashboard never grants a blockchain role.</p></div><button onClick={() => void refresh()} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100"><RefreshCcw className="mr-2 inline h-4 w-4" />Refresh</button></header>
    {loading ? <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">Loading canonical manifests and indexed provenance…</p> : reason || !snapshot.available ? <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">{reason || 'Canonical Admin state is unavailable.'}</p> : <>
      <p className="break-all text-xs text-slate-400">Connected wallet: {wallet || 'Not connected'} · permissions are read from the current chain and may be unavailable if the wallet is on another network.</p>
      {transactionState && <p role="status" className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">{transactionState}</p>}
      <div className="grid gap-3 md:grid-cols-2">{snapshot.modules.filter((module) => module.name !== 'ICO').map((module) => { const role = roles.find((entry) => entry.module === module.name); const paused = pausedByModule[module.name]; const action = permittedEmergencyAction(module, role, Boolean(paused)); return <article key={module.name} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs"><div className="flex items-center justify-between gap-2"><strong className="text-white">{module.name}</strong><span className={module.available ? 'text-emerald-300' : 'text-amber-300'}>{module.status}</span></div>{module.available ? <><p className="mt-2 text-slate-400">Chain {module.source.chainId} · {module.source.deploymentVersion}</p>{module.source.deploymentIdentity && <p className="mt-1 break-all text-slate-500">Runtime identity: {module.source.deploymentIdentity}</p>}{paused !== null && paused !== undefined && <p className={paused ? 'mt-1 text-amber-200' : 'mt-1 text-emerald-300'}>Emergency state: {paused ? 'PAUSED' : 'ACTIVE'}</p>}<p className={module.indexer?.available ? 'mt-1 text-emerald-300' : 'mt-1 text-amber-200'}>{module.indexer?.available ? `Indexer checkpoint: ${module.indexer.checkpoint?.lastProcessedBlock || 'recorded'}` : 'Indexer: unavailable — canonical event state is fail-closed.'}</p><div className="mt-2 space-y-1 text-slate-300">{Object.entries(module.contracts || {}).map(([name, entry]) => entry?.address ? <p key={name}>{name}: <span className="font-mono">{short(entry.address)}</span></p> : null)}</div><p className="mt-2 break-words text-cyan-200">{module.capabilities.join(' · ')}</p>{role?.roles.map((item) => <p key={item.label} className={item.held ? 'mt-1 text-emerald-300' : 'mt-1 text-slate-500'}>{item.label}: {item.held ? 'HELD' : 'not held'}</p>)}{action && <button onClick={() => void submitEmergencyAction(module)} className="mt-3 rounded-lg border border-amber-400/50 px-3 py-2 font-bold text-amber-100">Emergency {action}</button>}</> : <p className="mt-2 text-amber-100">{module.reason}</p>}</article>; })}</div>
      <section aria-label="Canonical Admin History" className="space-y-3 border-t border-slate-800 pt-5"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><h3 className="font-black text-white">Canonical admin provenance</h3></div><p className="text-xs text-slate-400">Underlying module events only, ordered by block, transaction index, and log index. No synthetic administrative activity is shown.</p>{snapshot.history.length === 0 ? <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">No indexed canonical module event is available.</p> : <div className="space-y-2">{snapshot.history.map((event) => <article key={`${event.module}-${event.transactionHash}-${event.logIndex}`} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong className="text-cyan-200">{event.module}: {event.eventName}</strong><span className="text-slate-400">Block {event.blockNumber} · log {event.logIndex}</span></div><p className="mt-1 font-mono text-slate-400">{event.transactionHash}</p></article>)}</div>}</section>
      {snapshot.modules.some((module) => module.name === 'Legion' && module.available) && <CanonicalLegionNFTV2Admin />}
      <CanonicalFranchiseV2Admin />
      {snapshot.modules.some((module) => module.name === 'ICO' && module.available) && <CanonicalIcoV3Admin />}
    </>}
  </section>;
};
