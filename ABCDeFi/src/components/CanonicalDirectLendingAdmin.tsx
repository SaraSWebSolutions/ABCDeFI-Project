import React, { useCallback, useState } from 'react';
import { formatEther } from 'ethers';
import { getV2CanonicalDirectLoan, getV2CanonicalDirectLoanHistory, getV2ProtocolState, type V2CanonicalDirectLoan, type V2CanonicalDirectLoanHistory, type V2ProtocolState } from '../Services/lendingV2';

const loanState = (value: string) => ['None', 'Active', 'Margin call', 'Liquidated', 'Residual debt', 'Closed'][Number(value)] || 'Unavailable';
const installmentState = (value: string, terminalWithoutDebt: boolean) => terminalWithoutDebt ? 'Closed — no outstanding installment' : ['Due', 'Partially settled', 'Settled'][Number(value)] || 'Unavailable';
const amount = (value: string | null | undefined) => {
  try { return `${formatEther(BigInt(value || '0'))} ABCD`; } catch { return 'Unavailable'; }
};
const eth = (value: string | null | undefined) => {
  try { return `${formatEther(BigInt(value || '0'))} ETH`; } catch { return 'Unavailable'; }
};
const percent = (value: string | null | undefined) => value === null || value === undefined ? 'Not applicable' : `${(Number(value) / 100).toFixed(2)}%`;
const date = (value: string) => {
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? new Date(seconds * 1_000).toLocaleString() : 'Not applicable';
};
const termDays = (start: string, maturity: string) => {
  const seconds = Number(maturity) - Number(start);
  return Number.isSafeInteger(seconds) && seconds > 0 ? `${(seconds / 86_400).toFixed(0)} days` : 'Not applicable';
};
const short = (value: string) => value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

/**
 * Read-only Direct Lending administration evidence. It deliberately imports
 * no wallet, signer, transaction, or emergency-control capability.
 */
