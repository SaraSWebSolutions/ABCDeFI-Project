import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import {
  FranchiseRecord,
  FranchiseSnapshot,
  franchiseErrorMessage,
  getFranchiseSnapshot,
  mintFranchise,
} from '../Services/franchise';

type TransactionState = 'idle' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

const formatTimestamp = (value: string) => {
  if (!/^\d+$/.test(value)) return 'Unavailable';
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
};

const formatRemaining = (seconds: string) => {
  const value = BigInt(seconds || '0');
  if (value === 0n) return 'Unlocked';
  const days = value / 86_400n;
  const hours = (value % 86_400n) / 3_600n;
  return `${days} day(s), ${hours} hour(s) remaining`;
};

const emptyMintForm = {
  franchisee: '', franchiseName: '', territoryCode: '', territoryName: '', level: '5', legionNFTId: '0', priceUSD: '', commissionBps: '', tokenURI: '', ipfsCID: '',
};

export const FranchiseNFT: React.FC = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [snapshot, setSnapshot] = useState<FranchiseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionState, setTransactionState] = useState<TransactionState>('idle');
  const [transactionMessage, setTransactionMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMintForm);

  const refresh = useCallback(async () => {
    if (!address || !isConnected || !isCorrectNetwork) {
      setSnapshot(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await getFranchiseSnapshot(address));
    } catch (reason) {
      setSnapshot(null);
      setError(franchiseErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, isCorrectNetwork]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setTransactionState('idle');
    setTransactionHash(null);
    setTransactionMessage('');
    setForm((current) => ({ ...current, franchisee: address || '' }));
  }, [address]);

  const submitMint = async () => {
    if (transactionState === 'awaiting-wallet' || transactionState === 'confirming') return;
    if (!address || !isConnected) {
      setTransactionState('error');
      setTransactionMessage('Connect the authorized Franchise minter wallet first.');
      return;
    }
    if (!isCorrectNetwork) {
      setTransactionState('error');
      setTransactionMessage('Switch to Hardhat Local (31337) before minting.');
      return;
    }
    if (!snapshot?.isMinter) {
      setTransactionState('error');
      setTransactionMessage('The connected wallet does not have MINTER_ROLE on FranchiseNFT.');
      return;
    }
    setTransactionState('awaiting-wallet');
    setTransactionHash(null);
    setTransactionMessage('Confirm the Franchise certificate mint in MetaMask.');
    try {
      const result = await mintFranchise({ ...form, level: Number(form.level) }, (hash, stage) => {
        setTransactionHash(hash);
        setTransactionState('confirming');
        setTransactionMessage(`${stage} submitted. Waiting for confirmation…`);
      });
      await refresh();
      setTransactionState('success');
      setTransactionMessage(`Franchise certificate #${result.tokenId || 'confirmed'} minted on-chain.`);
      setForm({ ...emptyMintForm, franchisee: address });
    } catch (reason) {
      setTransactionState('error');
      setTransactionMessage(franchiseErrorMessage(reason));
    }
  };

  return <section className="space-y-6" aria-label="Franchise NFT">
    <header className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Real on-chain certificate</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-white"><Building2 className="h-5 w-5 text-emerald-400" /> Franchise NFTs</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-400">Ownership, territory details, and the three-year transfer lock are read from the canonical FranchiseNFT contract. This deployment has no public purchase, rebate, commission payout, or secondary-market flow.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>
    </header>

    {!isConnected && <Notice kind="error" message="Connect a wallet to read FranchiseNFT ownership." />}
    {isConnected && !isCorrectNetwork && <Notice kind="error" message="Switch to Hardhat Local (31337) to use FranchiseNFT." />}
    {error && <Notice kind="error" message={error} />}

    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">Your Franchise certificates</h3><p className="mt-1 text-xs text-slate-400">Contract: <span className="break-all font-mono">{snapshot?.contractAddress || 'Unavailable'}</span></p></div>{snapshot?.isMinter && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> MINTER_ROLE</span>}</div>
      {loading && <p className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading canonical FranchiseNFT state…</p>}
      {!loading && snapshot?.franchises.length === 0 && <p className="mt-4 text-sm text-slate-500">No Franchise NFTs are owned by this wallet on the current deployment.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{snapshot?.franchises.map((franchise) => <FranchiseCard key={franchise.tokenId} franchise={franchise} />)}</div>
    </section>

    {snapshot?.isMinter && <section className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-5">
      <h3 className="font-bold text-white">Issue a Franchise certificate</h3><p className="mt-1 text-xs text-slate-400">This is role-protected issuance. Recorded price and commission fields are contract metadata only; no payment or revenue is created by this transaction.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{[
        ['franchisee', 'Franchisee wallet'], ['franchiseName', 'Franchise name'], ['territoryCode', 'Unique territory code'], ['territoryName', 'Territory name'], ['legionNFTId', 'Linked Legion NFT ID (0 if none)'], ['priceUSD', 'Recorded price USD'], ['commissionBps', 'Recorded commission BPS'], ['tokenURI', 'Metadata URI'], ['ipfsCID', 'IPFS CID'],
      ].map(([field, label]) => <label key={field} className="text-xs text-slate-400">{label}<input value={(form as Record<string, string>)[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>)}
        <label className="text-xs text-slate-400">Territory level<select value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{['World', 'Continent', 'Country', 'State', 'Zone', 'District', 'Pincode', 'Area', 'Locality'].map((name, index) => <option key={name} value={index}>{index}: {name}</option>)}</select></label>
      </div>
      <button onClick={() => void submitMint()} disabled={transactionState === 'awaiting-wallet' || transactionState === 'confirming'} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Mint Franchise certificate</button>
    </section>}
    {transactionState !== 'idle' && <Notice kind={transactionState === 'error' ? 'error' : transactionState === 'success' ? 'success' : 'pending'} message={transactionMessage} hash={transactionHash} />}
  </section>;
};

const FranchiseCard = ({ franchise }: { franchise: FranchiseRecord }) => <article className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200"><div className="flex justify-between gap-3"><div><p className="font-bold text-white">#{franchise.tokenId} · {franchise.franchiseName}</p><p className="mt-1 text-slate-400">{franchise.level} · {franchise.territoryName}</p></div><span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{franchise.status}</span></div><dl className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2"><Field label="Territory code" value={franchise.territoryCode} /><Field label="Current owner" value={franchise.owner} /><Field label="Transfer lock" value={franchise.transferLocked ? formatRemaining(franchise.remainingLockSeconds) : 'Unlocked'} /><Field label="Lock expires" value={formatTimestamp(franchise.lockExpiryTimestamp)} /><Field label="Issued" value={formatTimestamp(franchise.purchaseTimestamp)} /><Field label="Recorded price" value={`${franchise.priceUSD} USD`} /><Field label="Recorded commission" value={`${franchise.commissionBps} bps`} /><Field label="Linked Legion ID" value={franchise.legionNFTId} /><Field label="Metadata URI" value={franchise.tokenUri || 'Unavailable'} /><Field label="IPFS CID" value={franchise.ipfsCID || 'Unavailable'} /></dl></article>;
const Field = ({ label, value }: { label: string; value: string }) => <div><dt className="uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-all text-slate-200">{value}</dd></div>;
const Notice = ({ kind, message, hash }: { kind: 'error' | 'success' | 'pending'; message: string; hash?: string | null }) => <div className={`rounded-2xl border p-4 text-sm ${kind === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}><div className="flex items-center gap-2">{kind === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}{message}</div>{hash && <p className="mt-2 break-all font-mono text-xs">Transaction hash: {hash}</p>}</div>;

export default FranchiseNFT;
