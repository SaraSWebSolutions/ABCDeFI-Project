import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Gift, Image as ImageIcon, Landmark, Layers, Lock, PieChart as PieIcon, RefreshCw, Wallet } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatEther } from 'ethers';
import { useWallet } from '../Context/WalletContext';
import { getBalanceOf } from '../Services/token';
import { getProvider } from '../Services/wallet';
import { getStakingInfo } from '../Services/staking';
import { getLendingPoolState } from '../Services/lending';
import { getNftEcosystemSnapshot } from '../Services/nftEcosystem';
import { getVestingSchedule } from '../Services/vesting';
import { getReferralSnapshot } from '../Services/referral';

type PortfolioValue = string | null;

interface PortfolioMetrics {
  abcd: PortfolioValue; eth: PortfolioValue; staked: PortfolioValue; pendingStakingRewards: PortfolioValue;
  debt: PortfolioValue; collateral: PortfolioValue; healthFactor: string | null; nftCount: string | null;
  vested: PortfolioValue; releasable: PortfolioValue; referralRewards: PortfolioValue; referralCount: string | null;
}

const emptyMetrics: PortfolioMetrics = {
  abcd: null, eth: null, staked: null, pendingStakingRewards: null, debt: null, collateral: null,
  healthFactor: null, nftCount: null, vested: null, releasable: null, referralRewards: null, referralCount: null,
};

const display = (value: string | null, suffix = '') => value === null ? 'Unavailable' : `${value}${suffix}`;
const toChartValue = (value: string | null) => value === null ? 0 : Number(value);

