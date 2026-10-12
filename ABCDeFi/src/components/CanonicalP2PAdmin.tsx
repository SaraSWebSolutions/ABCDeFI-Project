import React, { useCallback, useState } from 'react';
import { formatEther } from 'ethers';
import { getV2CanonicalP2PLoan, getV2P2PRequestHistory, type V2CanonicalP2PLoan, type V2P2PRequestHistory } from '../Services/lendingV2';

const requestState = (value: number) => ['Open', 'Funded', 'Cancelled', 'Settled', 'Recovered'][value] || 'Unavailable';
const loanState = (value: string) => ['None', 'Active', 'Margin call', 'Liquidated', 'Residual debt', 'Closed'][Number(value)] || 'Unavailable';
const installmentState = (value: string, terminalWithoutDebt: boolean) => {
  if (terminalWithoutDebt) return 'Closed — no outstanding installment';
  return ['Due', 'Partially settled', 'Settled'][Number(value)] || 'Unavailable';
};
const amount = (value: string | null | undefined) => {
  try { return `${formatEther(BigInt(value || '0'))} ABCD`; } catch { return 'Unavailable'; }
};
const eth = (value: string | null | undefined) => {
  try { return `${formatEther(BigInt(value || '0'))} ETH`; } catch { return 'Unavailable'; }
};
const ratio = (value: string | null | undefined, suffix = '%') => value === null || value === undefined ? 'Not applicable' : `${(Number(value) / 100).toFixed(2)}${suffix}`;
const date = (value: string) => {
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? new Date(seconds * 1_000).toLocaleString() : 'Not applicable';
};
const short = (value: string) => value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

/**
 * Read-only P2P administration evidence. It intentionally contains no
 * wallet, signer, transaction, emergency-control, or user-lending imports.
 */
