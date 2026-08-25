import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  Wallet,
  Zap,
  DollarSign,
  Coins,
  Gift,
  CreditCard,
  Image as ImageIcon
} from 'lucide-react';
import { formatUnits } from 'ethers';
import { getStakingInfo } from '../Services/staking';
import { getNftEcosystemSnapshot } from '../Services/nftEcosystem';
import { getBalanceOf } from '../Services/token';
import { CONTRACTS } from '../Config/contracts';

interface NextGenProtocolDashboardProps {
  userAddress?: string;
  userEmail?: string;
  kycStatus?: string;
  onNavigateTab?: (tab: string) => void;
}

interface DashboardSummary {
  portfolio: { totalValue: string; borrowed: string; lent: string; interestEarned: string };
  protocol: { totalStaked: string; activeDebtVolume: string; onlineUsers: number };
}

function formatAbcd(value: string | null | undefined) {
  if (value === null || value === undefined) return 'Unavailable';
  try {
    return Number(formatUnits(BigInt(value), 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return 'Unavailable';
  }
}

function formatAbcdWithUnit(value: string | null | undefined) {
  const formatted = formatAbcd(value);
  return formatted === 'Unavailable' ? formatted : `${formatted} ABCD`;
}

interface OnChainDashboardData {
  stakedAbcd: string | null;
  pendingRewardsAbcd: string | null;
  supportedNftCount: string | null;
  treasuryAbcd: string | null;
}

const EMPTY_ON_CHAIN_DATA: OnChainDashboardData = {
  stakedAbcd: null,
  pendingRewardsAbcd: null,
  supportedNftCount: null,
  treasuryAbcd: null,
};

import { useWallet } from '../Context/WalletContext';
import { useAuth } from '../Context/AuthContext';

export const NextGenProtocolDashboard: React.FC<NextGenProtocolDashboardProps> = ({
  userAddress,
  userEmail,
  kycStatus = 'unverified',
  onNavigateTab,
}) => {
  const wallet = useWallet();
  const { token, logout } = useAuth();
  // A profile's historically linked address is not proof of a current wallet
  // connection. Use only the explicit WalletContext session address.
  const address = wallet.address || '';
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';
  const normalizedKycStatus = kycStatus.toLowerCase();
  const isKycApproved = normalizedKycStatus === 'approved';
  const isWalletConnected = wallet.isConnected;
  const isRegistered = isWalletConnected || !!wallet.address;
  const networkName = wallet.networkName || 'Not Connected';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [onChainData, setOnChainData] = useState<OnChainDashboardData>(EMPTY_ON_CHAIN_DATA);
  const [onChainLoading, setOnChainLoading] = useState(false);
  const [onChainError, setOnChainError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadSummary = async () => {
      try {
        const response = await fetch('/api/dashboard/summary', { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          logout();
          return;
        }
        if (!response.ok || !data.success) throw new Error(data.message || 'Dashboard summary is unavailable.');
        if (active) {
          setSummary(data);
          setSummaryError('');
        }
      } catch (summaryLoadError) {
        if (active) {
          setSummaryError(summaryLoadError instanceof Error ? summaryLoadError.message : 'Dashboard summary is unavailable.');
        }
      }
    };
    void loadSummary();
    return () => { active = false; };
  }, [logout, token]);

  useEffect(() => {
    if (!wallet.address || !wallet.isCorrectNetwork) {
      setOnChainData(EMPTY_ON_CHAIN_DATA);
      setOnChainError('');
      setOnChainLoading(false);
      return;
    }
    let active = true;
    setOnChainLoading(true);
    setOnChainError('');
    void Promise.allSettled([
      getStakingInfo(wallet.address),
      getNftEcosystemSnapshot(wallet.address),
      getBalanceOf(CONTRACTS.treasury),
    ]).then(([staking, nfts, treasury]) => {
      if (!active) return;
      setOnChainData({
        stakedAbcd: staking.status === 'fulfilled' ? staking.value.stakedAmount : null,
        pendingRewardsAbcd: staking.status === 'fulfilled' ? staking.value.rewards : null,
        supportedNftCount: nfts.status === 'fulfilled'
          ? (BigInt(nfts.value.participantBalance) + BigInt(nfts.value.guruBalance) + BigInt(nfts.value.loanBalance) + (nfts.value.reputation ? 1n : 0n)).toString()
          : null,
        treasuryAbcd: treasury.status === 'fulfilled' ? treasury.value : null,
      });
      if ([staking, nfts, treasury].some((result) => result.status === 'rejected')) {
        setOnChainError('Some on-chain dashboard data is unavailable.');
      }
    }).catch(() => {
      if (active) setOnChainError('On-chain dashboard data is unavailable.');
    }).finally(() => {
      if (active) setOnChainLoading(false);
    });
    return () => { active = false; };
  }, [wallet.address, wallet.isCorrectNetwork]);

  return (
    <div className="space-y-6 font-sans antialiased text-slate-100">

      {/* 1. TOP PROTOCOL ROLE SWITCHER & STATUS BAR */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-indigo-500/25 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Protocol Status: Healthy
                </span>
                <span className="text-xs text-slate-400 font-mono font-semibold">Local indexed-data view</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
                ABCDeFi Web3 Financial Operating System
              </h1>
            </div>
          </div>

        </div>

        {/* METRICS QUICK STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Your Staked ABCD</div>
            <div className="text-sm font-black text-slate-300 mt-0.5">{onChainLoading ? 'Loading…' : onChainData.stakedAbcd === null ? 'Unavailable' : `${onChainData.stakedAbcd} ABCD`}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Active Debt Volume</div>
            <div className="text-sm font-black text-emerald-400 mt-0.5">{formatAbcdWithUnit(summary?.protocol.activeDebtVolume)}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Supported NFT Holdings</div>
            <div className="text-sm font-black text-slate-300 mt-0.5">{onChainLoading ? 'Loading…' : onChainData.supportedNftCount === null ? 'Unavailable' : onChainData.supportedNftCount}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Treasury ABCD</div>
            <div className="text-sm font-black text-cyan-400 mt-0.5">{onChainLoading ? 'Loading…' : onChainData.treasuryAbcd === null ? 'Unavailable' : `${onChainData.treasuryAbcd} ABCD`}</div>
          </div>
        </div>
      </div>



      {/* 2. THREE-COLUMN INITIAL DASHBOARD CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        {/* Column 1: Identity Verification Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Identity Verification
            </h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-bold">Secure</span>
          </div>
          
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Wallet</span>
              <span className="font-mono text-white bg-slate-950 px-2 py-1 rounded border border-slate-800/80">{shortAddress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Email</span>
              <span className="font-bold text-slate-200 flex items-center gap-1">{userEmail || 'Not available'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">KYC Status</span>
              <span className={isKycApproved ? 'font-bold text-emerald-400 flex items-center gap-1' : 'font-bold text-amber-400 flex items-center gap-1'}>{isKycApproved ? 'Approved ✅' : normalizedKycStatus === 'rejected' ? 'Rejected' : normalizedKycStatus === 'pending' ? 'Pending' : 'Unverified'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">AML Screen</span>
              <span className="font-bold text-slate-300 flex items-center gap-1">Not available</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Network</span>
              <span className="font-bold text-slate-200">{networkName}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Wallet Details Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" /> Wallet Balance
            </h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-bold">MetaMask</span>
          </div>
          
          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Status</span>
              <span className={isWalletConnected ? 'font-bold text-emerald-400 flex items-center gap-1' : 'font-bold text-amber-400 flex items-center gap-1'}>{isWalletConnected ? 'Connected ✅' : 'Not connected'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Address</span>
              <span className="font-mono text-slate-300">{shortAddress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Network</span>
              <span className="font-bold text-slate-200">{networkName}</span>
            </div>
            <div className="border-t border-slate-800/80 pt-2 flex justify-between items-end">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Crypto Assets</span>
                <span className="text-base font-black text-white">{wallet.balanceBNB === null ? 'Unavailable' : `${wallet.balanceBNB} ETH`}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Protocol Balance</span>
                <span className="text-base font-black text-emerald-400">
                  {wallet.balanceABCD === null ? 'Unavailable' : `${wallet.balanceABCD} ABCD`}
                </span>
              </div>
            </div>
            <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
              <span className="text-slate-400">Pending staking rewards</span>
              <span className="font-bold text-violet-300">{onChainLoading ? 'Loading…' : onChainData.pendingRewardsAbcd === null ? 'Unavailable' : `${onChainData.pendingRewardsAbcd} ABCD`}</span>
            </div>
          </div>
        </div>

        {/* Column 3: Verification Checklist */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Platform Security Pipeline
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-lg font-bold">State-derived</span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-300 font-bold">Registration</span>
              <span className="text-slate-300 font-black flex items-center gap-1">{userEmail ? 'Authenticated' : 'Not authenticated'}</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-300 font-bold">Wallet</span>
              <span className={isWalletConnected ? 'text-emerald-400 font-black flex items-center gap-1' : 'text-amber-400 font-black flex items-center gap-1'}>{isWalletConnected ? 'Connected ✅' : 'Not connected'}</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-300 font-bold">KYC</span>
              <span className={isKycApproved ? 'text-emerald-400 font-black flex items-center gap-1' : 'text-amber-400 font-black flex items-center gap-1'}>{isKycApproved ? 'Approved ✅' : 'Pending'}</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-300 font-bold">Platform</span>
              <span className="text-slate-300 font-black flex items-center gap-1">{isWalletConnected && isKycApproved ? 'Eligible' : 'Restricted'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FINANCE CARDS GRID (6 CARDS) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-sans">
          💰 Protocol Capital & Lending Financials
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 font-sans">
          {/* Card 1: Portfolio Value */}
          <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4.5 space-y-1.5 shadow-xl transition duration-350">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Portfolio</span>
            <div className="text-2xl font-black text-white">Unavailable</div>
            <span className="text-[9px] text-slate-400 font-bold block">No canonical price oracle</span>
          </div>

          {/* Card 2: Borrowed */}
          <div className="bg-slate-900 border border-slate-800 hover:border-rose-500/40 rounded-2xl p-4.5 space-y-1.5 shadow-xl transition duration-350">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Borrowed</span>
            <div className="text-2xl font-black text-rose-400">{formatAbcdWithUnit(summary?.portfolio.borrowed)}</div>
            <span className="text-[9px] text-slate-400 block">Active indexed loans</span>
          </div>

          {/* Card 3: Lent */}
          <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4.5 space-y-1.5 shadow-xl transition duration-350">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Lent</span>
            <div className="text-2xl font-black text-indigo-400">{formatAbcdWithUnit(summary?.portfolio.lent)}</div>
            <span className="text-[9px] text-slate-400 font-bold block">Active indexed loans</span>
          </div>

          {/* Card 4: Interest Earned */}
          <div className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4.5 space-y-1.5 shadow-xl transition duration-350">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Interest Earned</span>
            <div className="text-2xl font-black text-cyan-400">{formatAbcdWithUnit(summary?.portfolio.interestEarned)}</div>
            <span className="text-[9px] text-slate-400 block">Indexed lender repayments</span>
          </div>

          {/* Card 5: EMI Due */}
          <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4.5 space-y-1.5 shadow-xl transition duration-350">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">EMI Due</span>
            <div className="text-2xl font-black text-amber-400">Unavailable</div>
            <span className="text-[9px] text-slate-400 font-bold block">Schedule summary not loaded</span>
          </div>

          {/* Card 6: Health Factor */}
          <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4.5 space-y-1.5 shadow-xl transition duration-350">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Health Factor</span>
            <div className="text-2xl font-black text-emerald-400">Unavailable</div>
            <span className="text-[9px] text-slate-400 font-bold block">No canonical health-factor source</span>
          </div>
        </div>
      </div>

      {summaryError && <p className="text-xs text-amber-300">Dashboard summary unavailable: {summaryError}</p>}
      {onChainError && <p className="text-xs text-amber-300">{onChainError}</p>}

      {/* 4. QUICK ACTIONS PANEL */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl font-sans">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400 animate-pulse" /> Operational Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateTab?.('borrow')}
            className="p-4 bg-slate-950 hover:bg-emerald-600/10 border border-slate-800/80 hover:border-emerald-500 text-xs font-black rounded-2xl transition cursor-pointer text-center space-y-1.5"
          >
            <Coins className="w-5 h-5 text-emerald-400 mx-auto" />
            <div className="text-slate-200">Borrow</div>
          </button>
          <button
            onClick={() => onNavigateTab?.('view-all-loans')}
            className="p-4 bg-slate-950 hover:bg-indigo-600/10 border border-slate-800/80 hover:border-indigo-500 text-xs font-black rounded-2xl transition cursor-pointer text-center space-y-1.5"
          >
            <DollarSign className="w-5 h-5 text-indigo-400 mx-auto" />
            <div className="text-slate-200">Lend</div>
          </button>
          <button
            onClick={() => onNavigateTab?.('ico')}
            className="p-4 bg-slate-950 hover:bg-amber-600/10 border border-slate-800/80 hover:border-amber-500 text-xs font-black rounded-2xl transition cursor-pointer text-center space-y-1.5"
          >
            <Coins className="w-5 h-5 text-amber-400 mx-auto" />
            <div className="text-slate-200">ICO</div>
          </button>
          <button
            onClick={() => onNavigateTab?.('nft-ecosystem')}
            className="p-4 bg-slate-950 hover:bg-pink-600/10 border border-slate-800/80 hover:border-pink-500 text-xs font-black rounded-2xl transition cursor-pointer text-center space-y-1.5"
          >
            <ImageIcon className="w-5 h-5 text-pink-400 mx-auto" />
            <div className="text-slate-200">Franchise NFTs</div>
          </button>
          <button
            onClick={() => onNavigateTab?.('emi')}
            className="p-4 bg-slate-950 hover:bg-cyan-600/10 border border-slate-800/80 hover:border-cyan-500 text-xs font-black rounded-2xl transition cursor-pointer text-center space-y-1.5"
          >
            <CreditCard className="w-5 h-5 text-cyan-400 mx-auto" />
            <div className="text-slate-200">Repay EMI</div>
          </button>
          <button
            disabled
            title="Use the main Staking page for real on-chain reward claims."
            className="p-4 bg-slate-950 border border-slate-800/80 text-xs font-black rounded-2xl text-center space-y-1.5 opacity-60 cursor-not-allowed"
          >
            <Gift className="w-5 h-5 text-purple-400 mx-auto" />
            <div className="text-slate-200">Rewards: Staking tab</div>
          </button>
        </div>
      </div>

    </div>
  );
};

export default NextGenProtocolDashboard;
