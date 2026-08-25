import React, { useState } from 'react';
import {
  Rocket,
  Lock,
  Zap,
  Globe,
  ChevronRight,
  Loader2,
  Sparkles,
  PieChart,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Coins,
  BarChart2,
} from 'lucide-react';
import {
  SALE_PHASES,
  TOKEN_ALLOCATIONS,
  VESTING_SCHEDULES,
  USER_CONTRIBUTIONS,
  ICO_STATS,
  TOTAL_SUPPLY,
  SalePhase,
  UserContribution,
} from '../Services/icoLaunchpad';
import {
  calculateTotalBonus,
  getBonusPoolStatus,
  type UserBonusProfile,
} from '../Services/bonusEngine';
import { IcoService, type IcoPurchase, type IcoConfig } from '../Services/icoService';
import { useWallet } from '../Context/WalletContext';
import { buyTokens as buyTokensOnChain } from '../Services/icoLaunchpad';

const statusStyle = (status: SalePhase['status']) => {
  switch (status) {
    case 'Live': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'Upcoming': return 'bg-blue-500/15 text-blue-300 border-blue-500/40';
    case 'Ended': return 'bg-slate-700/40 text-slate-400 border-slate-600/40';
    case 'Filled': return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
  }
};

const statusDot = (status: SalePhase['status']) => {
  switch (status) {
    case 'Live': return 'bg-emerald-400 animate-pulse';
    case 'Filled': return 'bg-purple-400';
    default: return 'bg-slate-500';
  }
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(0)}`;

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K`
      : `${n}`;
