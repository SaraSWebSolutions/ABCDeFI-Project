import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, ShieldAlert } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { approveLegionNFTV2Transfer, getLegionNFTV2Availability, getLegionNFTV2Territory, getLegionNFTV2TransferRequest, hasLegionNFTV2AdminCapability, legionNFTV2ErrorMessage, updateLegionNFTV2Metadata, type LegionNFTV2Availability, type LegionNFTV2Territory, type LegionNFTV2TransferRequest } from '../Services/legionNFTV2';

const unavailable: LegionNFTV2Availability = { available: false, status: 'UNAVAILABLE', paused: false };

/**
 * Canonical Phase 8 administrative read/write surface. Every record comes
 * from the hash-verified LegionNFTV2 API and every write remains role-gated
 * by LegionNFTV2 itself. It deliberately provides no public mint or market.
 */
export const CanonicalLegionNFTV2Admin: React.FC = () => {
  const wallet = useWallet();
  const [availability, setAvailability] = useState<LegionNFTV2Availability>(unavailable);
  const [isLegionAdmin, setIsLegionAdmin] = useState(false);
  const [tokenId, setTokenId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [territory, setTerritory] = useState<LegionNFTV2Territory | null>(null);
  const [request, setRequest] = useState<LegionNFTV2TransferRequest | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [population, setPopulation] = useState('');
  const [metadataURI, setMetadataURI] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshCapability = useCallback(async () => {
    try {
      const next = await getLegionNFTV2Availability();
      setAvailability(next);
      setIsLegionAdmin(Boolean(wallet.address && wallet.isCorrectNetwork && next.available && await hasLegionNFTV2AdminCapability(wallet.address, next)));
    } catch (error) {
      setAvailability(unavailable); setIsLegionAdmin(false); setMessage(legionNFTV2ErrorMessage(error));
    }
  }, [wallet.address, wallet.isCorrectNetwork]);
  useEffect(() => { void refreshCapability(); }, [refreshCapability]);

  const loadTerritory = async () => {
    setBusy('territory'); setMessage(null);
    try {
      const result = await getLegionNFTV2Territory(tokenId);
      setTerritory(result); setDisplayName(result.displayName); setPopulation(result.population); setMetadataURI(result.metadataURI);
    } catch (error) { setTerritory(null); setMessage(legionNFTV2ErrorMessage(error)); }
    finally { setBusy(null); }
  };
  const loadRequest = async () => {
    setBusy('request'); setMessage(null);
    try { setRequest(await getLegionNFTV2TransferRequest(requestId)); }
    catch (error) { setRequest(null); setMessage(legionNFTV2ErrorMessage(error)); }
    finally { setBusy(null); }
  };
  const submit = async (key: string, work: (stage: (value: string) => void) => Promise<{ hash: string }>) => {
    if (!isLegionAdmin || busy) return;
    setBusy(key); setMessage(null);
    try {
      const result = await work((stage) => setMessage(stage));
      setMessage(`Confirmed on chain: ${result.hash}. Refresh after the canonical indexer confirms it.`);
      await refreshCapability();
      if (key === 'approve' && requestId) await loadRequest();
      if (key === 'metadata' && tokenId) await loadTerritory();
    } catch (error) { setMessage(legionNFTV2ErrorMessage(error)); }
    finally { setBusy(null); }
  };

  return <section aria-label="Canonical LegionNFTV2 administration" className="space-y-4 border-t border-slate-800 pt-5">
    <header><p className="text-xs font-black uppercase tracking-wide text-cyan-300">Canonical Phase 8 administration</p><h3 className="mt-1 text-lg font-black text-white">Legion territory controls</h3><p className="mt-1 text-xs text-slate-400">Reads require a hash-verified canonical checkpoint. Controls appear only for the connected wallet holding the live <code>LEGION_ADMIN_ROLE</code>; the contract independently enforces that role.</p></header>
    {!availability.available ? <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">{availability.reason || 'Canonical LegionNFTV2 state is unavailable; no administration control is exposed.'}</p> : !isLegionAdmin ? <p className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">The connected wallet has no verified Legion administrator capability. Read lookup remains available; writes are hidden.</p> : <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">Live Legion administrator capability verified for {wallet.address}.</p>}
    {message && <p role="status" className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100"><ShieldAlert className="mr-1 inline h-3 w-3" />{message}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4"><h4 className="font-bold text-white">Territory lookup and metadata</h4><div className="flex gap-2"><input value={tokenId} onChange={(event) => setTokenId(event.target.value)} inputMode="numeric" placeholder="Territory token ID" className="field flex-1" /><button disabled={busy !== null} onClick={() => void loadTerritory()} className="rounded-lg border border-slate-600 px-3 text-xs font-bold text-slate-100 disabled:opacity-50"><Search className="mr-1 inline h-3 w-3" />Lookup</button></div>{territory && <><dl className="grid gap-2 text-xs sm:grid-cols-2"><Field label="Level" value={territory.level} /><Field label="Owner" value={territory.owner} /><Field label="Parent" value={territory.parentId} /><Field label="Identifier" value={territory.canonicalIdentifier} /><Field label="Metadata URI" value={territory.metadataURI} /></dl>{isLegionAdmin && <div className="space-y-2 border-t border-slate-800 pt-3"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" className="field w-full" /><input value={population} onChange={(event) => setPopulation(event.target.value)} inputMode="numeric" placeholder="Informational population" className="field w-full" /><input value={metadataURI} onChange={(event) => setMetadataURI(event.target.value)} placeholder="ipfs:// metadata URI" className="field w-full" /><button disabled={busy !== null} onClick={() => void submit('metadata', (stage) => updateLegionNFTV2Metadata(territory.tokenId, displayName, population, metadataURI, stage))} className="rounded-lg border border-cyan-400/60 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50">{busy === 'metadata' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Update canonical metadata</button></div>}</>}</article>
      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4"><h4 className="font-bold text-white">Controlled transfer approval</h4><div className="flex gap-2"><input value={requestId} onChange={(event) => setRequestId(event.target.value)} inputMode="numeric" placeholder="Transfer request ID" className="field flex-1" /><button disabled={busy !== null} onClick={() => void loadRequest()} className="rounded-lg border border-slate-600 px-3 text-xs font-bold text-slate-100 disabled:opacity-50"><Search className="mr-1 inline h-3 w-3" />Lookup</button></div>{request && <><dl className="grid gap-2 text-xs sm:grid-cols-2"><Field label="Token" value={`#${request.tokenId}`} /><Field label="Current owner" value={request.currentOwner} /><Field label="Proposed owner" value={request.proposedOwner} /><Field label="State" value={request.active ? request.approved ? 'ACTIVE / APPROVED' : 'ACTIVE / AWAITING APPROVAL' : 'INACTIVE'} /></dl>{isLegionAdmin && request.active && !request.approved && <button disabled={busy !== null} onClick={() => void submit('approve', (stage) => approveLegionNFTV2Transfer(request.requestId, stage))} className="rounded-lg border border-cyan-400/60 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50">{busy === 'approve' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Approve controlled transfer</button>}</>}</article>
    </div>
  </section>;
};

const Field = ({ label, value }: { label: string; value: string }) => <div><dt className="uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-all text-slate-200">{value}</dd></div>;
