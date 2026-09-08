import React from 'react';
import { CONTRACTS } from '../Config/contracts';

/**
 * The retained V1 P2P surface also contains its legacy direct-pool controls.
 * Keep it visibly isolated so a user cannot mistake it for Lending V2.
 */
export default function P2PLendingDashboard(_props: { activeTab: string }) {
  return <section className="space-y-4" aria-label="Legacy Lending V1 P2P">
    <header className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Legacy Lending V1 / P2P</p>
      <h2 className="mt-1 text-lg font-black text-white">V1 lending controls are kept separate from Lending V2</h2>
      <p className="mt-2 text-xs text-amber-100/80">This retained V1 page can submit only to the V1 LendingPool: <code className="break-all font-mono text-amber-200">{CONTRACTS.lending}</code>. For the isolated V2 deposit → pending deposit ID → borrow workflow, use the <strong>Lending</strong> dashboard tab.</p>
    </header>
    <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">V1 transactions are intentionally unavailable from the normal user dashboard. Use the canonical Lending V2 workflow.</p>
  </section>;
}
