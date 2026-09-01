import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPinned, RefreshCw } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { cancelLegionMarketplaceListing, getLegionSnapshot, LegionRecord, LegionSnapshot, legionErrorMessage, listLegionOnMarketplace } from '../Services/legion';
import { MetadataReadResult, readNftMetadata } from '../Services/nftMetadata';

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
  const [listingPrices, setListingPrices] = useState<Record<string, string>>({});
  const [listingBusyTokenId, setListingBusyTokenId] = useState<string | null>(null);
  const [listingMessage, setListingMessage] = useState<string | null>(null);
  const [listingHash, setListingHash] = useState<string | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address || !isConnected || !isCorrectNetwork) { setSnapshot(null); setError(null); return; }
    setLoading(true); setError(null);
    try { setSnapshot(await getLegionSnapshot(address)); }
    catch (reason) { setSnapshot(null); setError(legionErrorMessage(reason)); }
    finally { setLoading(false); }
  }, [address, isConnected, isCorrectNetwork]);

  useEffect(() => { void refresh(); }, [refresh]);

  const listForSale = async (tokenId: string) => {
    if (listingBusyTokenId) return;
    setListingBusyTokenId(tokenId); setListingError(null); setListingHash(null); setListingMessage('Validating LegionNFT ownership and marketplace listing…');
    try {
      const result = await listLegionOnMarketplace(tokenId, listingPrices[tokenId] || '', (hash, stage) => {
        setListingHash(hash); setListingMessage(`${stage} submitted. Confirm it in MetaMask, then waiting for the confirmed receipt…`);
      });
      setListingMessage(`LegionNFT listed on-chain. Listing ID: ${result.listingId || 'emitted event not found'}.`);
      setListingHash(result.transactionHash);
      await refresh();
    } catch (reason) { setListingError(legionErrorMessage(reason)); }
    finally { setListingBusyTokenId(null); }
  };

  const cancelListing = async (listingId: string) => {
    if (listingBusyTokenId) return;
    const busyKey = `listing-${listingId}`;
    setListingBusyTokenId(busyKey); setListingError(null); setListingHash(null); setListingMessage(`Cancelling Legion marketplace listing #${listingId}…`);
    try {
      const result = await cancelLegionMarketplaceListing(listingId, (hash, stage) => {
        setListingHash(hash); setListingMessage(`${stage} submitted. Confirm it in MetaMask, then waiting for the confirmed receipt…`);
      });
      setListingMessage(`Legion marketplace listing #${listingId} cancelled on-chain. The NFT was returned to your wallet.`);
      setListingHash(result.transactionHash);
      await refresh();
    } catch (reason) { setListingError(legionErrorMessage(reason)); }
    finally { setListingBusyTokenId(null); }
  };

  return <section className="space-y-6" aria-label="Legion NFT">
    <header className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Real on-chain territory certificate</p><h2 className="mt-1 flex items-center gap-2 text-xl font-black text-white"><MapPinned className="h-5 w-5 text-cyan-400" /> Legion NFTs</h2><p className="mt-1 max-w-3xl text-xs text-slate-400">Ownership, hierarchy, territory metadata, and token URI are read from the canonical LegionNFT contract.</p></div><button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
    </header>
    {!isConnected && <Notice kind="error" message="Connect a wallet to read LegionNFT ownership." />}
    {isConnected && !isCorrectNetwork && <Notice kind="error" message="Switch to Hardhat Local (31337) to use LegionNFT." />}
    {error && <Notice kind="error" message={error} />}
    {listingError && <Notice kind="error" message={listingError} />}
    {listingMessage && <Notice kind={listingBusyTokenId ? 'pending' : 'success'} message={listingMessage} hash={listingHash} />}
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">Your Legion certificates</h3><p className="mt-1 text-xs text-slate-400">Contract: <span className="break-all font-mono">{snapshot?.contractAddress || 'Unavailable'}</span></p></div></div>{loading && <p className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading canonical LegionNFT and marketplace state…</p>}{!loading && snapshot?.legions.length === 0 && <p className="mt-4 text-sm text-slate-500">No Legion NFTs are owned by this wallet on the current deployment.</p>}<div className="mt-4 grid gap-4 lg:grid-cols-2">{snapshot?.legions.map((legion) => <LegionCard key={legion.tokenId} legion={legion} price={listingPrices[legion.tokenId] || ''} busy={listingBusyTokenId === legion.tokenId} onPriceChange={(value) => setListingPrices((current) => ({ ...current, [legion.tokenId]: value }))} onList={() => void listForSale(legion.tokenId)} />)}</div></section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold text-white">Active Legion marketplace listings</h3><p className="mt-1 text-xs text-slate-400">These are live NFTMarketplace listings priced in native ETH.</p><div className="mt-4 space-y-2">{snapshot?.activeListings.map((listing) => <div key={listing.listingId} className="rounded-xl bg-slate-950 p-3 text-xs text-slate-200">Listing #{listing.listingId} · Legion #{listing.tokenId} · {listing.priceEth} ETH · seller <span className="break-all">{listing.seller}</span>{address && listing.seller.toLowerCase() === address.toLowerCase() && <button onClick={() => void cancelListing(listing.listingId)} disabled={Boolean(listingBusyTokenId)} className="ml-3 mt-2 rounded-lg border border-rose-500/60 px-3 py-2 font-bold text-rose-200 disabled:opacity-50">{listingBusyTokenId === `listing-${listing.listingId}` ? 'Cancelling…' : 'Cancel listing'}</button>}</div>)}{snapshot && snapshot.activeListings.length === 0 && <p className="text-sm text-slate-500">No active Legion listings on the current deployment.</p>}</div></section>
  </section>;
};

const LegionCard = ({ legion, price, busy, onPriceChange, onList }: { legion: LegionRecord; price: string; busy: boolean; onPriceChange: (value: string) => void; onList: () => void }) => <article className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200"><div className="flex justify-between gap-3"><div><p className="font-bold text-white">#{legion.tokenId} · {legion.name}</p><p className="mt-1 text-slate-400">{legion.level} · {legion.territory}</p></div><span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{legion.character}</span></div><dl className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2"><Field label="Current owner" value={legion.owner} /><Field label="Parent token" value={legion.parentId === '0' ? 'None (root)' : `#${legion.parentId}`} /><Field label="Children" value={legion.children.length ? legion.children.map((id) => `#${id}`).join(', ') : 'None'} /><Field label="Population" value={legion.population} /><Field label="Recorded treasury share" value={`${legion.treasuryShareBps} bps`} /><Field label="Issued" value={formatTimestamp(legion.createdAt)} /><Field label="Metadata URI" value={legion.metadataUri || 'Unavailable'} /></dl><MetadataPreview uri={legion.metadataUri} /><div className="mt-4 border-t border-slate-800 pt-4"><p className="font-bold text-slate-100">List for sale</p><p className="mt-1 text-[11px] text-slate-400">Native ETH only. The marketplace will escrow this Legion NFT after your confirmation.</p><div className="mt-3 flex flex-wrap gap-2"><input value={price} onChange={(event) => onPriceChange(event.target.value)} placeholder="Price in ETH" inputMode="decimal" disabled={busy} className="field min-w-40 flex-1" /><button onClick={onList} disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Listing…' : 'List for Sale'}</button></div></div></article>;
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
