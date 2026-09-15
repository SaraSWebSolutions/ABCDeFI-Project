import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Coins, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { formatEther } from 'ethers';
import { useWallet } from '../Context/WalletContext';
import { buyIcoV2, claimIcoV2, getIcoV2Snapshot, icoV2ErrorMessage, type IcoV2Snapshot } from '../Services/icoV2';

type Progress = 'idle' | 'loading' | 'wallet' | 'confirming' | 'confirmed' | 'failed';
const date = (value: string) => value === '0' ? 'Not finalized' : new Date(Number(value) * 1000).toLocaleString();
const amount = (value: string) => `${formatEther(value)} ABCD`;

/** The canonical Phase-6 view. It has no fallback to legacy Presale or seeded ICO records. */
export const ICOv2Dashboard: React.FC = () => {
  const { address, isConnected, isCorrectNetwork, refreshBalances } = useWallet();
  const [snapshot, setSnapshot] = useState<IcoV2Snapshot | null>(null);
  const [stageId, setStageId] = useState<0 | 1>(0);
  const [bnbAmount, setBnbAmount] = useState('0.1');
  const [progress, setProgress] = useState<Progress>('loading');
  const [message, setMessage] = useState('Reading canonical ICOManagerV2 state…');
  const [hash, setHash] = useState<string | null>(null);
  const load = useCallback(async () => {
    setProgress('loading'); setMessage('Reading canonical ICOManagerV2 state…');
    try { setSnapshot(await getIcoV2Snapshot(address || undefined)); setProgress('idle'); setMessage(''); }
    catch (error) { setSnapshot(null); setProgress('failed'); setMessage(icoV2ErrorMessage(error)); }
  }, [address]);
  useEffect(() => { void load(); }, [load]);
  const purchase = async () => {
    if (!isConnected || !isCorrectNetwork) { setProgress('failed'); setMessage('Connect MetaMask to the canonical network before buying ABCD.'); return; }
    try {
      setHash(null); setProgress('wallet'); setMessage('Confirm the BNB purchase in MetaMask.');
      const result = await buyIcoV2(stageId, bnbAmount, (submitted) => { setHash(submitted); setProgress('confirming'); setMessage('Transaction submitted. Waiting for a successful on-chain receipt…'); });
      setHash(result.hash); setProgress('confirmed'); setMessage(`ICO purchase confirmed in block ${result.blockNumber}.`);
      await Promise.all([load(), refreshBalances()]);
    } catch (error) { setProgress('failed'); setMessage(icoV2ErrorMessage(error)); }
  };
  const claim = async () => {
    try {
      setHash(null); setProgress('wallet'); setMessage('Confirm the vested ABCD claim in MetaMask.');
      const result = await claimIcoV2((submitted) => { setHash(submitted); setProgress('confirming'); setMessage('Claim submitted. Waiting for a successful on-chain receipt…'); });
      setHash(result.hash); setProgress('confirmed'); setMessage(`ABCD claim confirmed in block ${result.blockNumber}.`);
      await Promise.all([load(), refreshBalances()]);
    } catch (error) { setProgress('failed'); setMessage(icoV2ErrorMessage(error)); }
  };
  const busy = progress === 'loading' || progress === 'wallet' || progress === 'confirming';
  return <section className="mx-auto max-w-5xl space-y-6 pb-12">
    <header className="rounded-3xl border border-amber-500/30 bg-slate-900 p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Canonical Phase 6</p><h2 className="mt-1 text-3xl font-bold text-white">ABCD ICO</h2><p className="mt-2 text-sm text-slate-300">This view reads ICOManagerV2 only. Legacy Presale and seeded ICO data are not a source of truth.</p></div><button onClick={() => void load()} disabled={busy} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 disabled:opacity-50"><RefreshCw className={`mr-2 inline h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button></div></header>
    {!snapshot ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100"><AlertTriangle className="mr-2 inline h-4 w-4" />{message || 'ICOManagerV2 is unavailable until its canonical deployment is recorded.'}</div> : <>
      <div className="grid gap-3 md:grid-cols-4">{[['Lifecycle', snapshot.lifecycle], ['Allocated', amount(snapshot.totalAllocated)], ['BNB held/raised', `${formatEther(snapshot.totalBnbCollected)} BNB`], ['TGE', date(snapshot.tgeTimestamp)]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 break-all font-mono text-sm text-white">{value}</p></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-5"><div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:col-span-3"><h3 className="text-lg font-bold text-white"><Coins className="mr-2 inline h-5 w-5 text-amber-300" />Native BNB purchase</h3><p className="mt-2 text-xs text-slate-400">Purchase succeeds only after the canonical transaction receipt reports status 1. There is no KYC, whitelist, or ICO referral path.</p><div className="mt-5 space-y-3"><select value={stageId} onChange={(event) => setStageId(Number(event.target.value) as 0 | 1)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white">{snapshot.stages.map((stage, index) => <option key={index} value={index}>Stage {index + 1}: {amount(stage.sold)} sold / {amount(stage.inventory)} — ${formatEther(stage.priceUsdWad)}</option>)}</select><input value={bnbAmount} onChange={(event) => setBnbAmount(event.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-white" aria-label="BNB amount" /><button disabled={busy || !isConnected || !isCorrectNetwork || !['Pending', 'Active'].includes(snapshot.lifecycle)} onClick={() => void purchase()} className="w-full rounded-xl bg-amber-400 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{progress === 'wallet' ? 'Confirm in MetaMask…' : progress === 'confirming' ? 'Confirming receipt…' : 'Buy ABCD with BNB'}</button></div></div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2"><h3 className="text-lg font-bold text-white"><Wallet className="mr-2 inline h-5 w-5 text-emerald-300" />Your allocation</h3>{snapshot.purchase ? <div className="mt-4 space-y-2 text-xs text-slate-300"><p>Allocated: <span className="font-mono text-white">{amount(snapshot.purchase.allocation)}</span></p><p>Claimed: <span className="font-mono text-white">{amount(snapshot.purchase.claimed)}</span></p><p>Claimable now: <span className="font-mono text-white">{amount(snapshot.purchase.claimable)}</span></p>{snapshot.lifecycle === 'Finalized' && BigInt(snapshot.purchase.claimable) > BigInt(snapshot.purchase.claimed) && <button disabled={busy} onClick={() => void claim()} className="mt-3 w-full rounded-xl bg-emerald-400 py-3 font-black text-slate-950">Claim vested ABCD</button>}</div> : <p className="mt-4 text-sm text-slate-400">Connect a wallet to read its on-chain purchase and vesting state.</p>}</div></div>
      {progress !== 'idle' && <div className={`rounded-xl border p-4 text-sm ${progress === 'confirmed' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : progress === 'failed' ? 'border-rose-500/30 bg-rose-500/10 text-rose-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>{busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}{progress === 'confirmed' && <CheckCircle2 className="mr-2 inline h-4 w-4" />}{message}{hash && <p className="mt-2 break-all font-mono text-xs">Transaction hash: {hash}</p>}</div>}
    </>}
  </section>;
};

export default ICOv2Dashboard;
