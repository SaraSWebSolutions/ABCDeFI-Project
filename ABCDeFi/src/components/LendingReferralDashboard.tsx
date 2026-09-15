import React, { useCallback, useEffect, useState } from 'react';
import { formatEther } from 'ethers';
import { useWallet } from '../Context/WalletContext';
import { getLendingReferralProjection, type LendingReferralProjection } from '../Services/lendingReferralV2';
import { LendingReferralPanel } from './LendingV2';
import { Card, Empty, Metric, Metrics, ReadError, secondary, timestamp } from './lendingV2/LendingV2Presentation';

const amount = (value: string) => `${formatEther(value)} ABCD`;

/**
 * The dashboard-level referral entry point is deliberately lending-only.  It
 * renders the same LendingReferralManagerV2 controls as Lending V2 plus the
 * backend's indexed-event projection; it never falls back to legacy ICO data.
 */
export const LendingReferralDashboard: React.FC = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const wallet = isConnected && address ? address.toLowerCase() : '';
  const [projection, setProjection] = useState<LendingReferralProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!wallet) { setProjection(null); setError(null); return; }
    setLoading(true); setError(null);
    try { setProjection(await getLendingReferralProjection(wallet)); }
    catch (reason) { setProjection(null); setError(reason instanceof Error ? reason.message : 'Canonical lending referral projection is unavailable.'); }
    finally { setLoading(false); }
  }, [wallet]);
  useEffect(() => { void refresh(); }, [refresh]);

  return <section className="space-y-5">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Canonical Lending V2</p><h2 className="mt-1 text-3xl font-bold text-white">Lending referrals</h2><p className="mt-2 text-sm text-slate-300">This page is the on-chain LendingReferralManagerV2 product. It is separate from legacy ICO/presale referral records.</p></header>
    {!wallet ? <Empty>Connect a wallet to read or manage canonical lending referrals.</Empty> : <>
      <LendingReferralPanel wallet={wallet} canWrite={isCorrectNetwork} />
      <Card title="Indexed lending referral projection">
        <div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-400">Canonical V2 events are indexed for provenance; reward eligibility is reconciled against live contract state.</p><button className={secondary} disabled={loading} onClick={() => void refresh()}>{loading ? 'Refreshing…' : 'Refresh projection'}</button></div>
        <ReadError error={error} retry={() => void refresh()} />
        {projection && <><Metrics><Metric label="Referral contract" value={projection.contract} /><Metric label="Your lending code" value={projection.code || 'None'} /><Metric label="Bound referrer" value={projection.referrer || 'None'} /><Metric label="Reward vault" value={projection.rewardVault} /><Metric label="Monthly reward basis" value={`${Number(projection.monthlyRewardBps) / 100}%`} /><Metric label="Maximum periods" value={projection.maxRewardPeriods} /></Metrics>
          {projection.records.length ? <div className="mt-4 space-y-4">{projection.records.map((record) => <div key={`${record.loanId}:${record.referred}`} className="rounded-xl border border-slate-700 bg-slate-950/40 p-4"><Metrics><Metric label="Loan ID" value={record.loanId} /><Metric label="Request ID" value={record.requestId === '0' ? 'Direct lending' : record.requestId} /><Metric label="Referral role" value={record.isLenderReferral ? 'Lender referral' : 'Borrower referral'} /><Metric label="Referred party" value={record.referred} /><Metric label="Referrer" value={record.referrer} /><Metric label="Status" value={record.status} /><Metric label="Accrued accounting amount" value={amount(record.accruedAmount)} /><Metric label="Claimable aggregate amount" value={record.claimable ? amount(record.claimableAmount) : 'Not currently claimable'} /><Metric label="Paid periods" value={record.paidPeriods} /><Metric label="Aggregate rewards paid" value={amount(record.totalRewards)} /><Metric label="Completion" value={record.completedAt === '0' ? 'Not completed' : timestamp(record.completedAt)} /></Metrics>
            {record.certificate ? <Metrics><Metric label="Referral certificate ID" value={record.certificate.tokenId} /><Metric label="Certificate owner" value={record.certificate.owner} /><Metric label="Principal-based accounting value" value={amount(record.certificate.value)} /><Metric label="Metadata URI" value={record.certificate.uri} /><Metric label="Metadata hash" value={record.certificate.metadataHash} /><Metric label="Transferability" value="Unavailable in whitepaper; current contract is non-transferable" /></Metrics> : <p className="mt-3 text-xs text-slate-400">No referral certificate is recorded. It can only exist after successful loan completion and is never inferred.</p>}</div>)}</div> : <Empty>No canonical V2 lending referral relationship is indexed for this wallet.</Empty>}</>}
      </Card>
    </>}
  </section>;
};
