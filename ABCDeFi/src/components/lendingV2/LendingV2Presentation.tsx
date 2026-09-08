import React from 'react';
import type { V2Progress, V2Tx } from '../../Services/lendingV2';

export const primary = 'btn-primary disabled:cursor-not-allowed disabled:opacity-50';
export const secondary = 'btn-secondary disabled:cursor-not-allowed disabled:opacity-50';
export const percent = (bps?: string | null) => bps == null ? 'Unavailable' : `${(Number(bps) / 100).toFixed(2)}%`;
export const timestamp = (value?: string) => value && Number(value) > 0 ? new Date(Number(value) * 1000).toLocaleString() : 'Unavailable';
export const Card = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => <section id={id} className="min-w-0 space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6"><h3 className="text-lg font-bold text-white">{title}</h3>{children}</section>;
export const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-300">{children}</p>;
export const Field = ({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (v: string) => void; inputMode?: 'decimal' | 'numeric' }) => <label className="block space-y-2 text-sm font-medium text-slate-200">{label}<input inputMode={inputMode} value={value} onChange={e => onChange(e.target.value)} className="block w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30" /></label>;
export const Term = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <label className="block space-y-2 text-sm font-medium text-slate-200">Term<select value={value} onChange={e => onChange(e.target.value)} className="block w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-white focus:ring-2 focus:ring-cyan-400"><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option></select></label>;
export const Metric = ({ label, value }: { label: string; value: string }) => <div className="min-w-0 rounded-xl bg-slate-950 p-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-100 [overflow-wrap:anywhere]">{value}</dd></div>;
export const Metrics = ({ children }: { children: React.ReactNode }) => <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
export const ReadError = ({ error, retry }: { error: string | null; retry: () => void }) => error ? <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200"><p className="break-words">{error}</p><button type="button" className={`${secondary} mt-2`} onClick={retry}>Retry read</button></div> : null;

export type TransactionState = { action: string; progress?: V2Progress; result?: V2Tx; error?: string; refreshWarning?: string };
export function V2TransactionStatus({ state }: { state: TransactionState | null }) {
  if (!state) return <p className="text-sm text-slate-400">Ready. Transactions require confirmation in your wallet.</p>;
  const labels = { preparing: 'Preparing transaction', wallet: 'Waiting for MetaMask', submitted: 'Transaction submitted', confirming: 'Confirming on-chain', confirmed: 'Confirmed' };
  const hash = state.result?.hash || state.progress?.hash;
  return <section aria-label="Transaction status" aria-live="polite" role={state.error ? 'alert' : 'status'} className={`space-y-2 rounded-xl border p-4 ${state.error ? 'border-rose-500/50 bg-rose-500/10' : state.result ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-cyan-500/40 bg-cyan-500/10'}`}>
    <p className="font-bold text-white">{state.action}: {state.error ? 'Failed' : state.result ? 'Confirmed' : state.progress ? `${state.progress.action} — ${labels[state.progress.stage]}` : 'Preparing transaction'}</p>
    {state.error && <p className="text-sm text-rose-200">{state.error}</p>}
    {hash && <p className="break-all text-xs text-slate-200">Transaction: {hash}</p>}
    {(state.result?.blockNumber || state.progress?.blockNumber) && <p className="text-sm text-slate-200">Block: {state.result?.blockNumber || state.progress?.blockNumber}</p>}
    {state.result && <div className="text-sm text-emerald-100">{state.result.depositId && <p>Deposit ID: #{state.result.depositId}</p>}{state.result.loanId && <p>Loan ID: #{state.result.loanId}</p>}{state.result.requestId && <p>Request ID: #{state.result.requestId}</p>}{state.result.approvalHashes.map(hash => <p key={hash} className="break-all text-xs">Confirmed ABCD approval: {hash}</p>)}</div>}
    {state.refreshWarning && <p className="text-sm text-amber-200">Transaction confirmed. State refresh needs attention: {state.refreshWarning}. Use Refresh to read again; do not resubmit this transaction.</p>}
  </section>;
}
