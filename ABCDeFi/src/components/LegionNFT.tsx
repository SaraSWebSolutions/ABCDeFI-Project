import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPinned, RefreshCw, ShieldCheck } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { getLegionSnapshot, LegionRecord, LegionSnapshot, legionErrorMessage, mintLegion } from '../Services/legion';
import { MetadataReadResult, readNftMetadata } from '../Services/nftMetadata';

type TransactionState = 'idle' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

const emptyMintForm = { recipient: '', name: '', territory: '', level: '0', parentId: '0', character: '', metadataURI: '', population: '', treasuryShareBps: '' };
const levelOptions = ['Continent', 'Country', 'State', 'District'];

const formatTimestamp = (value: string) => {
  if (!/^\d+$/.test(value)) return 'Unavailable';
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
};

export const LegionNFT: React.FC = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [snapshot, setSnapshot] = useState<LegionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionState, setTransactionState] = useState<TransactionState>('idle');
  const [transactionMessage, setTransactionMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMintForm);

  const refresh = useCallback(async () => {
    if (!address || !isConnected || !isCorrectNetwork) { setSnapshot(null); setError(null); return; }
    setLoading(true); setError(null);
    try { setSnapshot(await getLegionSnapshot(address)); }
    catch (reason) { setSnapshot(null); setError(legionErrorMessage(reason)); }
    finally { setLoading(false); }
  }, [address, isConnected, isCorrectNetwork]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setTransactionState('idle'); setTransactionHash(null); setTransactionMessage('');
    setForm((current) => ({ ...current, recipient: address || '' }));
  }, [address]);

  const submitMint = async () => {
    if (transactionState === 'awaiting-wallet' || transactionState === 'confirming') return;
    if (!address || !isConnected) { setTransactionState('error'); setTransactionMessage('Connect the authorized Legion minter wallet first.'); return; }
    if (!isCorrectNetwork) { setTransactionState('error'); setTransactionMessage('Switch to Hardhat Local (31337) before minting.'); return; }
    if (!snapshot?.isMinter) { setTransactionState('error'); setTransactionMessage('The connected wallet does not have MINTER_ROLE on LegionNFT.'); return; }
    setTransactionState('awaiting-wallet'); setTransactionHash(null); setTransactionMessage('Confirm the Legion certificate mint in MetaMask.');
    try {
      const result = await mintLegion({ ...form, level: Number(form.level) }, (hash, stage) => {
        setTransactionHash(hash); setTransactionState('confirming'); setTransactionMessage(`${stage} submitted. Waiting for confirmation…`);
      });
      await refresh(); setTransactionState('success'); setTransactionMessage(`Legion certificate #${result.tokenId || 'confirmed'} minted on-chain.`);
      setForm({ ...emptyMintForm, recipient: address });
    } catch (reason) {
      setTransactionState('error'); setTransactionMessage(legionErrorMessage(reason));
    }
  };

  return <section className="space-y-6" aria-label="Legion NFT">
    <header className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Real on-chain territory certificate</p><h2 className="mt-1 flex items-center gap-2 text-xl font-black text-white"><MapPinned className="h-5 w-5 text-cyan-400" /> Legion NFTs</h2><p className="mt-1 max-w-3xl text-xs text-slate-400">Ownership, hierarchy, territory metadata, and token URI are read from the canonical LegionNFT contract. This Phase 1 flow is role-protected issuance only; it does not create payment, revenue, governance, or marketplace rights.</p></div><button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
    </header>
    {!isConnected && <Notice kind="error" message="Connect a wallet to read LegionNFT ownership." />}
    {isConnected && !isCorrectNetwork && <Notice kind="error" message="Switch to Hardhat Local (31337) to use LegionNFT." />}
    {error && <Notice kind="error" message={error} />}
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">Your Legion certificates</h3><p className="mt-1 text-xs text-slate-400">Contract: <span className="break-all font-mono">{snapshot?.contractAddress || 'Unavailable'}</span></p>{snapshot?.paused && <p className="mt-1 text-xs font-semibold text-amber-300">Issuance is paused on the current deployment.</p>}</div>{snapshot?.isMinter && <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300"><ShieldCheck className="h-3.5 w-3.5" /> MINTER_ROLE</span>}</div>{loading && <p className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading canonical LegionNFT state…</p>}{!loading && snapshot?.legions.length === 0 && <p className="mt-4 text-sm text-slate-500">No Legion NFTs are owned by this wallet on the current deployment.</p>}<div className="mt-4 grid gap-4 lg:grid-cols-2">{snapshot?.legions.map((legion) => <LegionCard key={legion.tokenId} legion={legion} />)}</div></section>
    {snapshot?.isMinter && <section className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-5"><h3 className="font-bold text-white">Issue a Legion certificate</h3><p className="mt-1 text-xs text-slate-400">The parent must follow the enforced Continent → Country → State → District hierarchy. No payment is submitted with this transaction.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{[['recipient', 'Recipient wallet'], ['name', 'Certificate name'], ['territory', 'Territory'], ['parentId', 'Parent token ID (0 for Continent)'], ['character', 'Character designation'], ['metadataURI', 'Metadata URI'], ['population', 'Population'], ['treasuryShareBps', 'Recorded treasury share BPS']].map(([field, label]) => <label key={field} className="text-xs text-slate-400">{label}<input value={(form as Record<string, string>)[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>)}<label className="text-xs text-slate-400">Hierarchy level<select value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value, parentId: event.target.value === '0' ? '0' : current.parentId === '0' ? '' : current.parentId }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{levelOptions.map((name, index) => <option key={name} value={index}>{index}: {name}</option>)}</select></label></div><button onClick={() => void submitMint()} disabled={snapshot.paused || transactionState === 'awaiting-wallet' || transactionState === 'confirming'} className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Mint Legion certificate</button></section>}
    {transactionState !== 'idle' && <Notice kind={transactionState === 'error' ? 'error' : transactionState === 'success' ? 'success' : 'pending'} message={transactionMessage} hash={transactionHash} />}
  </section>;
};

