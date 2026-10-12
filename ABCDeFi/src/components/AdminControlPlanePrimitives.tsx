import React from 'react';
import type { AdminOperationState } from '../Services/canonicalAdmin';

/**
 * Presentation-only primitives for the canonical Admin control plane.  They
 * deliberately accept already-derived state: neither component discovers a
 * wallet, creates a signer, or changes any authorization decision.
 */
export const CanonicalSourceUnavailable: React.FC<{
  reason?: string;
  onOpenProvenance?: () => void;
}> = ({ reason, onOpenProvenance }) => <section aria-label="Canonical source unavailable" className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-3 text-xs text-amber-100">
  <p className="font-bold">Data unavailable</p>
  <p className="mt-1">No canonical source is configured for this deployment.</p>
  <p className="mt-1 text-amber-100/80">This section is unavailable/read-only.{reason ? ` ${reason}` : ''}</p>
  {onOpenProvenance && <button type="button" onClick={onOpenProvenance} className="mt-2 font-bold text-cyan-200 underline underline-offset-2">Open System / Provenance</button>}
</section>;

export const BlockchainCapabilityCard: React.FC<{
  requiredRole?: string | null;
  connectedWallet?: string | null;
  authorized: boolean;
  reason?: string;
  applicationPermission?: string;
}> = ({ requiredRole, connectedWallet, authorized, reason, applicationPermission }) => <section aria-label="Blockchain authorization" className={authorized ? 'rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-100' : 'rounded-xl border border-amber-500/35 bg-amber-500/5 p-3 text-xs text-amber-100'}>
  <p className="font-bold">Blockchain authorization</p>
  {applicationPermission && <p className="mt-1">Required application permission: <code>{applicationPermission}</code></p>}
  <p className="mt-1">Required role: <code>{requiredRole || 'No write action exposed'}</code></p>
  <p className="mt-1 break-all">Connected wallet: <code>{connectedWallet || 'Not connected'}</code></p>
  <p className={authorized ? 'mt-1 font-bold text-emerald-200' : 'mt-1 font-bold text-amber-200'}>Status: {authorized ? 'AUTHORIZED' : 'NOT AUTHORIZED'}</p>
  {!authorized && <p className="mt-1">Write controls unavailable.</p>}
  <details className="mt-2 text-slate-400"><summary className="cursor-pointer text-cyan-200">Technical details</summary><p className="mt-1 break-words">{reason || 'Live provider, signer, chain, runtime, and module-local role validation determine availability.'}</p></details>
</section>;

const lifecycle: AdminOperationState[] = ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REVERTED', 'STALE', 'UNAVAILABLE'];
const pipeline = ['Preflight', 'Wallet', 'Chain', 'On-chain role', 'Signature', 'Transaction', 'Receipt', 'Expected event', 'Indexer', 'API reconciliation', 'Audit'];

export const BlockchainActionStatus: React.FC<{ state: AdminOperationState | null; detail?: string | null }> = ({ state, detail }) => <section aria-label="Blockchain Action Status" className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-white">Blockchain Action Status</p><span className={state === 'CONFIRMED' ? 'font-bold text-emerald-300' : state ? 'font-bold text-amber-200' : 'font-bold text-slate-400'}>{state || 'NO TRANSACTION'}</span></div>
  <p className="mt-1 text-slate-400">{detail || 'No transaction submitted. Confirmation is never inferred from a wallet prompt or transaction hash.'}</p>
  <p className="mt-2 leading-5 text-slate-500">{pipeline.join(' → ')}</p>
  {state && !lifecycle.includes(state) && <p className="mt-1 text-amber-200">Unrecognized action state; no success is reported.</p>}
</section>;

export const AdminWriteConfirmationDialog: React.FC<{
  open: boolean;
  action: string;
  target: string;
  connectedWallet?: string | null;
  requiredRole: string;
  expectedEffect: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ open, action, target, connectedWallet, requiredRole, expectedEffect, busy = false, onCancel, onConfirm }) => {
  if (!open) return null;
  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
    <section role="alertdialog" aria-modal="true" aria-label="Review blockchain action" className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-500/40 bg-slate-900 p-5 shadow-2xl">
      <div><p className="text-xs font-black uppercase tracking-wide text-amber-300">Review blockchain action</p><h3 className="mt-1 text-lg font-black text-white">{action}</h3><p className="mt-1 text-xs text-slate-400">No transaction has been submitted.</p></div>
      <dl className="grid gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300"><div><dt className="text-slate-500">Target module</dt><dd className="mt-1 font-medium text-white">{target}</dd></div><div><dt className="text-slate-500">Connected wallet</dt><dd className="mt-1 break-all font-mono">{connectedWallet || 'Not connected'}</dd></div><div><dt className="text-slate-500">Required on-chain role</dt><dd className="mt-1 font-mono">{requiredRole}</dd></div><div><dt className="text-slate-500">Expected effect</dt><dd className="mt-1">{expectedEffect}</dd></div></dl>
      <p className="text-xs text-amber-100">Confirming opens the connected wallet. A successful display state still requires receipt, expected event, canonical indexer/API reconciliation, and audit evidence.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200">Cancel</button><button type="button" onClick={onConfirm} disabled={busy} className="rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-50">{busy ? 'Submitting…' : 'Confirm and open wallet'}</button></div>
    </section>
  </div>;
};
