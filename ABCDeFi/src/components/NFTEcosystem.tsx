import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { buyNftListing, cancelNftListing, getLoanNftCertificateSnapshot, getNftEcosystemSnapshot, listParticipantNft, LoanNftCertificate, LoanNftCertificateSnapshot, nftMarketplaceErrorMessage, NftEcosystemSnapshot, updateNftListingPrice } from '../Services/nftEcosystem';

type TransactionState = 'idle' | 'validating' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

interface NFTEcosystemProps { connectedWallet?: string; isAdmin?: boolean; }

export const NFTEcosystem: React.FC<NFTEcosystemProps> = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [snapshot, setSnapshot] = useState<NftEcosystemSnapshot | null>(null);
  const [loanNftSnapshot, setLoanNftSnapshot] = useState<LoanNftCertificateSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [loanNftLoading, setLoanNftLoading] = useState(false);
  const [loanNftError, setLoanNftError] = useState<string | null>(null);
  const [selectedLoanNftTokenId, setSelectedLoanNftTokenId] = useState<string | null>(null);
  const [listTokenId, setListTokenId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [buyListingId, setBuyListingId] = useState('');
  const [updatedPrices, setUpdatedPrices] = useState<Record<string, string>>({});
  const [state, setState] = useState<TransactionState>('idle');
  const [message, setMessage] = useState('');
  const [hash, setHash] = useState<string | null>(null);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    if (!address || !isCorrectNetwork) { setSnapshot(null); setLoanNftSnapshot(null); setLoanNftError(null); return; }
    setLoading(true); setLoanNftLoading(true); setLoanNftError(null);
    const [ecosystem, certificates] = await Promise.allSettled([getNftEcosystemSnapshot(address), getLoanNftCertificateSnapshot(address)]);
    if (generation !== refreshGeneration.current) return;
    if (ecosystem.status === 'fulfilled') setSnapshot(ecosystem.value);
    else { setSnapshot(null); setState('error'); setMessage(nftMarketplaceErrorMessage(ecosystem.reason) || 'Unable to read NFT contracts.'); }
    if (certificates.status === 'fulfilled') setLoanNftSnapshot(certificates.value);
    else { setLoanNftSnapshot(null); setLoanNftError(nftMarketplaceErrorMessage(certificates.reason) || 'Unable to read canonical LoanNFT certificates.'); }
    setLoading(false); setLoanNftLoading(false);
  }, [address, isCorrectNetwork]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setSelectedLoanNftTokenId(null); }, [address]);
  const busy = ['validating', 'awaiting-wallet', 'confirming'].includes(state);
  const selectedLoanNft = loanNftSnapshot?.certificates.find((certificate) => certificate.tokenId === selectedLoanNftTokenId) || null;

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
      setState('error'); setMessage(nftMarketplaceErrorMessage(error) || `${label} failed.`);
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5" aria-label="LoanNFT certificates"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">LoanNFT certificates</h3><p className="mt-1 text-xs text-slate-400">Certificate fields and current ownership come from LoanNFT. Mint and lifecycle evidence comes from the canonical lending indexer when available.</p></div><button onClick={() => void refresh()} disabled={loading || loanNftLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loanNftLoading ? 'animate-spin' : ''}`} /> Refresh certificates</button></div>{loanNftLoading && <p className="mt-4 text-sm text-slate-400">Loading canonical LoanNFT certificates…</p>}{loanNftError && <div className="mt-4"><Notice kind="error" message={loanNftError} /></div>}{loanNftSnapshot?.historyUnavailable && <div className="mt-4"><Notice kind="error" message={loanNftSnapshot.historyUnavailable} /></div>}<div className="mt-4 grid gap-3 lg:grid-cols-2">{loanNftSnapshot?.certificates.map((certificate) => <LoanNftCertificateCard key={certificate.tokenId} certificate={certificate} selected={selectedLoanNftTokenId === certificate.tokenId} onSelect={() => setSelectedLoanNftTokenId(certificate.tokenId)} />)}</div>{loanNftSnapshot && loanNftSnapshot.certificates.length === 0 && <p className="mt-4 text-sm text-slate-500">No LoanNFT certificates are associated with this wallet on the current deployment.</p>}{selectedLoanNft && <LoanNftDetail certificate={selectedLoanNft} onClose={() => setSelectedLoanNftTokenId(null)} />}</section>
    <div className="grid gap-5 lg:grid-cols-2"><Action title="List ParticipantNFT" primary="Approve & list" disabled={busy} onSubmit={() => void run('ParticipantNFT listing', (callback) => listParticipantNft(listTokenId, listPrice, callback))}><input value={listTokenId} onChange={(event) => setListTokenId(event.target.value)} placeholder="Participant token ID" inputMode="numeric" className="field" /><input value={listPrice} onChange={(event) => setListPrice(event.target.value)} placeholder="Price in ETH" inputMode="decimal" className="field" /></Action><Action title="Buy marketplace listing" primary="Buy with ETH" disabled={busy} onSubmit={() => void run('NFT purchase', (callback) => buyNftListing(buyListingId, callback))}><input value={buyListingId} onChange={(event) => setBuyListingId(event.target.value)} placeholder="Active listing ID" inputMode="numeric" className="field" /></Action></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold text-white">Your active on-chain listings</h3><p className="mt-1 text-xs text-slate-400">Only listings whose seller is the connected wallet are shown. Cancelling returns the escrowed NFT; changing price keeps it listed.</p><div className="mt-4 space-y-3">{snapshot?.userListings.map((listing) => <div key={listing.listingId} className="rounded-xl bg-slate-950 p-3 text-xs text-slate-200"><p>#{listing.listingId} · token {listing.tokenId} · {listing.priceEth} ETH</p><div className="mt-3 flex flex-wrap gap-2"><input value={updatedPrices[listing.listingId] ?? ''} onChange={(event) => setUpdatedPrices((current) => ({ ...current, [listing.listingId]: event.target.value }))} placeholder={`New price (current ${listing.priceEth} ETH)`} inputMode="decimal" className="field min-w-48 flex-1" /><button onClick={() => void run('Listing price update', (callback) => updateNftListingPrice(listing.listingId, updatedPrices[listing.listingId] ?? '', callback))} disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white disabled:opacity-50">Update price</button><button onClick={() => void run('Listing cancellation', (callback) => cancelNftListing(listing.listingId, callback))} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white disabled:opacity-50">Cancel listing</button></div></div>)}{snapshot && snapshot.userListings.length === 0 && <p className="text-sm text-slate-500">You have no active marketplace listings.</p>}</div></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold text-white">Active on-chain listings</h3><p className="mt-1 text-xs text-slate-400">Marketplace fee: {snapshot ? `${Number(snapshot.marketplaceFeeBps) / 100}%` : 'Unavailable'}</p><div className="mt-4 space-y-2">{snapshot?.activeListings.map((listing) => <div key={listing.listingId} className="rounded-xl bg-slate-950 p-3 text-xs text-slate-200">#{listing.listingId} · token {listing.tokenId} · {listing.priceEth} ETH · seller {listing.seller}</div>)}{snapshot && snapshot.activeListings.length === 0 && <p className="text-sm text-slate-500">No active listings.</p>}</div></div>
    </div>
    {state !== 'idle' && <Notice kind={state === 'error' ? 'error' : state === 'success' ? 'success' : 'pending'} message={message} hash={hash} />}
  </section>;
};

const Card = ({ title, value, detail }: { title: string; value: string; detail: string }) => <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">{title}</p><p className="mt-1 text-lg font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
const Action = ({ title, primary, disabled, onSubmit, children }: { title: string; primary: string; disabled: boolean; onSubmit: () => void; children: React.ReactNode }) => <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold text-white">{title}</h3><div className="mt-4 flex flex-col gap-2">{children}</div><button onClick={onSubmit} disabled={disabled} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{primary}</button></div>;
const Notice = ({ kind, message, hash }: { kind: 'error' | 'success' | 'pending'; message: string; hash?: string | null }) => <div className={`rounded-2xl border p-4 text-sm ${kind === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}><div className="flex gap-2">{kind === 'pending' && <Loader2 className="h-5 w-5 animate-spin" />}{message}</div>{hash && <p className="mt-2 break-all font-mono text-xs">Transaction hash: {hash}</p>}</div>;

