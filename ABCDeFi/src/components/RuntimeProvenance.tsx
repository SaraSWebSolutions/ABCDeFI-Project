import { JsonRpcProvider } from 'ethers';
import { useEffect, useState } from 'react';
import { ONE_Q_FRANCHISE_EXCLUDED, ONE_Q_RUNTIME_CHAIN_ID, ONE_Q_RUNTIME_FAMILY, ONE_Q_RUNTIME_RPC_URL, oneQRuntime } from '../Config/oneQRuntime';
// @ts-expect-error -- sibling .mjs runtime module has no emitted declaration.
import { ONE_Q_LOCAL_R3_TEST, verifyOneQLocalR3TestLiveChain } from '../Config/oneQLocalR3TestRuntimeFamilyResolver.mjs';

type Evidence = { status: 'checking' | 'verified' | 'unavailable'; currentBlock: string; reason: string };

export function RuntimeProvenance() {
  const [evidence, setEvidence] = useState<Evidence>({ status: 'checking', currentBlock: 'Checking…', reason: '' });
  const r3 = ONE_Q_RUNTIME_FAMILY === ONE_Q_LOCAL_R3_TEST ? oneQRuntime : null;

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const provider = new JsonRpcProvider(ONE_Q_RUNTIME_RPC_URL);
        if (r3) await verifyOneQLocalR3TestLiveChain(r3, provider);
        const current = await provider.getBlockNumber();
        if (active) setEvidence({ status: 'verified', currentBlock: String(current), reason: '' });
      } catch (error) {
        if (active) setEvidence({ status: 'unavailable', currentBlock: 'Unavailable', reason: error instanceof Error ? error.message : 'Runtime verification failed.' });
      }
    };
    void verify();
    return () => { active = false; };
  }, [r3]);

  const descriptor = r3?.descriptor;
  return <section aria-label="Canonical runtime provenance" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-xs text-slate-300">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black uppercase tracking-wide text-cyan-200">Canonical runtime provenance</p><p className="mt-1 text-slate-400">Explicit runtime selection only; network discovery never selects a runtime.</p></div><span className={`rounded-full border px-2 py-1 font-bold ${evidence.status === 'verified' ? 'border-emerald-400/50 text-emerald-200' : evidence.status === 'checking' ? 'border-amber-400/50 text-amber-200' : 'border-rose-400/50 text-rose-200'}`}>{evidence.status === 'verified' ? 'LIVE EVIDENCE VERIFIED' : evidence.status === 'checking' ? 'VERIFYING' : 'FAIL-CLOSED'}</span></div>
    <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Runtime family" value={ONE_Q_RUNTIME_FAMILY} /><Metric label="Chain ID" value={String(ONE_Q_RUNTIME_CHAIN_ID)} /><Metric label="RPC" value={ONE_Q_RUNTIME_RPC_URL} /><Metric label="Deployment identity" value={r3?.descriptor?.deploymentIdentity || oneQRuntime.manifest.deploymentIdentity} /><Metric label="Certified checkpoint" value={descriptor ? `${descriptor.checkpoint.block} · ${descriptor.checkpoint.hash}` : 'Runtime-specific provenance unavailable'} /><Metric label="Current checkpoint" value={evidence.currentBlock} /><Metric label="Topology" value={r3?.descriptor?.topology?.name || 'Canonical 1Q topology'} /><Metric label="Franchise" value={ONE_Q_FRANCHISE_EXCLUDED ? 'EXCLUDED / UNDEPLOYED' : 'Configured'} /></dl>
    {r3 && <p className="mt-3 break-all font-mono text-[11px] text-slate-400">Certified state SHA-256: {descriptor.state.sha256}</p>}
    {evidence.reason && <p role="alert" className="mt-3 break-all text-rose-200">Canonical source unavailable: {evidence.reason}</p>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-500">{label}</dt><dd className="break-all font-mono text-slate-200">{value}</dd></div>; }