const LegionCard = ({ legion }: { legion: LegionRecord }) => <article className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200"><div className="flex justify-between gap-3"><div><p className="font-bold text-white">#{legion.tokenId} · {legion.name}</p><p className="mt-1 text-slate-400">{legion.level} · {legion.territory}</p></div><span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{legion.character}</span></div><dl className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2"><Field label="Current owner" value={legion.owner} /><Field label="Parent token" value={legion.parentId === '0' ? 'None (root)' : `#${legion.parentId}`} /><Field label="Children" value={legion.children.length ? legion.children.map((id) => `#${id}`).join(', ') : 'None'} /><Field label="Population" value={legion.population} /><Field label="Recorded treasury share" value={`${legion.treasuryShareBps} bps`} /><Field label="Issued" value={formatTimestamp(legion.createdAt)} /><Field label="Metadata URI" value={legion.metadataUri || 'Unavailable'} /></dl><MetadataPreview uri={legion.metadataUri} /></article>;
const MetadataPreview = ({ uri }: { uri: string }) => {
  const [result, setResult] = useState<MetadataReadResult | null>(null);
  useEffect(() => { let live = true; void readNftMetadata(uri).then((next) => { if (live) setResult(next); }); return () => { live = false; }; }, [uri]);
  if (!result) return <p className="mt-3 text-[11px] text-slate-500">Reading on-chain metadata URI…</p>;
  if (result.unavailableReason) return <p className="mt-3 text-[11px] text-slate-500">Metadata unavailable: {result.unavailableReason}</p>;
  return <div className="mt-3 rounded-lg border border-slate-800 p-2">{result.imageUrl && <img src={result.imageUrl} alt={result.metadata?.name || 'Legion NFT metadata'} className="mb-2 max-h-40 w-full rounded object-cover" />}<p className="font-semibold text-slate-200">{result.metadata?.name || 'Metadata name unavailable'}</p>{result.metadata?.description && <p className="mt-1 text-slate-400">{result.metadata.description}</p>}</div>;
};
const Field = ({ label, value }: { label: string; value: string }) => <div><dt className="uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-all text-slate-200">{value}</dd></div>;
const Notice = ({ kind, message, hash }: { kind: 'error' | 'success' | 'pending'; message: string; hash?: string | null }) => <div className={`rounded-2xl border p-4 text-sm ${kind === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}><div className="flex items-center gap-2">{kind === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}{message}</div>{hash && <p className="mt-2 break-all font-mono text-xs">Transaction hash: {hash}</p>}</div>;

export default LegionNFT;
