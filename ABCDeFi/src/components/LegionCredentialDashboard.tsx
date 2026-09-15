import React, { useEffect, useState } from 'react';
import { BadgeCheck, Clock3, ExternalLink, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { getLegionCredentialSnapshot, type LegionCredentialSnapshot } from '../Services/legionCredentialV2';

const emptySnapshot: LegionCredentialSnapshot = { available: false, status: 'UNAVAILABLE', credentials: [], history: {} };

function statusStyle(status: string) {
  if (status === 'ACTIVE') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'SUSPENDED') return 'border-amber-400/40 bg-amber-500/10 text-amber-100';
  return 'border-rose-400/40 bg-rose-500/10 text-rose-100';
}

/**
 * Canonical LegionCredentialV2 read surface. It intentionally has no public
 * minting, transfer, approval, marketplace, or territorial controls.
 */
export const LegionCredentialDashboard: React.FC = () => {
  const wallet = useWallet();
  const [snapshot, setSnapshot] = useState<LegionCredentialSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      if (!wallet.address) {
        setSnapshot({ ...emptySnapshot, status: 'UNAVAILABLE', reason: 'Connect a wallet to look up a canonical Legion credential.' });
        return;
      }
      setSnapshot(await getLegionCredentialSnapshot(wallet.address));
    } catch (reason) {
      setSnapshot(emptySnapshot);
      setError(reason instanceof Error ? reason.message : 'Legion credential state is unavailable.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [wallet.address]);

  return (
    <section aria-label="Canonical Legion credential dashboard" className="mx-auto max-w-4xl space-y-5 rounded-3xl border border-indigo-500/30 bg-slate-900 p-6 shadow-xl">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-indigo-300"><BadgeCheck className="h-4 w-4" /> Canonical V2 registry</div>
          <h2 className="text-2xl font-black text-white">Legion Credential</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">A non-financial personal/ecosystem status credential. It grants no lending, referral, governance, marketplace, Treasury, collateral, Franchise, or territorial rights.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCcw className="h-4 w-4" /> {loading ? 'Refreshing…' : 'Refresh'}</button>
      </header>

      {error && <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100"><ShieldAlert className="mr-2 inline h-4 w-4" />{error}</div>}
      {!error && snapshot.status === 'UNDEPLOYED' && <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100"><ShieldAlert className="mr-2 inline h-4 w-4" />Legion credential not deployed. {snapshot.reason}</div>}
      {!error && snapshot.status === 'UNAVAILABLE' && <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300"><Clock3 className="mr-2 inline h-4 w-4" />{snapshot.reason || 'Canonical Legion credential indexer is unavailable.'}</div>}
      {!error && snapshot.status === 'AVAILABLE' && snapshot.credentials.length === 0 && <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-5 text-sm text-slate-300"><ShieldCheck className="mr-2 inline h-4 w-4 text-slate-400" />No Legion credential exists for this wallet.</div>}

      {snapshot.status === 'AVAILABLE' && snapshot.credentials.map((credential) => (
        <article key={credential.tokenId} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Credential #{credential.tokenId}</p><p className="mt-1 text-lg font-black text-white">{credential.category}</p></div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyle(credential.status)}`}>{credential.status}</span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Current wallet</dt><dd className="mt-1 break-all font-mono text-slate-200">{credential.owner}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Active</dt><dd className="mt-1 font-bold text-slate-200">{credential.active ? 'Yes' : 'No'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-slate-500">Metadata URI</dt><dd className="mt-1 break-all"><a className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200" href={credential.metadataURI} target="_blank" rel="noreferrer">{credential.metadataURI}<ExternalLink className="h-3 w-3" /></a></dd></div>
          </dl>
          <div className="border-t border-slate-800 pt-3"><h3 className="text-xs font-black uppercase tracking-wide text-slate-400">Canonical lifecycle history</h3>
            {(snapshot.history[credential.tokenId] || []).length === 0 ? <p className="mt-2 text-xs text-slate-500">No indexed lifecycle events are currently available.</p> : <ol className="mt-2 space-y-2">{(snapshot.history[credential.tokenId] || []).map((event) => <li key={`${event.transactionHash}:${event.logIndex}`} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-300"><span className="font-bold text-slate-100">{event.eventName}</span><span className="ml-2">block {event.blockNumber}</span><span className="ml-2 break-all font-mono text-slate-500">{event.transactionHash}</span></li>)}</ol>}
          </div>
        </article>
      ))}

      <footer className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">This is a read-only canonical registry view. Public minting and all credential lifecycle actions are intentionally unavailable here; a future restricted administrator surface must verify the on-chain role and a successful transaction receipt before reconciliation.</footer>
    </section>
  );
};
