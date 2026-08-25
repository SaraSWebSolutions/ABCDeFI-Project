import React, { useState } from 'react';
import {
  Award,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Users,
  Calendar,
  Sparkles,
  ExternalLink,
  Sliders,
  RotateCcw,
  Loader2,
  Lock,
  Zap,
  Crown,
  Shield,
  Star,
  Gem,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import {
  CreditScoreMetrics,
  calculateCreditScore,
  mintOrSyncSoulboundReputationNFT,
} from '../Services/lending';

interface ReputationSystemProps {
  userAddress?: string;
  onSyncSuccess?: () => void;
}

export const ReputationSystem: React.FC<ReputationSystemProps> = ({
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  onSyncSuccess,
}) => {
  // 5 Base Metrics State
  const [metrics, setMetrics] = useState<CreditScoreMetrics>({
    loansRepaid: 6,
    latePayments: 0,
    liquidations: 0,
    referralsCount: 4,
    walletAgeDays: 450,
  });

  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [txMessage, setTxMessage] = useState<string>('');

  // Evaluate Credit Score Result
  const creditResult = calculateCreditScore(metrics);

  const levelDetails = [
    {
      level: 'Bronze',
      badge: '🥉',
      icon: Shield,
      scoreRange: '300 - 579',
      color: 'from-amber-700/30 to-amber-900/30 border-amber-600/40 text-amber-300',
      badgeBg: 'bg-amber-600/20 text-amber-300 border-amber-500/40',
      ltv: '60%',
      apy: '14.0%',
      discount: '0% Discount',
      description: 'Standard Entry Certificate for new protocol participants.',
    },
    {
      level: 'Silver',
      badge: '🥈',
      icon: Star,
      scoreRange: '580 - 669',
      color: 'from-slate-700/30 to-slate-900/30 border-slate-400/40 text-slate-200',
      badgeBg: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
      ltv: '70%',
      apy: '11.0%',
      discount: '5% Fee Discount',
      description: 'Established Credit Rating with proven loan settlement history.',
    },
    {
      level: 'Gold',
      badge: '🥇',
      icon: Crown,
      scoreRange: '670 - 799',
      color: 'from-yellow-600/30 to-amber-800/30 border-yellow-500/50 text-yellow-300',
      badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40',
      ltv: '75%',
      apy: '8.0%',
      discount: '15% Fee Discount',
      description: 'High-Reputation Tier with prime LTV allowances and lower rates.',
    },
    {
      level: 'Platinum',
      badge: '💎',
      icon: Gem,
      scoreRange: '800 - 850',
      color: 'from-cyan-600/30 to-indigo-900/30 border-cyan-400/50 text-cyan-300',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      ltv: '85%',
      apy: '5.0%',
      discount: '100% Zero Fee VIP',
      description: 'Top Tier VIP NFT Certificate unlocking maximum platform perks.',
    },
  ];

  const handleSyncNFT = async () => {
    setTxLoading(true);
    setTxMessage(`Minting/Upgrading Soulbound Reputation NFT to Level [${creditResult.reputationLevel}] (#REP-${creditResult.score})...`);
    try {
      await mintOrSyncSoulboundReputationNFT(userAddress, creditResult.score);
      setTxMessage(`Soulbound Reputation NFT upgraded to Level [${creditResult.reputationLevel}]! Credit Score (${creditResult.score}) recorded on-chain ✓`);
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      console.error(err);
      setTxMessage('Failed to sync Soulbound Reputation NFT.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleResetMetrics = () => {
    setMetrics({
      loansRepaid: 6,
      latePayments: 0,
      liquidations: 0,
      referralsCount: 4,
      walletAgeDays: 450,
    });
  };

  return (
    <div id="reputation-system" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <span>Reputation Protocol</span>
            <span className="text-slate-600">↓</span>
            <span>Reputation NFT Levels (Bronze, Silver, Gold, Platinum)</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Award className="w-5 h-5 text-purple-400" />
            Soulbound Reputation NFT Levels
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dynamic Soulbound ERC-721 credit certificates with 4 progression levels: Bronze 🥉, Silver 🥈, Gold 🥇, Platinum 💎.
          </p>
        </div>

        <button
          onClick={handleSyncNFT}
          disabled={txLoading}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-lg shadow-purple-500/25 transition cursor-pointer disabled:opacity-50"
        >
          {txLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-300" />}
          <span>Sync / Upgrade Reputation NFT ({creditResult.reputationLevel})</span>
        </button>
      </div>

      {/* FINANCIAL INCLUSION SCORING ENGINE (4 PILLARS) */}
      <div className="bg-slate-950 border border-indigo-500/40 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <span>Whitepaper Engine</span>
              <span className="text-slate-600">↓</span>
              <span>Financial Inclusion Scoring</span>
            </div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 mt-0.5">
              <Crown className="w-5 h-5 text-indigo-400" />
              Financial Inclusion Score (880 / 1000 — Platinum Founding Fellow)
            </h3>
          </div>
          <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
            Tier 4 VIP Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <div className="text-slate-400 font-bold">1. Participation</div>
            <div className="text-lg font-black text-emerald-400">215 / 250</div>
            <div className="text-[10px] text-slate-500">Governance & Referrals</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <div className="text-slate-400 font-bold">2. Learning</div>
            <div className="text-lg font-black text-amber-300">230 / 250</div>
            <div className="text-[10px] text-slate-500">University Courses & Exams</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <div className="text-slate-400 font-bold">3. Contributions</div>
            <div className="text-lg font-black text-indigo-300">195 / 250</div>
            <div className="text-[10px] text-slate-500">Liquidity & Peer Funding</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-1">
            <div className="text-slate-400 font-bold">4. Reputation</div>
            <div className="text-lg font-black text-purple-300">240 / 250</div>
            <div className="text-[10px] text-slate-500">Soulbound NFT Level</div>
          </div>
        </div>
      </div>

      {/* STATUS FEEDBACK */}
      {txMessage && (
        <div className="p-3.5 bg-purple-950/40 border border-purple-800/50 rounded-xl text-xs text-purple-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>{txMessage}</span>
          </div>
          <button onClick={() => setTxMessage('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* CURRENT NFT LEVEL & PROGRESSION DASHBOARD */}
      <div className="bg-slate-950 border border-purple-500/30 p-6 rounded-3xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Current Reputation NFT Level</div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-4xl">{levelDetails.find((l) => l.level === creditResult.reputationLevel)?.badge}</span>
              <div>
                <h3 className="text-2xl font-black text-white">{creditResult.reputationLevel} Level NFT</h3>
                <div className="text-xs text-purple-300 font-bold mt-0.5">Credit Score: {creditResult.score} / 850</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase">Max LTV</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">{creditResult.ltvAllowance}%</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase">Interest APY</div>
              <div className="text-base font-bold text-purple-400 mt-0.5">{creditResult.apyRate}%</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase">Fee Discount</div>
              <div className="text-base font-bold text-amber-400 mt-0.5">{creditResult.feeDiscount}%</div>
            </div>
          </div>
        </div>

        {/* NFT LEVEL PROGRESSION BAR */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold">Reputation NFT Level Progression</span>
            <span className="text-purple-400 font-bold">Current Level: {creditResult.reputationLevel} ({creditResult.score} Pts)</span>
          </div>

          <div className="relative w-full h-4 bg-slate-900 border border-slate-800 rounded-full overflow-hidden flex">
            <div className="w-[33%] h-full bg-amber-600/40 border-r border-slate-700" title="Bronze (300-579)" />
            <div className="w-[16%] h-full bg-slate-500/40 border-r border-slate-700" title="Silver (580-669)" />
            <div className="w-[23%] h-full bg-yellow-500/40 border-r border-slate-700" title="Gold (670-799)" />
            <div className="w-[28%] h-full bg-cyan-500/40" title="Platinum (800-850)" />

            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white shadow-lg shadow-white transition-all duration-300"
              style={{ left: `${Math.min(100, Math.max(0, ((creditResult.score - 300) / 550) * 100))}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
            <span>🥉 Bronze (300)</span>
            <span>🥈 Silver (580)</span>
            <span>🥇 Gold (670)</span>
            <span>💎 Platinum (800+)</span>
          </div>
        </div>
      </div>

      {/* 4 REPUTATION NFT TIER SHOWCASE CARDS (BRONZE, SILVER, GOLD, PLATINUM) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-purple-400" />
          4 Reputation NFT Tier Levels Showcase
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {levelDetails.map((lvl) => {
            const isCurrent = creditResult.reputationLevel === lvl.level;
            const IconComp = lvl.icon;

            return (
              <div
                key={lvl.level}
                className={`bg-gradient-to-b ${lvl.color} border rounded-3xl p-5 shadow-xl space-y-4 transition-all relative ${
                  isCurrent ? 'ring-2 ring-purple-400 scale-[1.02]' : 'opacity-85 hover:opacity-100'
                }`}
              >
                {/* CURRENT BADGE */}
                {isCurrent && (
                  <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-md">
                    ACTIVE TIER ✓
                  </span>
                )}

                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{lvl.badge}</span>
                    <div>
                      <h4 className="text-base font-extrabold text-white">{lvl.level} NFT</h4>
                      <div className="text-[10px] text-slate-400">Score: {lvl.scoreRange}</div>
                    </div>
                  </div>

                  <IconComp className="w-5 h-5 opacity-80" />
                </div>

                <p className="text-[11px] text-slate-300/90 leading-relaxed min-h-[36px]">
                  {lvl.description}
                </p>

                {/* TIER PERKS LIST */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">LTV Allowance:</span>
                    <span className="font-bold text-emerald-400">{lvl.ltv}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Interest APY:</span>
                    <span className="font-bold text-purple-400">{lvl.apy}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/80 pt-1">
                    <span className="text-slate-400">Perks:</span>
                    <span className="font-bold text-amber-400">{lvl.discount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 FACTOR BREAKDOWN & INTERACTIVE SIMULATOR */}
      <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Credit Simulator & Level Up Tester</h3>
          </div>
          <button
            onClick={handleResetMetrics}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Metrics</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs font-mono">
          <div className="space-y-1.5">
            <label className="block text-slate-400">1. Loans Repaid ({metrics.loansRepaid})</label>
            <input
              type="range"
              min="0"
              max="10"
              value={metrics.loansRepaid}
              onChange={(e) => setMetrics({ ...metrics, loansRepaid: Number(e.target.value) })}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-400">2. Late Payments ({metrics.latePayments})</label>
            <input
              type="range"
              min="0"
              max="5"
              value={metrics.latePayments}
              onChange={(e) => setMetrics({ ...metrics, latePayments: Number(e.target.value) })}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-400">3. Liquidations ({metrics.liquidations})</label>
            <input
              type="range"
              min="0"
              max="3"
              value={metrics.liquidations}
              onChange={(e) => setMetrics({ ...metrics, liquidations: Number(e.target.value) })}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-400">4. Referrals ({metrics.referralsCount})</label>
            <input
              type="range"
              min="0"
              max="10"
              value={metrics.referralsCount}
              onChange={(e) => setMetrics({ ...metrics, referralsCount: Number(e.target.value) })}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-400">5. Wallet Age ({metrics.walletAgeDays}d)</label>
            <input
              type="range"
              min="30"
              max="720"
              step="30"
              value={metrics.walletAgeDays}
              onChange={(e) => setMetrics({ ...metrics, walletAgeDays: Number(e.target.value) })}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default ReputationSystem;