const ICOLaunchpad: React.FC = () => {
  const { address: connectedAddress, isConnected, balanceABCD, refreshBalances } = useWallet();
  const defaultWallet = connectedAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const [activeTab, setActiveTab] = useState<'phases' | 'private' | 'presale' | 'public' | 'buy' | 'bonus' | 'referral' | 'allocation' | 'vesting' | 'portfolio' | 'history'>('phases');
  const [selectedPhase, setSelectedPhase] = useState<SalePhase>(SALE_PHASES[2]); // Public Sale
  const [salePhases, setSalePhases] = useState<SalePhase[]>(SALE_PHASES);
  console.log('SalePhases count:', SALE_PHASES.length);
  const [buyAmount, setBuyAmount] = useState('500');
  console.log('🔧 ICOLaunchpad mounted');
  const [paymentCurrency, setPaymentCurrency] = useState<'ETH' | 'BTC' | 'BNB' | 'USDT'>('BNB');
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [contributions, setContributions] = useState<UserContribution[]>(USER_CONTRIBUTIONS);
  const [purchaseHistory, setPurchaseHistory] = useState<IcoPurchase[]>([]);
  const [icoStats, setIcoStats] = useState(ICO_STATS);
  const walletAddress = connectedAddress || defaultWallet;
  console.log('🔧 ICOLaunchpad rendering, walletAddress:', walletAddress);
  const isWalletConnected = isConnected;
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [vestingSchedules, setVestingSchedules] = useState<any[]>([]);

  const livePhase = salePhases.find((p) => p.status === 'Live') || salePhases[2];
  const calcTokens = (usd: number) => Math.floor(usd / selectedPhase.tokenPrice);
  const calcBonus = (usd: number) => Math.floor(calcTokens(usd) * (selectedPhase.bonus / 100));

  const loadIcoConfig = async () => {
    try {
      const config = await IcoService.getConfig();
      const mapped = config.stages.map((stage) => ({
        ...SALE_PHASES.find((p) => p.id === stage.id)!,
        tokenPrice: stage.tokenPrice,
        bonus: (stage as any).bonusPct ?? (stage as any).bonus ?? 0,
        status: stage.status as SalePhase['status'],
      }));
      setSalePhases(mapped);
      const live = mapped.find((p) => p.status === 'Live');
      if (live) setSelectedPhase(live);
    } catch (err) {
      console.warn('Failed to load ICO config, using defaults.', err);
    }
  };

  const loadIcoStats = async () => {
    try {
      const stats = await IcoService.getStats();
      setIcoStats({
        ...ICO_STATS,
        totalRaised: stats.totalRaised,
        tokensSold: stats.totalTokens,
      });
    } catch (err) {
      console.warn('Failed to load ICO stats.', err);
    }
  };

  const loadPurchaseHistory = async (address: string) => {
    try {
      const history = await IcoService.getPurchases(address);
      setPurchaseHistory(history);
    } catch (err) {
      console.warn('Failed to load purchase history.', err);
    }
  };

  const loadReferrals = async (address: string) => {
    try {
      const r = await IcoService.getReferrals(address);
      setReferrals(r || []);
      if (r && r.length > 0) setReferralCode(r[0].referralCode);
    } catch (err) {
      console.warn('Failed to load referrals.', err);
    }
  };

  const loadVestingSchedules = async (address: string) => {
    try {
      const v = await IcoService.getVesting(address);
      setVestingSchedules(v || []);
    } catch (err) {
      console.warn('Failed to load vesting schedules.', err);
    }
  };

  React.useEffect(() => {
    loadIcoConfig();
    loadIcoStats();
    loadPurchaseHistory(walletAddress);
    loadReferrals(walletAddress);
    loadVestingSchedules(walletAddress);
  }, [walletAddress]);

  const handleBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(buyAmount);
    if (!amt || amt < selectedPhase.minBuy) {
      setFeedbackMsg(`Minimum contribution is ${fmt(selectedPhase.minBuy)}`);
      return;
    }
    if (amt > selectedPhase.maxBuy) {
      setFeedbackMsg(`Maximum contribution is ${fmt(selectedPhase.maxBuy)}`);
      return;
    }
    if (!walletAddress) {
      setFeedbackMsg('Please connect your MetaMask wallet before purchasing.');
      return;
    }
    setLoading(true);
    setFeedbackMsg('Opening MetaMask... Please confirm the transaction in your wallet.');
    try {
      // 1. Execute real on-chain Web3 purchase via MetaMask (icoLaunchpad.ts → presale.ts → Contract)
      const onChainResult = await buyTokensOnChain(selectedPhase.id, amt.toString());
      const txHash = onChainResult.txHash;
      const bscScanUrl = `https://testnet.bscscan.com/tx/${txHash}`;

      // 2. Also sync with backend API for record-keeping (fire-and-forget)
      IcoService.buyTokens(walletAddress, selectedPhase.id, amt).catch(() => null);

      setContributions((prev) => [
        {
          phase: onChainResult.phase,
          amountUSD: onChainResult.amountUSD,
          tokensPurchased: onChainResult.tokensPurchased,
          bonusTokens: onChainResult.bonusTokens,
          txHash,
          purchasedAt: onChainResult.purchasedAt,
        },
        ...prev,
      ]);
      setFeedbackMsg(
        `✅ Transaction Confirmed! Purchased ${onChainResult.tokensPurchased.toLocaleString()} ABCD + ${onChainResult.bonusTokens.toLocaleString()} bonus tokens. 🔗 BscScan: ${bscScanUrl}`
      );
      setBuyAmount('500');
      setActiveTab('portfolio');
      // Refresh live wallet ABCD balance
      if (connectedAddress) await refreshBalances();
      await loadIcoStats();
      await loadPurchaseHistory(walletAddress);
    } catch (err: any) {
      console.error('ICO purchase error:', err);
      setFeedbackMsg(err?.message?.includes('user rejected') 
        ? '⚠️ Transaction rejected in MetaMask. Please try again.'
        : `Transaction failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
  <div id="ico-launchpad" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Rocket className="w-5 h-5 text-emerald-400" />
            ABCD Token ICO Launchpad
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Participate in the ABCD token sale — Private Sale, Presale, and Public Sale with token allocation and vesting schedules.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs">
            <div className="text-slate-400 uppercase tracking-wider font-semibold">Connected Wallet</div>
            <div className="text-white font-bold mt-2 truncate">{walletAddress}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs">
            <div className="text-slate-400 uppercase tracking-wider font-semibold">Live Phase</div>
            <div className="text-emerald-300 font-bold mt-2">{livePhase?.name || 'N/A'}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs">
            <div className="text-slate-400 uppercase tracking-wider font-semibold">Referral Code</div>
            <div className="text-white font-bold mt-2">{referralCode || '—'}</div>
          </div>
          <div className="w-40">
            <button
              onClick={async () => {
                try {
                  const ref = await IcoService.createReferral(walletAddress);
                  setReferralCode(ref.referralCode);
                  setReferrals((prev) => [ref, ...prev]);
                } catch (err) {
                  console.warn('Failed to create referral', err);
                }
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-2xl text-xs transition"
            >
              Create
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Raised', value: fmt(icoStats.totalRaised), color: 'text-emerald-300' },
          { label: 'Tokens Sold', value: `${fmtTokens(icoStats.tokensSold)} ABCD`, color: 'text-cyan-300' },
          { label: 'Active Phase', value: livePhase.name, color: 'text-violet-300' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-950 border border-slate-800 rounded-3xl p-4 text-xs">
            <div className={`text-sm font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* FEEDBACK */}
      {feedbackMsg && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer shrink-0">✕</button>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-3 no-scrollbar">
        {[
          { id: 'phases', label: '🚀 All Rounds' },
          { id: 'private', label: '🔒 Private Sale' },
          { id: 'presale', label: '⚡ Pre-Sale' },
          { id: 'public', label: '🌍 Crowd Sale (Public)' },
          { id: 'buy', label: '💳 Buy ABCD' },
          { id: 'bonus', label: '🎁 Bonus Calculator' },
          { id: 'referral', label: '🤝 Referral Rewards' },
          { id: 'allocation', label: '🥧 Token Allocation' },
          { id: 'vesting', label: '⏳ Vesting Schedule' },
          { id: 'portfolio', label: `📋 My Purchases (${contributions.length})` },
        ].map((tab) => {
          const sel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === 'private') setSelectedPhase(SALE_PHASES[0]);
                if (tab.id === 'presale') setSelectedPhase(SALE_PHASES[1]);
                if (tab.id === 'public') setSelectedPhase(SALE_PHASES[2]);
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${sel ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ====================== SALE PHASES ====================== */}
      {activeTab === 'phases' && (
        <div className="space-y-4">
          {/* Phase Timeline */}
          <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1 no-scrollbar">
            {SALE_PHASES.map((phase, idx) => (
              <React.Fragment key={phase.id}>
                <div className={`shrink-0 px-4 py-2 rounded-2xl border font-bold flex items-center gap-2 ${statusStyle(phase.status)}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(phase.status)}`} />
                  {phase.icon} {phase.name}
                </div>
                {idx < SALE_PHASES.length - 1 && <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />}
              </React.Fragment>
            ))}
          </div>

          {/* Phase Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SALE_PHASES.filter((phase) => phase.id !== 'private').map((phase) => {
              const fillPct = Math.min(100, (phase.soldTokens / phase.totalTokens) * 100);
              return (
                <div key={phase.id} className={`bg-gradient-to-b ${phase.color} border rounded-3xl p-5 space-y-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{phase.label}</div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2 mt-0.5">
                        <span className="text-lg">{phase.icon}</span>
                        {phase.name}
                      </h3>
                    </div>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-xl border ${statusStyle(phase.status)} flex items-center gap-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(phase.status)}`} />
                      {phase.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl">
                      <div className="text-[10px] text-slate-500">Token Price</div>
                      <div className="font-extrabold text-white">${phase.tokenPrice}</div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl">
                      <div className="text-[10px] text-slate-500">Bonus</div>
                      <div className="font-extrabold text-emerald-400">+{phase.bonus}%</div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl">
                      <div className="text-[10px] text-slate-500">Hard Cap</div>
                      <div className="font-extrabold text-white">{fmt(phase.hardCap)}</div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl">
                      <div className="text-[10px] text-slate-500">Raised</div>
                      <div className="font-extrabold text-amber-300">{fmt(phase.raised)}</div>
                    </div>
                  </div>

                  {/* Fill progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Fill Rate</span>
                      <span className="text-white font-bold">{fillPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-900/70 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{fmtTokens(phase.soldTokens)} sold</span>
                      <span>{fmtTokens(phase.totalTokens)} total</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Min: {fmt(phase.minBuy)}</span>
                    <span>Max: {fmt(phase.maxBuy)}</span>
                  </div>

                  {phase.status === 'Live' && (
                    <button
                      onClick={() => { setSelectedPhase(phase); setActiveTab('buy'); }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-2xl text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                      <Rocket className="w-3.5 h-3.5" /> Buy ABCD Tokens
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================== INDIVIDUAL PHASE DETAIL VIEWS (PRIVATE, PRESALE, PUBLIC) ====================== */}
      {(activeTab === 'private' || activeTab === 'presale' || activeTab === 'public') && (
        <div className="space-y-6 font-mono">
          <div className={`bg-gradient-to-b ${selectedPhase.color} border rounded-3xl p-6 space-y-4 shadow-xl`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedPhase.icon}</span>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase">{selectedPhase.label}</div>
                  <h3 className="text-lg font-black text-white">{selectedPhase.name}</h3>
                </div>
              </div>
              <span className={`text-xs font-black px-3 py-1 rounded-xl border ${statusStyle(selectedPhase.status)} flex items-center gap-1.5`}>
                <span className={`w-2 h-2 rounded-full ${statusDot(selectedPhase.status)}`} />
                {selectedPhase.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
                <div className="text-slate-400 text-[10px]">Token Price</div>
                <div className="font-extrabold text-white text-sm">${selectedPhase.tokenPrice} / ABCD</div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
                <div className="text-slate-400 text-[10px]">Bonus</div>
                <div className="font-extrabold text-emerald-400 text-sm">+{selectedPhase.bonus}%</div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
                <div className="text-slate-400 text-[10px]">Hard Cap</div>
                <div className="font-extrabold text-white text-sm">{fmt(selectedPhase.hardCap)}</div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
                <div className="text-slate-400 text-[10px]">Min / Max</div>
                <div className="font-extrabold text-amber-300 text-sm">{fmt(selectedPhase.minBuy)} / {fmt(selectedPhase.maxBuy)}</div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setActiveTab('buy')}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Rocket className="w-4 h-4" /> Buy Tokens for {selectedPhase.name}
              </button>
              <button
                onClick={() => setActiveTab('phases')}
                className="px-5 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-2xl text-xs transition cursor-pointer"
              >
                ← View All Rounds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================== BONUS CALCULATOR TAB ====================== */}
      {activeTab === 'bonus' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-5 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wider">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              ABCDeFi Token Bonus Engine
            </h3>
            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full">
              Live Bonus Multipliers
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Maximize your token allocation by taking advantage of our multi-tiered bonus engine. Bonuses are automatically added to your wallet on every successful transaction.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-emerald-400 font-bold">Phase 1 Private Bonus</div>
              <div className="text-2xl font-black text-white">+30%</div>
              <div className="text-[10px] text-slate-400">For early whitelist participants</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-amber-400 font-bold">Presale Phase Bonus</div>
              <div className="text-2xl font-black text-white">+15%</div>
              <div className="text-[10px] text-slate-400">For Stage 2 presale backers</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-cyan-400 font-bold">Public Crowd Sale</div>
              <div className="text-2xl font-black text-white">+5%</div>
              <div className="text-[10px] text-slate-400">For public TGE contributors</div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('buy')}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl text-xs transition cursor-pointer shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" /> Calculate & Purchase Tokens Now
          </button>
        </div>
      )}

      {/* ====================== REFERRAL REWARDS TAB ====================== */}
      {activeTab === 'referral' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-5 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-5 h-5 text-cyan-400" />
              Referral & Affiliate Commission Program
            </h3>
            <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-full">
              5% Direct Bonus
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Share your unique referral link to earn a guaranteed 5% bonus in ABCD tokens whenever anyone in your network contributes to the presale or public ICO rounds.
          </p>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Your Unique Referral Code</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{referralCode || 'ABC123REF'}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(referralCode || 'ABC123REF');
                setFeedbackMsg('✅ Referral code copied to clipboard!');
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-emerald-500/20"
            >
              Copy Code
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-slate-400 text-[10px]">Total Referrals</div>
              <div className="text-base font-extrabold text-white mt-0.5">{referrals.length} Users</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-slate-400 text-[10px]">Total Commission Earned</div>
              <div className="text-base font-extrabold text-emerald-300 mt-0.5">250 ABCD</div>
            </div>
          </div>
        </div>
      )}

      {/* ====================== BUY TOKENS ====================== */}
      {activeTab === 'buy' && (
        <div className="max-w-lg mx-auto space-y-5">
          {/* Phase Selector */}
          <div className="flex gap-2">
            {SALE_PHASES.filter((p) => p.id !== 'private' && (p.status === 'Live' || p.status === 'Upcoming')).map((phase) => (
              <button
                key={phase.id}
                onClick={() => setSelectedPhase(phase)}
                className={`flex-1 px-3 py-2.5 rounded-2xl text-xs font-bold border transition cursor-pointer ${selectedPhase.id === phase.id
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                  }`}
              >
                {phase.icon} {phase.name}
              </button>
            ))}
          </div>

          {selectedPhase.status !== 'Live' ? (
            <div className="p-6 text-center bg-slate-950 border border-slate-800 rounded-3xl text-xs text-slate-400 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <p>The <strong className="text-white">{selectedPhase.name}</strong> is <strong className="text-amber-300">{selectedPhase.status}</strong>.</p>
              <p>Please select the <strong className="text-emerald-300">Public Sale</strong> to participate now.</p>
            </div>
          ) : (
            <form onSubmit={handleBuy} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span className="text-xl">{selectedPhase.icon}</span> {selectedPhase.name} — Buy ABCD
              </h3>

              {/* Token Price Info */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-[10px] text-slate-500">Token Price</div>
                  <div className="font-bold text-white">${selectedPhase.tokenPrice}/ABCD</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-[10px] text-slate-500">Bonus</div>
                  <div className="font-bold text-emerald-400">+{selectedPhase.bonus}%</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-[10px] text-slate-500">Min / Max</div>
                  <div className="font-bold text-amber-300">{fmt(selectedPhase.minBuy)} / {fmt(selectedPhase.maxBuy)}</div>
                </div>
              </div>

              {/* Payment Currency Selector (ETH, BTC, BNB, USDT) */}
              <div className="space-y-2 text-xs">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Select Payment Currency</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'ETH', name: 'ETH', price: 2500, icon: '💎' },
                    { id: 'BTC', name: 'BTC', price: 65000, icon: '⚡' },
                    { id: 'BNB', name: 'BNB', price: 580, icon: '🪙' },
                    { id: 'USDT', name: 'USDT', price: 1, icon: '💵' },
                  ].map((curr) => (
                    <button
                      key={curr.id}
                      type="button"
                      onClick={() => setPaymentCurrency(curr.id as any)}
                      className={`p-2.5 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${paymentCurrency === curr.id
                          ? 'bg-emerald-600/20 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                    >
                      <span>{curr.icon}</span>
                      <span>{curr.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Contribution Amount (USD)</span>
                  <span className="text-emerald-400 font-bold">
                    = {(parseFloat(buyAmount || '0') / (paymentCurrency === 'BTC' ? 65000 : paymentCurrency === 'BNB' ? 580 : paymentCurrency === 'ETH' ? 2500 : 1)).toFixed(paymentCurrency === 'USDT' ? 2 : 4)} {paymentCurrency}
                  </span>
                </div>
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  min={selectedPhase.minBuy}
                  max={selectedPhase.maxBuy}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500 transition"
                  placeholder={`Min $${selectedPhase.minBuy}`}
                />
                {/* Quick amounts */}
                <div className="flex gap-2">
                  {[500, 2000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBuyAmount(String(amt))}
                      className={`flex-1 py-1.5 rounded-xl border text-[10px] font-bold transition cursor-pointer ${buyAmount === String(amt) ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                        }`}
                    >
                      ${amt < 1000 ? amt : `${amt / 1000}K`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {parseFloat(buyAmount) > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-3.5 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>You Pay ({paymentCurrency}):</span>
                    <span className="font-bold text-emerald-300">
                      {(parseFloat(buyAmount) / (paymentCurrency === 'BTC' ? 65000 : paymentCurrency === 'BNB' ? 580 : paymentCurrency === 'ETH' ? 2500 : 1)).toFixed(paymentCurrency === 'USDT' ? 2 : 4)} {paymentCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ABCD Tokens Received:</span>
                    <span className="font-bold text-white">{calcTokens(parseFloat(buyAmount)).toLocaleString()} ABCD</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Bonus Tokens (+{selectedPhase.bonus}%):</span>
                    <span className="font-bold text-emerald-400">+{calcBonus(parseFloat(buyAmount)).toLocaleString()} ABCD</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-800/40 pt-1.5 text-white font-black">
                    <span>Total ABCD to Receive:</span>
                    <span>{(calcTokens(parseFloat(buyAmount)) + calcBonus(parseFloat(buyAmount))).toLocaleString()} ABCD</span>
                  </div>
                </div>
              )}

              {/* ===== BONUS CALCULATOR ===== */}
              {parseFloat(buyAmount) > 0 && (() => {
                const tokens = calcTokens(parseFloat(buyAmount));
                const mockProfile: UserBonusProfile = {
                  walletAddress: '0x2222...2222',
                  kycVerified: true,
                  ageVerified: true,
                  ageBracket: '26-35',
                  professionalVerified: false,
                  creditReportSubmitted: false,
                  referralCode: undefined,
                  purchaseCount: 1,
                };
                const bonuses = calculateTotalBonus(tokens, mockProfile);
                const eligible = bonuses.filter(b => b.eligible);
                const totalExtra = eligible.reduce((s, b) => s + b.bonusTokens, 0);
                const pool = getBonusPoolStatus();
                return (
                  <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-2xl p-3.5 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 flex items-center gap-1.5">🎁 Bonus Calculator</span>
                      <span className="text-[10px] text-slate-500">Pool: {(pool.remainingTokens / 1_000_000).toFixed(1)}M / {(pool.totalCapTokens / 1_000_000).toFixed(0)}M ABCD</span>
                    </div>
                    <div className="space-y-1">
                      {bonuses.map((b, i) => (
                        <div key={i} className={`flex items-center justify-between py-1 px-2 rounded-lg ${b.eligible ? 'bg-emerald-950/40 border border-emerald-900/30' : 'opacity-40'}`}>
                          <span className="text-slate-300">{b.label}</span>
                          <span className={b.eligible ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                            {b.eligible ? `+${b.bonusTokens.toLocaleString()} ABCD` : b.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                    {totalExtra > 0 && (
                      <div className="flex justify-between border-t border-indigo-800/40 pt-1.5 text-indigo-300 font-bold">
                        <span>Extra Bonus Total:</span>
                        <span>+{totalExtra.toLocaleString()} ABCD</span>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500">* Verify your profile to unlock more bonuses (age, credentials, referral)</div>
                  </div>
                );
              })()}

              <button
                type="submit"
                disabled={loading || !buyAmount}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 rounded-2xl text-sm shadow-xl shadow-emerald-500/25 transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                {loading ? 'Processing...' : `Pay ${(parseFloat(buyAmount || '0') / (paymentCurrency === 'BTC' ? 65000 : paymentCurrency === 'BNB' ? 580 : paymentCurrency === 'ETH' ? 2500 : 1)).toFixed(paymentCurrency === 'USDT' ? 2 : 4)} ${paymentCurrency} ➔ Get ABCD`}
              </button>

              {selectedPhase.whitelist && (
                <div className="flex items-center gap-2 text-[11px] text-amber-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>This phase requires whitelisting. Ensure your wallet is approved.</span>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* ====================== TOKEN ALLOCATION ====================== */}
      {activeTab === 'allocation' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart Simulation */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-400" /> Token Distribution
              </h3>
              <div className="text-[10px] text-slate-500 mb-2">Total Supply: {(TOTAL_SUPPLY / 1_000_000_000).toFixed(0)}B ABCD</div>

              {/* Stacked bar representation */}
              <div className="w-full h-8 rounded-2xl overflow-hidden flex">
                {TOKEN_ALLOCATIONS.map((a) => (
                  <div
                    key={a.label}
                    style={{ width: `${a.pct}%`, backgroundColor: a.color }}
                    className="h-full"
                    title={`${a.label}: ${a.pct}%`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {TOKEN_ALLOCATIONS.map((a) => (
                  <div key={a.label} className="flex items-center gap-2 text-[11px]">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="text-slate-400 truncate">{a.label}</span>
                    <span className="font-bold text-white ml-auto">{a.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allocation Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 text-sm font-bold text-white">Allocation Details</div>
              <div className="divide-y divide-slate-800/60">
                {TOKEN_ALLOCATIONS.map((a) => (
                  <div key={a.label} className="flex items-start gap-3 p-3 hover:bg-slate-900/30 transition text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm mt-1 shrink-0" style={{ backgroundColor: a.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white">{a.label}</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">{a.lockup}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-white">{a.pct}%</div>
                      <div className="text-slate-400 text-[10px]">{a.tokens}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================== VESTING SCHEDULE ====================== */}
      {activeTab === 'vesting' && (
        <div className="space-y-4">
          {/* My Vesting Schedules (from backend) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-[11px] font-bold">Your Vesting Schedules</div>
              <div className="text-slate-500 text-[11px]">{vestingSchedules.length} records</div>
            </div>
            {vestingSchedules.length === 0 ? (
              <div className="text-slate-500 text-[12px] p-3">No vesting schedules found for this wallet.</div>
            ) : (
              <div className="grid gap-2">
                {vestingSchedules.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs">
                    <div>
                      <div className="font-bold text-white">{v.walletAddress}</div>
                      <div className="text-slate-400 text-[11px]">Start: {new Date(v.startDate).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-white">{v.totalTokens.toLocaleString()} ABCD</div>
                      <div className="text-slate-500 text-[11px]">Cliff: {v.cliffDays}d · Duration: {v.durationDays}d</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Token Vesting Schedule</h3>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-5 gap-2 px-4 py-2 text-[10px] text-slate-500 uppercase border-b border-slate-800/60">
              <div>Category</div>
              <div>Cliff</div>
              <div>Duration</div>
              <div>TGE Unlock</div>
              <div>Linear Release</div>
            </div>

            {VESTING_SCHEDULES.map((v) => (
              <div key={v.category} className="grid grid-cols-5 gap-2 px-4 py-3.5 border-b border-slate-800/40 hover:bg-slate-900/30 transition text-xs items-center">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>{v.icon}</span>
                  <span className="truncate">{v.category}</span>
                </div>
                <div className={`font-bold ${v.cliff === 'None' ? 'text-emerald-400' : 'text-amber-300'}`}>{v.cliff}</div>
                <div className="text-slate-300">{v.duration}</div>
                <div className={`font-extrabold ${v.tgeUnlock === 0 ? 'text-slate-500' : 'text-cyan-400'}`}>{v.tgeUnlock}%</div>
                <div className="text-slate-400">
                  {v.tgeUnlock > 0
                    ? `${100 - v.tgeUnlock}% over ${v.duration}`
                    : `100% over ${v.duration}`}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-2xl text-xs text-indigo-300 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Vesting Security</div>
            <p className="text-slate-400">All vesting contracts are time-locked on Sepolia. Tokens are released linearly after the cliff period via the <code className="text-cyan-300 bg-slate-900 px-1 rounded">TokenVesting.sol</code> contract.</p>
          </div>
        </div>
      )}

      {/* ====================== MY PORTFOLIO ====================== */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          {contributions.length === 0 ? (
            <div className="p-10 text-center bg-slate-950 border border-slate-800 rounded-3xl text-xs text-slate-500 space-y-2">
              <Rocket className="w-10 h-10 mx-auto text-slate-700" />
              <p>No contributions yet. Participate in the <strong className="text-emerald-300">Public Sale</strong> to see your portfolio here.</p>
              <button onClick={() => setActiveTab('buy')} className="mt-2 bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl cursor-pointer hover:bg-emerald-500 transition">
                Buy Tokens Now
              </button>
            </div>
          ) : (
            <>
              {/* Total Holdings Summary */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { label: 'Total Invested', value: fmt(contributions.reduce((s, c) => s + c.amountUSD, 0)) },
                  { label: 'ABCD Purchased', value: `${contributions.reduce((s, c) => s + c.tokensPurchased, 0).toLocaleString()} ABCD` },
                  { label: 'Bonus Tokens', value: `+${contributions.reduce((s, c) => s + c.bonusTokens, 0).toLocaleString()} ABCD` },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl">
                    <div className="text-[10px] text-slate-500">{s.label}</div>
                    <div className="text-sm font-extrabold text-white mt-0.5">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Contribution History */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 text-sm font-bold text-white">Contribution History</div>
                <div className="divide-y divide-slate-800/50">
                  {contributions.map((c, i) => {
                    const phase = SALE_PHASES.find((p) => p.id === c.phase)!;
                    return (
                      <div key={i} className="p-4 flex items-center justify-between gap-4 text-xs hover:bg-slate-900/30 transition">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{phase.icon}</span>
                          <div>
                            <div className="font-bold text-white">{phase.name}</div>
                            <div className="text-slate-500 text-[10px]">{c.purchasedAt} · {c.txHash}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-white">{c.tokensPurchased.toLocaleString()} ABCD</div>
                          <div className="text-emerald-400 text-[10px]">+{c.bonusTokens.toLocaleString()} bonus</div>
                          <div className="text-slate-500 text-[10px]">{fmt(c.amountUSD)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
};

export { ICOLaunchpad };
export default ICOLaunchpad;