export const PortfolioDashboard: React.FC = () => {
  const { address, isConnected, isCorrectNetwork, networkName } = useWallet();
  const [metrics, setMetrics] = useState<PortfolioMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!address || !isConnected || !isCorrectNetwork) {
      setMetrics(emptyMetrics);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      getBalanceOf(address),
      getProvider().then((provider) => provider.getBalance(address).then((balance) => formatEther(balance))),
      getStakingInfo(address), getLendingPoolState(address), getNftEcosystemSnapshot(address),
      getVestingSchedule(address), getReferralSnapshot(address),
    ]);
    const value = <T,>(index: number): T | null => results[index].status === 'fulfilled'
      ? (results[index] as PromiseFulfilledResult<T>).value : null;
    const staking = value<Awaited<ReturnType<typeof getStakingInfo>>>(2);
    const lending = value<Awaited<ReturnType<typeof getLendingPoolState>>>(3);
    const nfts = value<Awaited<ReturnType<typeof getNftEcosystemSnapshot>>>(4);
    const vesting = value<Awaited<ReturnType<typeof getVestingSchedule>>>(5);
    const referral = value<Awaited<ReturnType<typeof getReferralSnapshot>>>(6);

    if (requestId !== requestIdRef.current) return;
    setMetrics({
      abcd: value<string>(0), eth: value<string>(1), staked: staking?.stakedAmount ?? null,
      pendingStakingRewards: staking?.rewards ?? null, debt: lending?.borrowed ?? null,
      collateral: lending?.collateral ?? null,
      healthFactor: lending?.borrowed === '0.0' || lending?.borrowed === '0' ? 'No active debt' : lending?.healthFactor ?? null,
      nftCount: nfts ? (BigInt(nfts.participantBalance) + BigInt(nfts.guruBalance) + BigInt(nfts.loanBalance) + (nfts.reputation ? 1n : 0n)).toString() : null,
      vested: vesting?.totalAmount ?? null, releasable: vesting?.releasable ?? null,
      referralRewards: referral?.pendingRewards ?? null, referralCount: referral?.history.length.toString() ?? null,
    });
    if (results.some((result) => result.status === 'rejected')) {
      setError('Some portfolio contract reads are unavailable. Unavailable values have not been estimated.');
    }
    setLoading(false);
  }, [address, isConnected, isCorrectNetwork]);

  useEffect(() => {
    void refresh();
    return () => { requestIdRef.current += 1; };
  }, [refresh]);
  const chartData = useMemo(() => [
    { name: 'Liquid ABCD', value: toChartValue(metrics.abcd), color: '#f59e0b' },
    { name: 'Staked ABCD', value: toChartValue(metrics.staked), color: '#10b981' },
    { name: 'Vested ABCD', value: toChartValue(metrics.vested), color: '#8b5cf6' },
    { name: 'Referral rewards', value: toChartValue(metrics.referralRewards), color: '#06b6d4' },
  ].filter((entry) => entry.value > 0), [metrics]);
  const stateMessage = !isConnected ? 'Connect a wallet to read the portfolio.'
    : !isCorrectNetwork ? 'Switch to Hardhat Local (chain 31337) to read the portfolio.' : null;

  return <div id="portfolio-dashboard" className="space-y-6 font-mono">
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold mb-2"><Wallet className="w-3.5 h-3.5" /> On-chain portfolio</div><h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Portfolio Overview</h2><p className="text-xs text-slate-400 mt-1">Current-wallet reads from the chain-31337 deployment. USD valuation is unavailable because this deployment has no price oracle.</p></div>
        <button onClick={() => void refresh()} disabled={loading || !!stateMessage} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-2xl text-xs transition disabled:opacity-50 flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />Refresh Portfolio</button>
      </div>
      {stateMessage && <Notice message={stateMessage} />}{error && <Notice message={error} />}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5"><div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Portfolio Value</div><div className="text-3xl font-black text-emerald-400 mt-1">Unavailable</div><div className="text-xs text-slate-500 mt-1">No canonical USD price source · {networkName}</div></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <Metric title="ABCD Balance" value={display(metrics.abcd, ' ABCD')} detail="ABCDToken.balanceOf(current wallet)" icon={<Coins className="w-4 h-4 text-amber-400" />} />
      <Metric title="ETH Balance" value={display(metrics.eth, ' ETH')} detail="provider.getBalance(current wallet)" icon={<Wallet className="w-4 h-4 text-sky-400" />} />
      <Metric title="Staked ABCD" value={display(metrics.staked, ' ABCD')} detail={`Pending rewards: ${display(metrics.pendingStakingRewards, ' ABCD')}`} icon={<Layers className="w-4 h-4 text-emerald-400" />} />
      <Metric title="Lending Position" value={display(metrics.debt, ' ABCD debt')} detail={`Collateral: ${display(metrics.collateral, ' ETH')}`} icon={<Landmark className="w-4 h-4 text-purple-400" />} />
      <Metric title="Health Factor" value={metrics.healthFactor ?? 'Unavailable'} detail="Liquidation.checkLiquidationEligibility (when debt exists)" icon={<Landmark className="w-4 h-4 text-purple-400" />} />
      <Metric title="NFTs Owned" value={display(metrics.nftCount, ' NFTs')} detail="Participant + Guru + Reputation + Loan" icon={<ImageIcon className="w-4 h-4 text-rose-400" />} />
      <Metric title="Vested ABCD" value={display(metrics.vested, ' ABCD')} detail={`Claimable: ${display(metrics.releasable, ' ABCD')}`} icon={<Lock className="w-4 h-4 text-indigo-400" />} />
      <Metric title="Referral Rewards" value={display(metrics.referralRewards, ' ABCD')} detail={`Referral events: ${display(metrics.referralCount)}`} icon={<Gift className="w-4 h-4 text-cyan-400" />} />
    </div>
    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4"><h3 className="text-sm font-black text-white uppercase flex items-center gap-2"><PieIcon className="w-4 h-4 text-indigo-400" /> ABCD holdings composition</h3>{chartData.length > 0 ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">{chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} /><Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} /></PieChart></ResponsiveContainer></div> : <p className="text-sm text-slate-500">No on-chain ABCD positions are available for this wallet.</p>}</div>
  </div>;
};

const Metric = ({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) => <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-2"><div className="flex items-center justify-between text-xs font-bold text-slate-400"><span>{title}</span>{icon}</div><div className="text-xl font-black text-white break-all">{value}</div><div className="text-[10px] text-slate-500">{detail}</div></div>;
const Notice = ({ message }: { message: string }) => <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{message}</div>;

export default PortfolioDashboard;
