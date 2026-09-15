import React, { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { getFranchiseWalletSnapshot, type FranchiseCertificate, type FranchiseEvent } from '../Services/franchiseRegistryV2';

type Snapshot = Awaited<ReturnType<typeof getFranchiseWalletSnapshot>>;
const empty: Snapshot = { available: false, status: 'UNAVAILABLE', franchises: [], history: {} };

/** Canonical Phase 9 view. It deliberately exposes no price, purchase, listing, revenue, or Legion controls. */
export const FranchiseRegistryDashboard: React.FC = () => {
  const wallet = useWallet(); const [snapshot, setSnapshot] = useState<Snapshot>(empty); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { setSnapshot(wallet.address ? await getFranchiseWalletSnapshot(wallet.address) : empty); } catch (reason) { setSnapshot(empty); setError(reason instanceof Error ? reason.message : 'Unable to read canonical Franchise registry state.'); } finally { setLoading(false); } }, [wallet.address]);
  useEffect(() => { void refresh(); }, [refresh]);
  return <section aria-label="Canonical Franchise registry dashboard" className="mx-auto max-w-5xl space-y-5 rounded-3xl border border-teal-500/30 bg-slate-900 p-6 shadow-xl">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4"><div><p className="text-xs font-black uppercase tracking-wide text-teal-300">Canonical Phase 9 foundation</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-white"><Building2 className="h-5 w-5" /> Franchise assignments</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Administrative business-unit assignments only. They convey no legal territory title, price, purchase, commission, Treasury, Lending, Referral, Legion, or marketplace right.</p></div><button onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 disabled:opacity-50"><RefreshCcw className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></header>
    {snapshot.source && <p className="break-all text-xs text-slate-500">Registry {snapshot.source.registryAddress} · NFT {snapshot.source.nftAddress} · chain {snapshot.source.chainId} · indexer checkpoint {snapshot.checkpoint || 'pending'}</p>}
    {error && <Notice text={error} />}
    {!wallet.address && <Notice text="Connect a wallet to read its canonical Franchise assignments." />}
    {wallet.address && !wallet.isCorrectNetwork && <Notice text="Switch MetaMask to Hardhat Local (31337) before reading local Franchise state." />}
    {wallet.address && !snapshot.available && <Notice text={snapshot.reason || 'The canonical Franchise registry is not deployed or indexed for this local runtime.'} />}
    {snapshot.available && snapshot.franchises.length === 0 && <p className="rounded-xl border border-slate-700 bg-slate-950/60 p-5 text-sm text-slate-300">No canonical Franchise assignments are indexed for this wallet.</p>}
    {snapshot.franchises.map((franchise) => <FranchiseCard key={franchise.tokenId} franchise={franchise} events={snapshot.history[franchise.tokenId] || []} />)}
    <aside className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-xs text-slate-400">Transfers, when enabled by an authorized Registry workflow, remain controlled. This dashboard does not expose public purchase, marketplace listing, KYC/KYB, commercial terms, or financial benefits.</aside>
  </section>;
};

const FranchiseCard = ({ franchise, events }: { franchise: FranchiseCertificate; events: FranchiseEvent[] }) => <article className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{franchise.level} assignment · #{franchise.tokenId}</p><h3 className="mt-1 text-lg font-black text-white">Franchise registry record</h3></div><span className="rounded-full border border-teal-400/40 px-3 py-1 text-xs font-bold text-teal-200">{franchise.status}</span></div><dl className="grid gap-3 text-xs sm:grid-cols-2"><Field label="Current operator / owner" value={franchise.owner} /><Field label="Territory key" value={franchise.territoryKey} /><Field label="Operator version" value={franchise.operatorVersion} /><Field label="Metadata URI" value={franchise.metadataURI} /></dl><div className="border-t border-slate-800 pt-3"><p className="text-xs font-black uppercase tracking-wide text-slate-400">On-chain provenance</p>{events.length === 0 ? <p className="mt-2 text-xs text-slate-500">No confirmed indexed event is available yet.</p> : <ol className="mt-2 space-y-2">{events.map((event) => <li key={`${event.evidence.transactionHash}:${event.evidence.logIndex}`} className="break-all text-xs text-slate-400"><p>{event.eventName} · block {event.evidence.blockNumber} · {event.evidence.transactionHash}</p>{event.args && <p className="mt-1 text-slate-500">{JSON.stringify(event.args)}</p>}</li>)}</ol>}</div></article>;
const Field = ({ label, value }: { label: string; value: string }) => <div><dt className="uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-all text-slate-200">{value}</dd></div>;
const Notice = ({ text }: { text: string }) => <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100"><ShieldAlert className="mr-2 inline h-4 w-4" />{text}</div>;
