import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Gift, Link2, RefreshCw, Users } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import {
  bindReferrerCode,
  claimReferralRewards,
  createReferralCode,
  getReferralSnapshot,
  ReferralSnapshot,
} from '../Services/referral';

type TransactionState = 'idle' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

const formatAmount = (value: string) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export const ReferralSystem: React.FC = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [snapshot, setSnapshot] = useState<ReferralSnapshot | null>(null);
  const [code, setCode] = useState('');
  const [referrerCode, setReferrerCode] = useState('');
  const [state, setState] = useState<TransactionState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setSnapshot(null);
      return;
    }
    try {
      setSnapshot(await getReferralSnapshot(address));
    } catch (error: any) {
      setMessage(error?.message || 'Unable to read ReferralManager state.');
    }
  }, [address]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submitted = (transactionHash: string, stage: string) => {
    setHash(transactionHash);
    setState('confirming');
    setMessage(`${stage} submitted. Waiting for confirmation…`);
  };

  const run = async (action: () => Promise<unknown>) => {
    if (!isConnected || !address) {
      setState('error');
      setMessage('Connect a wallet before using referrals.');
      return;
    }
    if (!isCorrectNetwork) {
      setState('error');
      setMessage('Switch to the configured network before using referrals.');
      return;
    }
    setMessage(null);
    setHash(null);
    setState('awaiting-wallet');
    try {
      await action();
      setState('success');
      setMessage('Confirmed on-chain.');
      await refresh();
    } catch (error: any) {
      setState('error');
      setMessage(error?.shortMessage || error?.message || 'Referral transaction failed.');
    }
  };

  const copyLink = async () => {
    if (!snapshot?.referralLink) return;
    await navigator.clipboard.writeText(snapshot.referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const busy = state === 'awaiting-wallet' || state === 'confirming';
  const claimable = Number(snapshot?.pendingRewards || '0') > 0;

  return (
    <div className="space-y-6 font-mono">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2"><Gift className="w-3.5 h-3.5" /> On-chain referral state</div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2"><Users className="w-6 h-6 text-emerald-400" /> ABCDeFi Referral Manager</h2>
            <p className="text-xs text-slate-400 mt-1">The deployed contract pays one-level {snapshot ? `${Number(snapshot.rewardBps) / 100}%` : '—'} rewards only when its authorized purchase pipeline records a purchase.</p>
          </div>
          <button onClick={() => void refresh()} disabled={!address || busy} className="px-3 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>

        {!address ? <p className="text-amber-300 text-sm">Connect a wallet to read your ReferralManager state.</p> : <>
          {snapshot?.paused && <p className="text-amber-300 text-sm">ReferralManager is paused; write actions are unavailable.</p>}
          {snapshot?.referralCode ? <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2"><div className="text-xs text-slate-400">Your on-chain referral code</div><div className="flex gap-2"><input readOnly value={snapshot.referralCode} className="flex-1 bg-slate-900 rounded-xl px-3 py-2 text-emerald-300" /><button onClick={() => void copyLink()} className="px-3 py-2 bg-emerald-600 rounded-xl">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></div><p className="text-xs text-slate-500 break-all">{snapshot.referralLink}</p></div> : <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-2"><input value={code} onChange={e => setCode(e.target.value)} placeholder="Create a code (min. 4 characters)" disabled={busy || snapshot?.paused} className="flex-1 bg-slate-900 rounded-xl px-3 py-2" /><button disabled={busy || snapshot?.paused} onClick={() => void run(() => createReferralCode(code, submitted))} className="px-4 py-2 bg-emerald-600 rounded-xl disabled:opacity-50">Create code</button></div>}
          {!snapshot?.referrer && <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-2"><input value={referrerCode} onChange={e => setReferrerCode(e.target.value)} placeholder="Enter a referrer’s on-chain code" disabled={busy || snapshot?.paused} className="flex-1 bg-slate-900 rounded-xl px-3 py-2" /><button disabled={busy || snapshot?.paused} onClick={() => void run(() => bindReferrerCode(referrerCode, submitted))} className="px-4 py-2 bg-cyan-700 rounded-xl disabled:opacity-50 flex gap-2 justify-center"><Link2 className="w-4 h-4" /> Bind referrer</button></div>}
        </>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Metric label="Bound referrer" value={snapshot?.referrer ? shortAddress(snapshot.referrer) : 'None'} />
        <Metric label="Pending rewards" value={snapshot ? `${formatAmount(snapshot.pendingRewards)} ABCD` : 'Unavailable'} />
        <Metric label="Claimed rewards" value={snapshot ? `${formatAmount(snapshot.claimedRewards)} ABCD` : 'Unavailable'} />
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex justify-between gap-3 items-center"><div><h3 className="font-bold text-white">On-chain claim</h3><p className="text-xs text-slate-500">The button is enabled only when ReferralManager reports a nonzero pending amount.</p></div><button disabled={!claimable || busy || snapshot?.paused} onClick={() => void run(() => claimReferralRewards(submitted))} className="px-4 py-2 bg-emerald-600 rounded-xl disabled:opacity-50">Claim rewards</button></div>
        {hash && <p className="text-xs text-cyan-300 break-all">Transaction: {hash}</p>}
        {message && <p className={`text-sm ${state === 'error' ? 'text-red-300' : state === 'success' ? 'text-emerald-300' : 'text-slate-300'}`}>{message}</p>}
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5"><h3 className="font-bold text-white mb-3">Recorded eligible purchases</h3>{snapshot?.history.length ? <div className="space-y-2">{snapshot.history.map((entry, index) => <div key={`${entry.buyer}-${entry.timestamp}-${index}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs border-b border-slate-800 pb-2"><span className="text-slate-300">Buyer {shortAddress(entry.buyer)}</span><span>{formatAmount(entry.purchaseAmount)} ABCD purchase</span><span className="text-emerald-300">{formatAmount(entry.rewardAmount)} ABCD reward</span></div>)}</div> : <p className="text-sm text-slate-500">No eligible purchase has been recorded for this referrer.</p>}</div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold text-white mt-1">{value}</p></div>;

export default ReferralSystem;