export const CanonicalDirectLendingAdmin: React.FC = () => {
  const [loanId, setLoanId] = useState('');
  const [loan, setLoan] = useState<V2CanonicalDirectLoan | null>(null);
  const [history, setHistory] = useState<V2CanonicalDirectLoanHistory | null>(null);
  const [protocol, setProtocol] = useState<V2ProtocolState | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('Enter a canonical Direct Lending loan ID to load deployment-scoped read evidence.');
  const [protocolReason, setProtocolReason] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null = null, append = false) => {
    if (!/^\d+$/.test(loanId) || BigInt(loanId) === 0n) { setReason('Loan ID must be a positive unsigned integer.'); return; }
    setLoading(true);
    try {
      const [canonicalLoan, page, protocolResult] = await Promise.all([
        getV2CanonicalDirectLoan(loanId),
        getV2CanonicalDirectLoanHistory(loanId, { limit: 20, cursor }),
        getV2ProtocolState().then((value) => ({ value, reason: null })).catch((error: unknown) => ({ value: null, reason: error instanceof Error ? error.message : 'Canonical Lending protocol read is unavailable.' })),
      ]);
      setLoan(canonicalLoan);
      setHistory((prior) => append && prior ? { ...page, history: [...prior.history, ...page.history] } : page);
      setProtocol(protocolResult.value);
      setProtocolReason(protocolResult.reason);
      setNextCursor(page.nextCursor);
      setReason('');
    } catch (error) {
      setLoan(null); setHistory(null); setProtocol(null); setProtocolReason(null); setNextCursor(null);
      setReason(error instanceof Error ? error.message : 'Canonical Direct Lending read evidence is unavailable.');
    } finally { setLoading(false); }
  }, [loanId]);

  const terminalWithoutDebt = Boolean(loan && BigInt(loan.previews.outstanding) === 0n && ['3', '4', '5'].includes(loan.loan.state));
  const lastInstallment = loan && loan.schedule.length > 0 ? loan.schedule[loan.schedule.length - 1] : null;
  const currentInstallment = terminalWithoutDebt ? null : loan?.schedule.find((item) => Number(item.state) !== 2) ?? lastInstallment;
  return <section aria-label="Canonical Direct Lending Admin drill-down" className="space-y-4 rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="font-black text-cyan-200">Canonical Direct Lending drill-down</p><p className="mt-1 text-slate-400">Read-only deployment-scoped Direct loan, protocol, risk, certificate, and indexed lifecycle evidence. P2P loans and all write operations are rejected.</p></div>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}><input aria-label="Direct Lending loan ID" value={loanId} onChange={(event) => setLoanId(event.target.value.trim())} inputMode="numeric" placeholder="Loan ID" className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /><button type="submit" disabled={loading} className="rounded-lg border border-cyan-400/50 px-3 py-2 font-bold text-cyan-100 disabled:opacity-50">{loading ? 'Loading…' : 'Load Direct loan'}</button></form>
    </header>
    {reason && <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">Unavailable: {reason}</p>}
    {loan && history && <>
      <section aria-label="Direct Lending canonical provenance" className="rounded-lg border border-slate-700 p-3 text-slate-300"><strong className="text-white">Canonical Lending V2 provenance</strong><p className="mt-1">Runtime: {loan.runtimeFamily} · chain {loan.chainId} · checkpoint: {loan.checkpoint}</p><p className="mt-1 break-all text-slate-500">Deployment identity: {loan.deploymentIdentity} · checkpoint block hash: {loan.checkpointBlockHash}</p><p className="mt-1 break-all text-slate-500">LendingPoolV2: {loan.sourceContracts.LendingPoolV2} · LoanManagerV2: {loan.sourceContracts.LoanManagerV2} · CollateralVaultV2: {loan.sourceContracts.CollateralVaultV2} · LiquidationV2: {loan.sourceContracts.LiquidationV2}</p><p className="mt-1 text-emerald-300">API availability, source contracts, live bytecode, deployment identity, checkpoint, and checkpoint block hash were validated by the canonical Lending V2 read model before this data was returned.</p></section>
      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label="Direct Lending loan details" className="rounded-lg border border-slate-700 p-3 text-slate-300"><strong className="text-white">Direct loan details</strong><p className="mt-1">Loan #{loanId}: {loanState(loan.loan.state)}</p><p className="mt-1 break-all">Borrower: <span className="font-mono">{loan.loan.borrower}</span></p><p className="mt-1 break-all">Lender: <span className="font-mono">{loan.loan.lender}</span></p><p className="mt-1">Principal: {amount(loan.loan.principal)} · APR: {(Number(loan.loan.aprBps) / 100).toFixed(2)}%</p><p className="mt-1">Term: {termDays(loan.loan.start, loan.loan.maturity)} · started: {date(loan.loan.start)} · maturity: {date(loan.loan.maturity)}</p><p className="mt-1">Original collateral: {eth(loan.loan.originalCollateralETH)} · current vault collateral: {eth(loan.loan.currentVaultCollateralETH)}</p></section>
        <section aria-label="Direct Lending debt and risk" className="rounded-lg border border-slate-700 p-3 text-slate-300"><strong className="text-white">Canonical debt and risk state</strong><p className="mt-1">Outstanding debt: {amount(loan.previews.outstanding)} · accrued interest: {amount(loan.previews.accruedInterest)}</p><p className="mt-1">Total repaid: {amount(loan.loan.totalRepaid)} · reserve contribution: {amount(loan.loan.reserveContribution)} · bad debt: {amount(loan.loan.badDebt)}</p><p className="mt-1">Current LTV: {percent(loan.previews.currentLtvBps)} · health factor: {loan.previews.healthFactor === null ? 'Not applicable' : formatEther(BigInt(loan.previews.healthFactor))}</p><p className="mt-1">Liquidation eligibility: {loan.previews.liquidatable === null ? 'Not applicable' : loan.previews.liquidatable ? 'Eligible' : 'Not eligible'}</p>{loan.previews.riskError && <p className="mt-2 text-amber-200">Canonical oracle/risk read unavailable: {loan.previews.riskError}</p>}</section>
      </div>
      <section aria-label="Direct Lending lifecycle history" className="rounded-lg border border-slate-700 p-3"><strong className="text-white">Direct loan lifecycle history</strong><p className="mt-1 text-slate-400">Canonical Lending V2 events only, deterministically ordered by block, transaction index, and log index.</p><ol className="mt-3 space-y-2">{history.history.map((event) => <li key={`${event.transactionHash}-${event.logIndex}`} className="rounded border border-slate-800 p-2 text-slate-300"><strong className="text-cyan-200">{event.eventName}</strong> · block {event.blockNumber} · log {event.logIndex}<p className="mt-1 break-all font-mono text-slate-500">{event.transactionHash}</p></li>)}</ol>{nextCursor && <button onClick={() => void load(nextCursor, true)} disabled={loading} className="mt-3 rounded border border-slate-700 px-3 py-2 font-bold text-slate-100 disabled:opacity-50">Load next canonical page</button>}</section>
      <section aria-label="Direct Lending EMI schedule" className="rounded-lg border border-slate-700 p-3"><strong className="text-white">EMI schedule and current due state</strong>{terminalWithoutDebt ? <p className="mt-1 text-slate-300">Current installment: Not applicable — loan closed · Remaining due: 0 ABCD · Current payment status: No outstanding installment</p> : currentInstallment ? <p className="mt-1 text-slate-300">Current installment: {amount(currentInstallment.amount)} · applied: {amount(currentInstallment.amountApplied)} · remaining due: {amount(currentInstallment.remainingDue)} · Current payment status: {installmentState(currentInstallment.state, false)} · due {date(currentInstallment.dueAt)}</p> : <p className="mt-1 text-slate-400">No canonical EMI installment is available.</p>}<div className="mt-3 space-y-2">{loan.schedule.map((item, index) => <p key={`${item.dueAt}-${index}`} className="rounded border border-slate-800 p-2 text-slate-300">#{index + 1} · due {date(item.dueAt)} · scheduled {amount(item.amount)} · applied {amount(item.amountApplied)} · remaining {terminalWithoutDebt ? '0 ABCD' : amount(item.remainingDue)} · {installmentState(item.state, terminalWithoutDebt)}</p>)}</div></section>
      <section aria-label="Direct Lending LoanNFT certificate evidence" className="rounded-lg border border-slate-700 p-3"><strong className="text-white">LoanNFT completion evidence</strong><p className="mt-1 text-slate-400">Completion state: {loan.certificates.length === 3 ? 'three canonical role certificates present' : `${loan.certificates.length} canonical certificate(s) present`}</p>{loan.certificates.length === 0 ? <p className="mt-2 text-slate-400">No completion certificates have been minted for this loan.</p> : <div className="mt-3 space-y-2">{loan.certificates.map((certificate) => <article key={certificate.tokenId} className="rounded border border-slate-800 p-2 text-slate-300"><p><strong className="text-cyan-200">{certificate.role}</strong> · token #{certificate.tokenId} · owner <span className="font-mono" title={certificate.owner}>{short(certificate.owner)}</span></p><p className="mt-1 break-all">URI: {certificate.tokenURI}</p><p className="mt-1 break-all">Metadata hash: {certificate.certificate.metadataHash}</p><p className="mt-1">Provenance: loan #{certificate.certificate.loanId} · request #{certificate.certificate.requestId} · P2P: {certificate.certificate.isP2P ? 'true' : 'false'}</p></article>)}</div>}</section>
      <section aria-label="Direct Lending protocol configuration" className="rounded-lg border border-slate-700 p-3"><strong className="text-white">Canonical Lending protocol read</strong>{protocol ? <div className="mt-2 space-y-1 text-slate-300"><p>Available pool liquidity: {protocol.poolLiquidity} ABCD · pool token balance: {protocol.poolTokenBalance} ABCD · Reserve balance: {protocol.reserveBalance} ABCD</p><p>Initial LTV: {percent(protocol.initialLtvBps)} · margin-call threshold: {percent(protocol.marginCallThresholdBps)} · liquidation threshold: {percent(protocol.liquidationThresholdBps)} · partial target: {percent(protocol.partialLiquidationTargetLtvBps)}</p><p>Direct APR: {percent(protocol.aprBps)} · cure period: {(Number(protocol.marginCallCureSeconds) / 3_600).toFixed(0)} hours · sale route: {protocol.partialLiquidationExecution}</p><p>Bindings: LendingPoolV2 {short(loan.sourceContracts.LendingPoolV2)} · LoanManagerV2 {short(loan.sourceContracts.LoanManagerV2)} · CollateralVaultV2 {short(loan.sourceContracts.CollateralVaultV2)} · LiquidationV2 {short(loan.sourceContracts.LiquidationV2)}</p></div> : <p className="mt-1 text-amber-200">Canonical protocol read unavailable: {protocolReason || 'No verified protocol result is available.'}</p>}</section>
    </>}
  </section>;
};
