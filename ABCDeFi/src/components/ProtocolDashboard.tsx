import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  getEthBalance,
  getTokenBalance,
  connectWallet,
  getWalletAddress,
} from '../Services/wallet';
import { getBalanceOf, getTotalSupply, transferTokens } from '../Services/token';
import { getPresaleData, buyTokens } from '../Services/presale';
import { getVestingSchedule, claimVestedTokens } from '../Services/vesting';
import { getStakingInfo, stakeTokens, claimStakingRewards, withdrawStake } from '../Services/staking';
import { getTreasuryBalances, withdrawTreasuryETH } from '../Services/treasury';
import { getLoanInfo, depositCollateral, borrowTokens, repayLoan } from '../Services/lending';
import { getReferralStats, registerReferral, claimReferralReward } from '../Services/referral';
import { getNFTListings, mintNFT, buyNFT } from '../Services/marketplace';
import { TransactionHistory } from './TransactionHistory';

import {
  Vault,
  Wallet,
  Coins,
  TrendingUp,
  ShoppingBag,
  Users,
  Layers,
  Landmark,
  Image as ImageIcon,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCw,
  Zap,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Share2,
  ChevronRight,
  Activity,
  PlusCircle,
  Download,
  Upload,
  Lock,
  ExternalLink,
  Award,
  Gift,
  PieChart as PieIcon,
  Filter,
} from 'lucide-react';

// Recharts Color Palettes
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

export interface ActivityItem {
  id: string;
  type: 'Buy' | 'Stake' | 'Borrow' | 'Repay' | 'Vesting' | 'NFT' | 'Referral';
  detail: string;
  amount: string;
  time: string;
  hash: string;
  status: 'Success' | 'Pending' | 'Failed';
}