const LoanNftCertificateCard = ({ certificate, selected, onSelect }: { certificate: LoanNftCertificate; selected: boolean; onSelect: () => void }) => <article className={`rounded-xl border p-4 text-xs ${selected ? 'border-purple-400 bg-purple-500/10' : 'border-slate-800 bg-slate-950'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">Certificate #{certificate.tokenId}</p><p className="mt-1 text-slate-400">Loan #{certificate.loanId} · {certificate.certificateType}</p></div><span className="font-mono text-purple-300">{certificate.status}</span></div><div className="mt-3 grid gap-1 text-slate-300"><p>Principal: {certificate.principalAbcd === 'Not available' ? 'Not available' : `${certificate.principalAbcd} ABCD`}</p><p>Collateral: {certificate.collateralEth === 'Not available' ? 'Not available' : `${certificate.collateralEth} ETH`}</p><p className="break-all">Owner: {certificate.owner || 'Not available'}</p></div><button onClick={onSelect} className="mt-3 rounded-lg border border-slate-700 px-3 py-2 font-bold text-slate-100">{selected ? 'Viewing details' : 'View details'}</button></article>;

const LoanNftDetail = ({ certificate, onClose }: { certificate: LoanNftCertificate; onClose: () => void }) => <article className="mt-5 rounded-xl border border-purple-500/30 bg-slate-950 p-5 text-xs text-slate-200"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-bold text-white">LoanNFT certificate #{certificate.tokenId}</h4><p className="mt-1 text-slate-400">Certificate type: {certificate.certificateType}</p></div><button onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 font-bold text-slate-100">Close</button></div><div className="mt-4 grid gap-x-6 gap-y-2 md:grid-cols-2"><CertificateField label="Loan ID" value={certificate.loanId} /><CertificateField label="Borrower" value={certificate.borrower} /><CertificateField label="Lender" value={certificate.lender} /><CertificateField label="Current NFT owner" value={certificate.owner || 'Not available'} /><CertificateField label="Principal" value={certificate.principalAbcd === 'Not available' ? 'Not available' : `${certificate.principalAbcd} ABCD`} /><CertificateField label="Collateral" value={certificate.collateralEth === 'Not available' ? 'Not available' : `${certificate.collateralEth} ETH`} /><CertificateField label="Interest rate" value={certificate.interestRateBps === 'Not available' ? 'Not available' : `${certificate.interestRateBps} bps`} /><CertificateField label="Duration" value={certificate.durationMonths === 'Not available' ? 'Not available' : `${certificate.durationMonths} month(s)`} /><CertificateField label="Loan status" value={certificate.status} /><CertificateField label="Mint date" value={formatUnixTimestamp(certificate.mintDate)} /><CertificateField label="Mint transaction" value={certificate.mintTransactionHash || 'Not available'} /><CertificateField label="Mint block" value={certificate.mintBlock || 'Not available'} /><CertificateField label="Created / indexed" value={`${formatIsoTimestamp(certificate.createdAt)} / ${formatIsoTimestamp(certificate.indexedAt)}`} /><CertificateField label="Metadata URI" value={certificate.metadataUri || 'Not available'} /></div><div className="mt-5"><h5 className="font-bold text-white">Canonical certificate events</h5>{certificate.events.length === 0 && <p className="mt-2 text-slate-500">Not available from the current canonical deployment.</p>}<div className="mt-2 space-y-2">{certificate.events.map((event, index) => <div key={`${event.name}-${event.transactionHash}-${event.logIndex}-${index}`} className="rounded-lg border border-slate-800 p-3"><p className="font-semibold text-slate-100">{event.name}</p><p className="mt-1 break-all text-slate-400">Transaction: {event.transactionHash || 'Not available'}</p><p className="text-slate-400">Block: {event.blockNumber || 'Not available'}</p></div>)}</div></div></article>;

const CertificateField = ({ label, value }: { label: string; value: string }) => <div><p className="uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-all text-slate-200">{value}</p></div>;
const formatUnixTimestamp = (value: string | null) => { if (!value || !/^\d+$/.test(value)) return 'Not available'; const timestamp = Number(value) * 1000; return Number.isSafeInteger(timestamp) ? new Date(timestamp).toLocaleString() : value; };
const formatIsoTimestamp = (value: string | null) => { if (!value) return 'Not available'; const timestamp = Date.parse(value); return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString(); };

export default NFTEcosystem;