export const CanonicalP2PAdmin: React.FC = () => {
  const [requestId, setRequestId] = useState('');
  const [history, setHistory] = useState<V2P2PRequestHistory | null>(null);
  const [loan, setLoan] = useState<V2CanonicalP2PLoan | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('Enter a canonical P2P request ID to load deployment-scoped read evidence.');

  const load = useCallback(async (cursor: string | null = null, append = false) => {
    if (!/^\d+$/.test(requestId) || BigInt(requestId) === 0n) { setReason('Request ID must be a positive unsigned integer.'); return; }
    setLoading(true);
    try {
      const page = await getV2P2PRequestHistory(requestId, { limit: 20, cursor });
      if (!/^\d+$/.test(page.request.loanId) || BigInt(page.request.loanId) === 0n) throw new Error('Canonical request is not bound to a P2P loan.');
      const canonicalLoan = await getV2CanonicalP2PLoan(page.request.loanId);
      setHistory((prior) => append && prior ? { ...page, history: [...prior.history, ...page.history] } : page);
      setLoan(canonicalLoan);
      setNextCursor(page.nextCursor);
      setReason('');
    } catch (error) {
      setHistory(null); setLoan(null); setNextCursor(null);
      setReason(error instanceof Error ? error.message : 'Canonical P2P read evidence is unavailable.');
    } finally { setLoading(false); }
  }, [requestId]);

  const terminalWithoutDebt = Boolean(loan
    && BigInt(loan.previews.outstanding) === 0n
    && ['3', '4', '5'].includes(loan.loan.state));
  const lastInstallment = loan && loan.schedule.length > 0 ? loan.schedule[loan.schedule.length - 1] : null;
  const currentInstallment = terminalWithoutDebt ? null : loan?.schedule.find((item) => Number(item.state) !== 2) ?? lastInstallment;
  return <section aria-label="Canonical P2P Admin drill-down" className="space-y-4 rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="font-black text-cyan-200">Canonical P2P drill-down</p><p className="mt-1 text-slate-400">Read-only deployment-scoped request, loan, schedule, risk, certificate, and indexed lifecycle evidence. No P2P operation is available from this panel.</p></div>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}><input aria-label="P2P request ID" value={requestId} onChange={(event) => setRequestId(event.target.value.trim())} inputMode="numeric" placeholder="Request ID" className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /><button type="submit" disabled={loading} className="rounded-lg border border-cyan-400/50 px-3 py-2 font-bold text-cyan-100 disabled:opacity-50">{loading ? 'Loading…' : 'Load request'}</button></form>
    </header>
    {reason && <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">Unavailable: {reason}</p>}
    {history && loan && <>
      <section aria-label="P2P canonical provenance" className="rounded-lg border border-slate-700 p-3 text-slate-300"><strong className="text-white">Canonical Lending V2 provenance</strong><p className="mt-1">Deployment: {loan.deploymentVersion} · checkpoint: {loan.checkpoint} · API source: canonical-v2-indexed-on-chain</p><p className="mt-1 break-all text-slate-500">LoanMarketplaceV2: {loan.sourceContracts.LoanMarketplaceV2} · LoanManagerV2: {loan.sourceContracts.LoanManagerV2} · LoanNFTV2: {loan.sourceContracts.LoanNFTV2}</p><p className="mt-1 text-emerald-300">API availability, deployment identity, runtime, bytecode, checkpoint, and checkpoint block hash were verified by the canonical Lending V2 read model before this data was returned.</p></section>
      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label="P2P request binding" className="rounded-lg border border-slate-700 p-3 text-slate-300"><strong className="text-white">Request and loan binding</strong><p className="mt-1">Request #{history.requestId}: {requestState(history.request.state)} → Loan #{history.request.loanId}: {loanState(loan.loan.state)}</p><p className="mt-1 break-all">Borrower: <span className="font-mono">{loan.loan.borrower}</span></p><p className="mt-1 break-all">Lender: <span className="font-mono">{loan.loan.lender}</span></p><p className="mt-1">Principal: {amount(loan.loan.principal)} · APR: {(Number(loan.loan.aprBps) / 100).toFixed(2)}% · Term: {(Number(history.request.termSeconds) / 86_400).toFixed(0)} days</p><p className="mt-1">Original collateral: {eth(loan.loan.originalCollateralETH)} · current vault collateral: {eth(loan.loan.currentVaultCollateralETH)}</p></section>
        <section aria-label="P2P loan risk" className="rounded-lg border border-slate-700 p-3 text-slate-300"><strong className="text-white">Canonical loan and risk state</strong><p className="mt-1">Outstanding: {amount(loan.previews.outstanding)} · accrued interest: {amount(loan.previews.accruedInterest)} · paid/applied: {amount(loan.loan.totalRepaid)}</p><p className="mt-1">Current LTV: {ratio(loan.previews.currentLtvBps)} · health factor: {loan.previews.healthFactor === null ? 'Not applicable' : formatEther(BigInt(loan.previews.healthFactor))}</p><p className="mt-1">Liquidation eligibility: {loan.previews.liquidatable === null ? 'Not applicable' : loan.previews.liquidatable ? 'Eligible' : 'Not eligible'}</p><p className="mt-1">Maturity: {date(loan.loan.maturity)}</p>{loan.previews.riskError && <p className="mt-2 text-amber-200">Canonical risk/oracle read unavailable: {loan.previews.riskError}</p>}</section>
      </div>
      <section aria-label="P2P request lifecycle timeline" className="rounded-lg border border-slate-700 p-3"><strong className="text-white">P2P request lifecycle timeline</strong><p className="mt-1 text-slate-400">Only LoanMarketplaceV2 RequestCreated, RequestFunded, RequestCancelled, RequestRepaid, and RequestRecovered are accepted. Direct Lending events are excluded even when numeric IDs collide.</p><ol className="mt-3 space-y-2">{history.history.map((event) => <li key={`${event.transactionHash}-${event.logIndex}`} className="rounded border border-slate-800 p-2 text-slate-300"><strong className="text-cyan-200">{event.eventName}</strong> · block {event.blockNumber} · log {event.logIndex}<p className="mt-1 break-all font-mono text-slate-500">{event.transactionHash}</p></li>)}</ol>{nextCursor && <button onClick={() => void load(nextCursor, true)} disabled={loading} className="mt-3 rounded border border-slate-700 px-3 py-2 font-bold text-slate-100 disabled:opacity-50">Load next canonical page</button>}</section>
      <section aria-label="P2P EMI schedule" className="rounded-lg border border-slate-700 p-3"><strong className="text-white">EMI schedule and current due state</strong>{terminalWithoutDebt ? <p className="mt-1 text-slate-300">Current installment: Not applicable — loan closed · Remaining due: 0 ABCD · Current payment status: No outstanding installment</p> : currentInstallment ? <p className="mt-1 text-slate-300">Current installment: {amount(currentInstallment.amount)} · applied: {amount(currentInstallment.amountApplied)} · remaining due: {amount(currentInstallment.remainingDue)} · {installmentState(currentInstallment.state, false)} · due {date(currentInstallment.dueAt)}</p> : <p className="mt-1 text-slate-400">No canonical EMI installment is available.</p>}<div className="mt-3 space-y-2">{loan.schedule.map((item, index) => <p key={`${item.dueAt}-${index}`} className="rounded border border-slate-800 p-2 text-slate-300">#{index + 1} · due {date(item.dueAt)} · scheduled {amount(item.amount)} · applied {amount(item.amountApplied)} · remaining {terminalWithoutDebt ? '0 ABCD' : amount(item.remainingDue)} · {installmentState(item.state, terminalWithoutDebt)}</p>)}</div></section>
      <section aria-label="P2P LoanNFT certificate evidence" className="rounded-lg border border-slate-700 p-3"><strong className="text-white">LoanNFT completion evidence</strong><p className="mt-1 text-slate-400">Completion state: {loan.certificates.length === 3 ? 'three canonical role certificates present' : `${loan.certificates.length} canonical certificate(s) present`}</p>{loan.certificates.length === 0 ? <p className="mt-2 text-slate-400">No completion certificates have been minted for this loan.</p> : <div className="mt-3 space-y-2">{loan.certificates.map((certificate) => <article key={certificate.tokenId} className="rounded border border-slate-800 p-2 text-slate-300"><p><strong className="text-cyan-200">{certificate.role}</strong> · token #{certificate.tokenId} · owner <span className="font-mono" title={certificate.owner}>{short(certificate.owner)}</span></p><p className="mt-1 break-all">URI: {certificate.tokenURI}</p><p className="mt-1 break-all">Metadata hash: {certificate.certificate.metadataHash}</p><p className="mt-1">Provenance: loan #{certificate.certificate.loanId} · request #{certificate.certificate.requestId} · P2P: {certificate.certificate.isP2P ? 'true' : 'false'}</p></article>)}</div>}</section>
    </>}
  </section>;
};
