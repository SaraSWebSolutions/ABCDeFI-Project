import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, ShieldCheck } from 'lucide-react';
import { formatUnits } from 'ethers';
import { getTreasuryV2Snapshot, type TreasuryHistoryEvent, type TreasurySnapshot } from '../Services/treasuryV2';

const empty: TreasurySnapshot = { available: false, status: 'UNAVAILABLE', assets: [], history: [] };
const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-8)}`;

const HistoryRow: React.FC<{ event: TreasuryHistoryEvent }> = ({ event }) => <article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs" data-testid="treasury-history-event">
  <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-cyan-200">{event.eventName}</strong><span className="text-slate-400">Block {event.blockNumber} · log {event.logIndex}</span></div>
  <p className="mt-2 break-all text-slate-300" title={event.transactionHash}>Transaction: {shortHash(event.transactionHash)}</p>
  <div className="mt-2 space-y-1 break-all text-slate-400">{Object.entries(event.args || {}).map(([key, value]) => <p key={key}>{key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>)}</div>
  {event.indexedAt && <p className="mt-2 text-slate-500">Indexed: {event.indexedAt}</p>}
</article>;

export const TreasuryV2Dashboard: React.FC = () => {
  const [data, setData] = useState<TreasurySnapshot>(empty);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); try { setData(await getTreasuryV2Snapshot()); } catch (error) { setData({ ...empty, reason: error instanceof Error ? error.message : 'Treasury API unavailable.' }); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <section aria-label="Canonical TreasuryV2" className="mx-auto max-w-4xl space-y-4 rounded-3xl border border-cyan-500/30 bg-slate-900 p-6">
    <header className="flex justify-between gap-4 border-b border-slate-800 pb-4"><div><p className="text-xs font-black uppercase tracking-wide text-cyan-300">Canonical Phase 11 foundation</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-white"><ShieldCheck className="h-5 w-5" />Treasury custody</h2><p className="mt-1 text-sm text-slate-400">Indexed configured ERC20 balances only. No allocation, distribution, yield, Reserve routing, or public withdrawal is available.</p></div><button onClick={() => void refresh()} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100"><RefreshCcw className="mr-2 inline h-4 w-4" />Refresh</button></header>
    {loading ? <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">Loading canonical Treasury state…</p> : !data.available ? <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">{data.reason || 'Canonical TreasuryV2 indexer is unavailable.'}</p> : <>
      <p className="break-all text-xs text-slate-500">Treasury {data.source?.treasuryAddress} · ABCD {data.source?.abcdAddress} · chain {data.source?.chainId} · checkpoint {data.checkpoint}</p>
      <div className="grid gap-3 sm:grid-cols-2">{data.assets.map((asset) => <article key={asset.asset} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs"><p className="break-all text-slate-400">{asset.asset}</p><p className="mt-2 font-black text-white">{formatUnits(BigInt(asset.accountedBalance), 18)} units</p><p className="mt-1 text-emerald-300">{asset.supported ? 'Configured' : 'Disabled'}</p></article>)}</div>
      <section aria-label="Treasury History" className="space-y-3 border-t border-slate-800 pt-5"><div><h3 className="text-lg font-black text-white">Treasury History</h3><p className="text-xs text-slate-400">Canonical indexed on-chain events, ordered by block and log index.</p></div>{data.history.length === 0 ? <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">No canonical Treasury events are indexed for this deployment.</p> : <div className="space-y-2">{data.history.map((event) => <HistoryRow key={`${event.transactionHash}-${event.logIndex}`} event={event} />)}</div>}</section>
    </>}
  </section>;
};
