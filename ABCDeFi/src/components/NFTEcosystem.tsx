import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { buyNftListing, getNftEcosystemSnapshot, listParticipantNft, NftEcosystemSnapshot } from '../Services/nftEcosystem';

type TransactionState = 'idle' | 'validating' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

interface NFTEcosystemProps { connectedWallet?: string; isAdmin?: boolean; }

export const NFTEcosystem: React.FC<NFTEcosystemProps> = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [snapshot, setSnapshot] = useState<NftEcosystemSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [listTokenId, setListTokenId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [buyListingId, setBuyListingId] = useState('');
  const [state, setState] = useState<TransactionState>('idle');
  const [message, setMessage] = useState('');
  const [hash, setHash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address || !isCorrectNetwork) { setSnapshot(null); return; }
    setLoading(true);
    try { setSnapshot(await getNftEcosystemSnapshot(address)); }
    catch (error: any) { setSnapshot(null); setState('error'); setMessage(error?.shortMessage || error?.message || 'Unable to read NFT contracts.'); }
    finally { setLoading(false); }
  }, [address, isCorrectNetwork]);

  useEffect(() => { void refresh(); }, [refresh]);
  const busy = ['validating', 'awaiting-wallet', 'confirming'].includes(state);

  const run = async (label: string, operation: (onSubmitted: (transactionHash: string, stage: string) => void) => Promise<unknown>) => {
    if (busy) return;
    if (!address || !isConnected) { setState('error'); setMessage('Connect a wallet to use the NFT contracts.'); return; }
    if (!isCorrectNetwork) { setState('error'); setMessage('Switch to the configured local network before continuing.'); return; }
    setState('validating'); setHash(null); setMessage(`Validating ${label}…`);
    try {
      setState('awaiting-wallet'); setMessage(`Confirm ${label} in your wallet.`);
      await operation((transactionHash, stage) => { setHash(transactionHash); setState('confirming'); setMessage(`${stage} submitted. Waiting for confirmation…`); });
      await refresh(); setState('success'); setMessage(`${label} confirmed on-chain.`);
    } catch (error: any) {
      setState('error'); setMessage(error?.shortMessage || error?.reason || error?.message || `${label} failed.`);
    }
  };

  return <section className="space-y-6" aria-label="NFT ecosystem">
    <header className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Real on-chain NFTs</p><h2 className="mt-1 text-xl font-black text-white">Participant, Reputation, Guru & Marketplace</h2><p className="mt-1 text-xs text-slate-400">Balances and listings are read from deployed ERC-721 contracts. Reputation certificates are soulbound and cannot be listed.</p></div><button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
    </header>
    {!isConnected && <Notice kind="error" message="Connect a wallet to read deployed NFT state." />}
    {isConnected && !isCorrectNetwork && <Notice kind="error" message="The connected wallet is on the wrong network." />}
    {isConnected && isCorrectNetwork && !snapshot && !loading && <Notice kind="error" message="NFT data is unavailable from the configured contracts." />}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Card title="Participant NFTs" value={snapshot ? snapshot.participantBalance : 'Unavailable'} detail="Transferable ERC-721" /><Card title="Guru NFTs" value={snapshot ? snapshot.guruBalance : 'Unavailable'} detail="Transferable ERC-721" /><Card title="Loan certificates" value={snapshot ? snapshot.loanBalance : 'Unavailable'} detail="Protocol-minted LoanNFT ERC-721" /><Card title="Reputation certificate" value={snapshot?.reputation ? `#${snapshot.reputation.tokenId}` : 'None'} detail={snapshot?.reputation ? `Score ${snapshot.reputation.creditScore}; soulbound` : 'Soulbound ERC-721'} /></div>
    {snapshot?.reputation && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-200">Reputation #{snapshot.reputation.tokenId}: score {snapshot.reputation.creditScore}, loans {snapshot.reputation.totalLoansCount}, defaults {snapshot.reputation.totalDefaultsCount}. <span className="break-all text-xs text-slate-500">{snapshot.reputation.metadataUri}</span></div>}
    <div className="grid gap-5 lg:grid-cols-2"><Action title="List ParticipantNFT" primary="Approve & list" disabled={busy} onSubmit={() => void run('ParticipantNFT listing', (callback) => listParticipantNft(listTokenId, listPrice, callback))}><input value={listTokenId} onChange={(event) => setListTokenId(event.target.value)} placeholder="Participant token ID" inputMode="numeric" className="field" /><input value={listPrice} onChange={(event) => setListPrice(event.target.value)} placeholder="Price in ETH" inputMode="decimal" className="field" /></Action><Action title="Buy marketplace listing" primary="Buy with ETH" disabled={busy} onSubmit={() => void run('NFT purchase', (callback) => buyNftListing(buyListingId, callback))}><input value={buyListingId} onChange={(event) => setBuyListingId(event.target.value)} placeholder="Active listing ID" inputMode="numeric" className="field" /></Action></div>
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold text-white">Active on-chain listings</h3><p className="mt-1 text-xs text-slate-400">Marketplace fee: {snapshot ? `${Number(snapshot.marketplaceFeeBps) / 100}%` : 'Unavailable'}</p><div className="mt-4 space-y-2">{snapshot?.activeListings.map((listing) => <div key={listing.listingId} className="rounded-xl bg-slate-950 p-3 text-xs text-slate-200">#{listing.listingId} · token {listing.tokenId} · {listing.priceEth} ETH · seller {listing.seller}</div>)}{snapshot && snapshot.activeListings.length === 0 && <p className="text-sm text-slate-500">No active listings.</p>}</div></div>
    {state !== 'idle' && <Notice kind={state === 'error' ? 'error' : state === 'success' ? 'success' : 'pending'} message={message} hash={hash} />}
  </section>;
};

const Card = ({ title, value, detail }: { title: string; value: string; detail: string }) => <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">{title}</p><p className="mt-1 text-lg font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
const Action = ({ title, primary, disabled, onSubmit, children }: { title: string; primary: string; disabled: boolean; onSubmit: () => void; children: React.ReactNode }) => <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold text-white">{title}</h3><div className="mt-4 flex flex-col gap-2">{children}</div><button onClick={onSubmit} disabled={disabled} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{primary}</button></div>;
const Notice = ({ kind, message, hash }: { kind: 'error' | 'success' | 'pending'; message: string; hash?: string | null }) => <div className={`rounded-2xl border p-4 text-sm ${kind === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}><div className="flex gap-2">{kind === 'pending' && <Loader2 className="h-5 w-5 animate-spin" />}{message}</div>{hash && <p className="mt-2 break-all font-mono text-xs">Transaction hash: {hash}</p>}</div>;

export default NFTEcosystem;