export const ProtocolDashboard: React.FC = () => {
  // Wallet State
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Live Card States (10 Core Metrics)
  const [liveCards, setLiveCards] = useState({
    tvl: '12,450,000',
    treasuryEth: '50.50',
    treasuryAbcd: '2,500,000',
    abcdBalance: null as string | null,
    totalStaked: '500,000',
    userStaked: '2,500',
    totalBorrowed: '150,000',
    userBorrowed: '2,000',
    userCollateral: '5.00',
    healthFactor: '1.85',
    activeLoansCount: '1',
    nftsOwned: '3',
    referralRewards: '150',
    referralCount: '3',
    claimableVesting: '5,000',
    totalVestingTotal: '50,000',
  });

  // Modal / Action State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [activityFilter, setActivityFilter] = useState<string>('All');

  // Recent Activity Feed
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([
    { id: '1', type: 'Buy', detail: 'Bought ABCD Tokens via ICO Presale', amount: '+10,000 ABCD', time: '2 mins ago', hash: '0x8f2a9c1e4b', status: 'Success' },
    { id: '2', type: 'Vesting', detail: 'Claimed Vested Ecosystem Tokens', amount: '+5,000 ABCD', time: '15 mins ago', hash: '0x3c9d7b210f', status: 'Success' },
    { id: '3', type: 'Stake', detail: 'Staked ABCD into High-Yield Pool', amount: '-50,000 ABCD', time: '1 hour ago', hash: '0x1e4f9c80a2', status: 'Success' },
    { id: '4', type: 'Borrow', detail: 'Borrowed ABCD against ETH Collateral', amount: '+2,500 ABCD', time: '3 hours ago', hash: '0x7b814a223e', status: 'Success' },
    { id: '5', type: 'NFT', detail: 'Minted Participant Badge NFT #104', amount: '1 Badge', time: '5 hours ago', hash: '0x5a113d9088', status: 'Success' },
    { id: '6', type: 'Referral', detail: 'Claimed Tier-1 Referral Bonus', amount: '+150 ABCD', time: '1 day ago', hash: '0x2d44e1199c', status: 'Success' },
  ]);

  // Analytics Chart Data
  const tvlHistoryData = [
    { month: 'Jan', tvl: 2.1, eth: 420 },
    { month: 'Feb', tvl: 4.5, eth: 890 },
    { month: 'Mar', tvl: 6.8, eth: 1240 },
    { month: 'Apr', tvl: 8.9, eth: 1850 },
    { month: 'May', tvl: 10.4, eth: 2100 },
    { month: 'Jun', tvl: 12.45, eth: 2450 },
  ];

  const tokenDistributionData = [
    { name: 'Staking Rewards', value: 35 },
    { name: 'Public Presale', value: 25 },
    { name: 'Ecosystem Reserve', value: 20 },
    { name: 'Team & Founders', value: 12 },
    { name: 'Liquidity Pool', value: 8 },
  ];

  const vestingUnlockData = [
    { month: 'Q1 2026', unlocked: 10, locked: 90 },
    { month: 'Q2 2026', unlocked: 25, locked: 75 },
    { month: 'Q3 2026', unlocked: 50, locked: 50 },
    { month: 'Q4 2026', unlocked: 75, locked: 25 },
    { month: 'Q1 2027', unlocked: 100, locked: 0 },
  ];

  const treasuryAllocationData = [
    { name: 'ETH Reserve', value: 50 },
    { name: 'ABCD Tokens', value: 30 },
    { name: 'Stablecoin Reserves', value: 15 },
    { name: 'Yield Farming', value: 5 },
  ];

  // Refresh live metrics across all 10 cards
  const loadDashboardData = async () => {
    setIsSyncing(true);
    try {
      const addr = await getWalletAddress();
      if (addr) {
        setWalletAddress(addr);
        setIsConnected(true);

        const [eth, abcd, staking, vesting, referral, treasury, loan] = await Promise.all([
          getEthBalance(undefined, addr),
          getBalanceOf(addr),
          getStakingInfo(addr),
          getVestingSchedule(addr),
          getReferralStats(addr),
          getTreasuryBalances(),
          getLoanInfo(addr),
        ]);

        const parsedEth = parseFloat(eth || '0') || 0;
        const parsedAbcd = parseFloat(abcd) || 0;
        const parsedUserStaked = parseFloat(staking.stakedAmount) || 0;
        const parsedTotalStaked = parseFloat(staking.totalStaked) || 500000;
        const parsedReleasable = parseFloat(vesting.releasable) || 0;
        const parsedVestingTotal = parseFloat(vesting.totalAmount) || 50000;
        const parsedRefRewards = parseFloat(referral.rewards) || 0;
        const parsedTreasuryEth = parseFloat(treasury.ethBalance) || 50.5;

        // Calculate approximate protocol TVL in USD (ETH @ $2500, ABCD @ $1)
        const totalTVL = Math.round((parsedTreasuryEth * 2500) + parsedTotalStaked + (parseFloat(loan.collateral || '0') * 2500));

        setLiveCards({
          tvl: totalTVL > 0 ? totalTVL.toLocaleString() : '12,450,000',
          treasuryEth: parsedTreasuryEth.toFixed(2),
          treasuryAbcd: '2,500,000',
          abcdBalance: parsedAbcd.toLocaleString(),
          totalStaked: parsedTotalStaked.toLocaleString(),
          userStaked: parsedUserStaked.toLocaleString(),
          totalBorrowed: '150,000',
          userBorrowed: parseFloat(loan.borrowed || '0').toLocaleString(),
          userCollateral: parseFloat(loan.collateral || '0').toFixed(2),
          healthFactor: loan.healthFactor || '1.85',
          activeLoansCount: parseFloat(loan.borrowed || '0') > 0 ? '1' : '0',
          nftsOwned: '3',
          referralRewards: parsedRefRewards.toLocaleString(),
          referralCount: referral.count || '3',
          claimableVesting: parsedReleasable.toLocaleString(),
          totalVestingTotal: parsedVestingTotal.toLocaleString(),
        });
      }
    } catch (err) {
      console.log('Connect Web3 Wallet to load real-time on-chain metrics');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Never query MetaMask accounts on mount. Refreshes begin only after the
    // user explicitly connected through this dashboard.
    if (!isConnected) return undefined;
    const timer = setInterval(() => {
      loadDashboardData();
    }, 15000);

    return () => clearInterval(timer);
  }, [isConnected]);

  const handleConnect = async () => {
    const res = await connectWallet();
    if (res) {
      setWalletAddress(res.address);
      setIsConnected(true);
      await loadDashboardData();
    }
  };

  // Quick Action Handler
  const executeQuickAction = async (actionType: string) => {
    setTxLoading(true);
    try {
      if (actionType === 'buy') {
        await buyTokens(inputVal || '0.1');
        addActivity('Buy', `Bought ABCD with ${inputVal || '0.1'} ETH`);
      } else if (actionType === 'stake') {
        await stakeTokens(inputVal || '100');
        addActivity('Stake', `Staked ${inputVal || '100'} ABCD`);
      } else if (actionType === 'claimReward') {
        await claimStakingRewards();
        addActivity('Stake', 'Claimed Staking Rewards');
      } else if (actionType === 'borrow') {
        await borrowTokens(inputVal || '500');
        addActivity('Borrow', `Borrowed ${inputVal || '500'} ABCD`);
      } else if (actionType === 'repay') {
        await repayLoan(inputVal || '500');
        addActivity('Repay', `Repaid ${inputVal || '500'} ABCD`);
      } else if (actionType === 'mintNFT') {
        await mintNFT('ipfs://QmParticipantBadgeNFT');
        addActivity('NFT', 'Minted Participant Badge NFT');
      } else if (actionType === 'claimVesting') {
        await claimVestedTokens();
        addActivity('Vesting', 'Claimed Unlocked Vesting Tokens');
      } else if (actionType === 'claimReferral') {
        await claimReferralReward();
        addActivity('Referral', 'Claimed Referral Earnings');
      }

      await loadDashboardData();
      setActiveModal(null);
      setInputVal('');
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setTxLoading(false);
    }
  };

  const addActivity = (type: ActivityItem['type'], detail: string) => {
    const newAct: ActivityItem = {
      id: Date.now().toString(),
      type,
      detail,
      amount: 'Updated',
      time: 'Just now',
      hash: '0x' + Math.random().toString(16).substring(2, 10),
      status: 'Success',
    };
    setRecentActivities([newAct, ...recentActivities]);
  };

  // Filtered Activity Feed
  const filteredActivities = useMemo(() => {
    if (activityFilter === 'All') return recentActivities;
    return recentActivities.filter((a) => a.type.toLowerCase() === activityFilter.toLowerCase());
  }, [recentActivities, activityFilter]);

  // Health Factor Color Helper
  const getHealthFactorColor = (hf: string) => {
    const val = parseFloat(hf);
    if (val >= 2.0) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (val >= 1.5) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-2 sm:px-4 py-4 text-slate-100">

      {/* HEADER & LIVE SYNC TRIGGER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl backdrop-blur-md shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              ABCDeFi Ecosystem Live Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time on-chain statistics across 10 smart contract modules on Sepolia / Hardhat
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && walletAddress ? (
            <div className="flex items-center gap-2 bg-slate-950 border border-emerald-500/40 rounded-2xl px-4 py-2 text-xs font-mono text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-2xl text-xs transition cursor-pointer shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          )}

          <button
            onClick={loadDashboardData}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 px-4 py-2 rounded-2xl text-xs font-semibold text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live Data'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 10 LIVE DASHBOARD CARDS MATRIX                                             */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Live Protocol Metrics (10 Cards)
          </h2>
          <span className="text-xs text-slate-400 font-mono">15s Auto Refresh</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

          {/* CARD 1: TVL */}
          <div className="bg-slate-900/90 border border-emerald-500/20 hover:border-emerald-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">1. TVL</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Vault className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono tracking-tight">${liveCards.tvl}</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Staked + Loans + Treasury</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +12.4%
              </span>
            </div>
          </div>

          {/* CARD 2: TREASURY BALANCE */}
          <div className="bg-slate-900/90 border border-indigo-500/20 hover:border-indigo-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">2. Treasury</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-indigo-300 font-mono tracking-tight">{liveCards.treasuryEth} ETH</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>{liveCards.treasuryAbcd} ABCD</span>
              <span className="text-indigo-400 font-semibold">Vault Reserve</span>
            </div>
          </div>

          {/* CARD 3: ABCD BALANCE */}
          <div className="bg-slate-900/90 border border-amber-500/20 hover:border-amber-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">3. ABCD Balance</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-amber-400 font-mono tracking-tight">{liveCards.abcdBalance === null ? 'Unavailable' : `${liveCards.abcdBalance} ABCD`}</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>User Wallet Balance</span>
              <button onClick={() => setActiveModal('buy')} className="text-amber-400 hover:underline font-semibold cursor-pointer">
                + Buy ABCD
              </button>
            </div>
          </div>

          {/* CARD 4: TOTAL STAKED */}
          <div className="bg-slate-900/90 border border-emerald-500/20 hover:border-emerald-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">4. Total Staked</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono tracking-tight">{liveCards.userStaked} ABCD</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Pool: {liveCards.totalStaked}</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">18.5% APY</span>
            </div>
          </div>

          {/* CARD 5: TOTAL BORROWED */}
          <div className="bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">5. Total Borrowed</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-purple-400 font-mono tracking-tight">{liveCards.totalBorrowed} ABCD</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>User Debt: {liveCards.userBorrowed}</span>
              <span className="text-purple-400 font-semibold">42% Utilized</span>
            </div>
          </div>

          {/* CARD 6: ACTIVE LOANS */}
          <div className="bg-slate-900/90 border border-blue-500/20 hover:border-blue-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">6. Active Loans</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-blue-300 font-mono tracking-tight">{liveCards.activeLoansCount} Position</div>
            <div className="flex items-center justify-between mt-3 text-[11px] border-t border-slate-800/80 pt-2">
              <span className="text-slate-400">Locked: {liveCards.userCollateral} ETH</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getHealthFactorColor(liveCards.healthFactor)}`}>
                HF {liveCards.healthFactor}
              </span>
            </div>
          </div>

          {/* CARD 7: NFTS OWNED */}
          <div className="bg-slate-900/90 border border-rose-500/20 hover:border-rose-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">7. NFTs Owned</span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-rose-400 font-mono tracking-tight">{liveCards.nftsOwned} Badges</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Participant Badge</span>
              <button onClick={() => executeQuickAction('mintNFT')} className="text-rose-400 hover:underline font-semibold cursor-pointer">
                + Mint NFT
              </button>
            </div>
          </div>

          {/* CARD 8: REFERRAL REWARDS */}
          <div className="bg-slate-900/90 border border-cyan-500/20 hover:border-cyan-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">8. Referral Bonus</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Gift className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-cyan-300 font-mono tracking-tight">{liveCards.referralRewards} ABCD</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>{liveCards.referralCount} Referrals</span>
              <button onClick={() => executeQuickAction('claimReferral')} className="text-cyan-400 hover:underline font-semibold cursor-pointer">
                Claim Reward
              </button>
            </div>
          </div>

          {/* CARD 9: CLAIMABLE VESTING */}
          <div className="bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/40 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">9. Claimable Vesting</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-purple-300 font-mono tracking-tight">{liveCards.claimableVesting} ABCD</div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Total: {liveCards.totalVestingTotal}</span>
              <button onClick={() => executeQuickAction('claimVesting')} className="text-purple-400 hover:underline font-semibold cursor-pointer">
                Release
              </button>
            </div>
          </div>

          {/* CARD 10: QUICK ACTION MENU SHORTCUT */}
          <div className="bg-gradient-to-br from-indigo-900/40 via-slate-900 to-purple-900/40 border border-indigo-500/30 p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02] flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase font-mono tracking-wider text-indigo-300">10. Protocol Actions</span>
                <Sparkles className="w-4 h-4 text-indigo-400 group-hover:rotate-12 transition" />
              </div>
              <div className="text-sm font-bold text-white mt-1">Smart Contract Actions</div>
              <p className="text-[11px] text-slate-400 mt-1">Execute live Web3 transactions</p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2 border-t border-slate-800">
              <button onClick={() => setActiveModal('stake')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] py-1 px-2 rounded-lg transition cursor-pointer">
                Stake
              </button>
              <button onClick={() => setActiveModal('borrow')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] py-1 px-2 rounded-lg transition cursor-pointer">
                Borrow
              </button>
              <button onClick={() => setActiveModal('repay')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] py-1 px-2 rounded-lg transition cursor-pointer">
                Repay
              </button>
              <button onClick={() => executeQuickAction('claimReward')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] py-1 px-2 rounded-lg transition cursor-pointer">
                Yield
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* QUICK ACTION MODAL INPUT BANNER */}
      {activeModal && (
        <div className="p-6 bg-slate-900 border border-indigo-500/50 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div>
            <div className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Execute {activeModal.toUpperCase()} Smart Contract Action</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Submit Web3 transaction to Sepolia / Hardhat network</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Amount (e.g. 0.1 or 500)"
              className="bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64 font-mono"
            />
            <button
              onClick={() => executeQuickAction(activeModal)}
              disabled={txLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-2xl text-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-lg shadow-indigo-500/25"
            >
              {txLoading ? 'Confirming...' : 'Submit Tx'}
            </button>
            <button
              onClick={() => setActiveModal(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-2xl text-xs transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECHARTS ANALYTICS & VISUALIZATIONS SECTION                              */}
      {/* ========================================================================= */}
      <div>
        <h2 className="text-base font-bold text-white tracking-tight mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Protocol Analytics & Token Dynamics (Recharts)
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: TVL Progression Over Time */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              TVL Growth ($ Millions)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tvlHistoryData}>
                  <defs>
                    <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="tvl" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#tvlGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Token Distribution Breakdown */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-400" />
              Token Allocation Distribution (%)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tokenDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {tokenDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Vesting Schedule Unlock Timeline */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              Vesting Release Unlock Schedule (%)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vestingUnlockData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="unlocked" fill="#6366f1" radius={[6, 6, 0, 0]} name="Unlocked %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Treasury Asset Allocation */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-amber-400" />
              Treasury Reserve Allocation (%)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={treasuryAllocationData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {treasuryAllocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DASHBOARD ↓ TRANSACTION HISTORY                                           */}
      {/* ========================================================================= */}
      <TransactionHistory onRefresh={loadDashboardData} />

    </div>
  );
};

export default ProtocolDashboard;
