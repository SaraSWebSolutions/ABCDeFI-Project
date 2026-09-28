import React, { useCallback, useEffect, useState } from 'react';
import { formatEther } from 'ethers';
import { readLoanNftV2Certificate, readLoanNftV2CertificateHistory, readLoanNftV2Loan, readLoanNftV2Wallet, type LoanNftV2Certificate, type LoanNftV2Event } from '../Services/loanNftV2Read';

const amount = (value: string) => {
  try { return formatEther(BigInt(value)); } catch { return 'Unavailable'; }
};
const time = (value: string) => /^\d+$/.test(value) && BigInt(value) > 0n ? new Date(Number(BigInt(value) * 1000n)).toLocaleString() : 'Unavailable';

export const LoanNftV2Certificates: React.FC<{ wallet: string | null }> = ({ wallet }) => {
  const [certificates, setCertificates] = useState<LoanNftV2Certificate[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ tokenId: string; events: LoanNftV2Event[]; error: string | null } | null>(null);
  const [loanId, setLoanId] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [lookup, setLookup] = useState<{ title: string; records: LoanNftV2Certificate[]; error: string | null } | null>(null);

  const load = useCallback(async (cursor: string | null = null) => {
    if (!wallet) { setCertificates([]); setNextCursor(null); setHistory(null); return; }
    setLoading(true); setError(null);
    try {
      const page = await readLoanNftV2Wallet(wallet, cursor);
      setCertificates((current) => cursor ? [...current, ...page.data] : page.data);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setCertificates([]); setNextCursor(null); setError(reason instanceof Error ? reason.message : 'Canonical LoanNFTV2 certificate data is unavailable.');
    } finally { setLoading(false); }
  }, [wallet]);

  useEffect(() => { void load(); }, [load]);
  const loadHistory = async (tokenId: string) => {
    try {
      const result = await readLoanNftV2CertificateHistory(tokenId);
      setHistory({ tokenId, events: result.history, error: null });
    } catch (reason) { setHistory({ tokenId, events: [], error: reason instanceof Error ? reason.message : 'Canonical certificate history is unavailable.' }); }
  };
  const loadLoan = async () => {
    try { const page = await readLoanNftV2Loan(loanId); setLookup({ title: `Certificates for canonical loan #${loanId}`, records: page.data, error: null }); }
    catch (reason) { setLookup({ title: 'Certificate lookup', records: [], error: reason instanceof Error ? reason.message : 'Canonical loan certificate lookup is unavailable.' }); }
  };
  const loadToken = async () => {
    try { const certificate = await readLoanNftV2Certificate(tokenId); setLookup({ title: `Canonical certificate #${tokenId}`, records: [certificate], error: null }); }
    catch (reason) { setLookup({ title: 'Certificate lookup', records: [], error: reason instanceof Error ? reason.message : 'Canonical certificate lookup is unavailable.' }); }
  };

  return <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5" aria-label="Canonical LoanNFTV2 certificates">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">Your LoanNFTV2 completion certificates</h3><p className="mt-1 text-xs text-slate-300">Read-only canonical indexed-on-chain records. Certificates are transferable ERC-721 assets, but this product exposes no listing, sale, collateral, redemption, reward, fee, or Treasury action.</p></div><button type="button" className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-50" disabled={loading || !wallet} onClick={() => void load()}>Refresh</button></div>
    {!wallet && <p className="mt-4 text-sm text-slate-400">Connect a wallet to read certificates owned on the active canonical deployment.</p>}
    {wallet && loading && <p role="status" className="mt-4 text-sm text-cyan-200">Loading canonical certificate projection…</p>}
    {wallet && error && <p role="status" className="mt-4 text-sm text-rose-200">Unavailable: {error}</p>}
    {wallet && !loading && !error && certificates.length === 0 && <p className="mt-4 text-sm text-slate-400">No canonical LoanNFTV2 completion certificates are currently owned by this wallet.</p>}
    <div className="mt-4 grid gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 md:grid-cols-2"><div><label className="block text-xs text-slate-400" htmlFor="loan-nft-v2-loan">Read certificates for canonical loan</label><div className="mt-1 flex gap-2"><input id="loan-nft-v2-loan" className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" value={loanId} onChange={(event) => setLoanId(event.target.value)} inputMode="numeric" placeholder="Loan ID" /><button type="button" className="rounded-md border border-slate-600 px-2 text-xs text-slate-100" onClick={() => void loadLoan()}>Read</button></div></div><div><label className="block text-xs text-slate-400" htmlFor="loan-nft-v2-token">Read canonical certificate by token ID</label><div className="mt-1 flex gap-2"><input id="loan-nft-v2-token" className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" value={tokenId} onChange={(event) => setTokenId(event.target.value)} inputMode="numeric" placeholder="Token ID" /><button type="button" className="rounded-md border border-slate-600 px-2 text-xs text-slate-100" onClick={() => void loadToken()}>Read</button></div></div></div>
    {lookup && <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs"><p className="font-semibold text-white">{lookup.title}</p>{lookup.error && <p className="mt-2 text-rose-200">Unavailable: {lookup.error}</p>}{!lookup.error && lookup.records.length === 0 && <p className="mt-2 text-slate-400">No canonical completion certificate is indexed for this selection.</p>}{lookup.records.map((certificate) => <p key={certificate.tokenId} className="mt-2 break-all text-slate-200">#{certificate.tokenId} · {certificate.role} · owner {certificate.owner} · metadata {certificate.tokenURI}</p>)}</div>}
    <div className="mt-4 space-y-3">{certificates.map((certificate) => <article key={certificate.tokenId} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-white">{certificate.role} certificate #{certificate.tokenId}</p><button type="button" className="rounded-md border border-slate-600 px-2 py-1 text-slate-100" onClick={() => void loadHistory(certificate.tokenId)}>View canonical history</button></div><dl className="mt-3 grid gap-2 md:grid-cols-2"><Datum label="Loan association" value={certificate.certificate.loanId} /><Datum label="Current owner" value={certificate.owner} /><Datum label="Metadata URI" value={certificate.tokenURI} /><Datum label="Metadata hash" value={certificate.certificate.metadataHash} /><Datum label="Informational 1% USD valuation" value={`${amount(certificate.certificate.certificateValue)} USD`} /><Datum label="Valuation feed / round" value={`${certificate.certificate.valuationFeed} / ${certificate.certificate.valuationRoundId}`} /><Datum label="Completion time" value={time(certificate.certificate.completedAt)} /><Datum label="Minted evidence" value={`Block ${certificate.mintedEvidence.blockNumber}, log ${certificate.mintedEvidence.logIndex}`} /></dl>{history?.tokenId === certificate.tokenId && <CertificateHistory history={history} />}</article>)}</div>
    {nextCursor && <button type="button" className="mt-4 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-50" disabled={loading} onClick={() => void load(nextCursor)}>Load more</button>}
  </section>;
};

const Datum: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt className="text-slate-500">{label}</dt><dd className="break-all text-slate-200">{value}</dd></div>;
const CertificateHistory: React.FC<{ history: { events: LoanNftV2Event[]; error: string | null } }> = ({ history }) => <div className="mt-3 rounded-lg bg-slate-900 p-3"><p className="font-semibold text-white">Certificate provenance and transfer history</p>{history.error && <p className="mt-2 text-rose-200">Unavailable: {history.error}</p>}{!history.error && history.events.length === 0 && <p className="mt-2 text-slate-400">No canonical indexed history is available.</p>}{history.events.map((event) => <p key={`${event.transactionHash}:${event.logIndex}`} className="mt-2 break-all text-slate-300">{event.eventName} · block {event.blockNumber} · log {event.logIndex} · tx {event.transactionHash}</p>)}</div>;
