import React, { useState } from 'react';
import {
  HeartPulse,
  PiggyBank,
  TrendingUp,
  CreditCard,
  GraduationCap,
  Target,
  Vote,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  ShieldCheck,
  Award,
  ChevronRight,
  Flame,
  Zap,
} from 'lucide-react';
import {
  COMMUNITY_PROPOSALS,
  DAOProposal,
  voteOnProposal,
} from '../Services/governance';
import {
  USER_WELLNESS_DATA,
  FinancialGoal,
} from '../Services/financialWellness';

export const FinancialWellnessDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'wellness' | 'governance'>('wellness');
  const [proposals, setProposals] = useState<DAOProposal[]>(COMMUNITY_PROPOSALS);
  const [goals] = useState<FinancialGoal[]>(USER_WELLNESS_DATA.goals);
  const [voting, setVoting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const handleVote = async (proposalId: string, support: boolean) => {
    setVoting(true);
    setFeedbackMsg(`Casting vote on ${proposalId}...`);
    try {
      await voteOnProposal(proposalId, support);
      setProposals([...COMMUNITY_PROPOSALS]);
      setFeedbackMsg(`✓ Vote cast successfully on ${proposalId}!`);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div id="financial-wellness-dashboard" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span>Protocol Ecosystem</span>
            <span className="text-slate-600">↓</span>
            <span>Financial Health & Governance</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <HeartPulse className="w-6 h-6 text-emerald-400" />
            Financial Wellness & ABCDeFi Governance Portal
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track Savings, Investments, Loans, Learning Progress, and participate in Community DAO Proposals & Upgrades.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('wellness')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'wellness'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" /> Financial Wellness
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'governance'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Vote className="w-3.5 h-3.5" /> DAO Governance
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {voting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. FINANCIAL WELLNESS DASHBOARD                                           */}
      {/* ========================================================================= */}
      {activeTab === 'wellness' && (
        <div className="space-y-6">
          {/* WELLNESS SCORE BANNER */}
          <div className="bg-slate-950 border border-emerald-500/40 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-2xl">
                  {USER_WELLNESS_DATA.wellnessScore}
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-bold">Overall Financial Health Score</div>
                  <h3 className="text-xl font-black text-white">Excellent Financial Wellness (92 / 100)</h3>
                  <div className="text-[10px] text-emerald-400 font-bold">Low Risk Profile • Safe Health Factor (2.45)</div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Healthy Protocol Standing
              </span>
            </div>

            {/* 8 METRICS CARDS (Assets, Liabilities, Net Worth, Loans, Investments, Staking, Learning Progress, Credit Score) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Total Assets</div>
                <div className="text-lg font-black text-emerald-400 mt-1">${USER_WELLNESS_DATA.assetsUSD.toLocaleString()} USD</div>
                <div className="text-[10px] text-slate-500">Savings & Investments</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Total Liabilities</div>
                <div className="text-lg font-black text-rose-400 mt-1">${USER_WELLNESS_DATA.liabilitiesUSD.toLocaleString()} USD</div>
                <div className="text-[10px] text-slate-500">Active Debt</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Net Worth</div>
                <div className="text-lg font-black text-amber-300 mt-1">${USER_WELLNESS_DATA.netWorthUSD.toLocaleString()} USD</div>
                <div className="text-[10px] text-slate-500">Assets - Liabilities</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Active Loans</div>
                <div className="text-lg font-black text-indigo-300 mt-1">${USER_WELLNESS_DATA.loansUSD.toLocaleString()} USD</div>
                <div className="text-[10px] text-emerald-400">Health Factor: {USER_WELLNESS_DATA.healthFactor}</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Investments</div>
                <div className="text-lg font-black text-white mt-1">${USER_WELLNESS_DATA.investmentsUSD.toLocaleString()} USD</div>
                <div className="text-[10px] text-slate-500">Yield Strategy Vaults</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Staking Pool</div>
                <div className="text-lg font-black text-purple-300 mt-1">{USER_WELLNESS_DATA.stakingABCD.toLocaleString()} ABCD</div>
                <div className="text-[10px] text-slate-500">Pool 3 (25% APY)</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Learning Progress</div>
                <div className="text-lg font-black text-cyan-300 mt-1">{USER_WELLNESS_DATA.learningProgressPct}%</div>
                <div className="text-[10px] text-cyan-400 font-bold">{USER_WELLNESS_DATA.creditHoursEarned} Credit Hours</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-slate-400 font-bold">Credit Score</div>
                <div className="text-lg font-black text-yellow-400 mt-1">{USER_WELLNESS_DATA.creditScore} / 850</div>
                <div className="text-[10px] text-yellow-300 font-bold">Platinum NFT Level</div>
              </div>
            </div>
          </div>

          {/* FINANCIAL GOALS TRACKER */}
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" /> Financial Wellness Goal Tracking ({goals.length} Goals)
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              {goals.map((g) => (
                <div key={g.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      <span>{g.title}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      g.completed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {g.completed ? 'Completed ✓' : `Target: ${g.targetDate}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Progress: ${g.currentAmountUSD.toLocaleString()} / ${g.targetAmountUSD.toLocaleString()} USD</span>
                    <span className="font-bold text-white">{g.progressPct}%</span>
                  </div>

                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full" style={{ width: `${g.progressPct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ABCDeFi GOVERNANCE & DAO VOTING                                         */}
      {/* ========================================================================= */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Vote className="w-4 h-4 text-indigo-400" /> Active Community DAO Proposals & Decision Making
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Vote with ABCD Tokens on protocol upgrades, fee rates, and treasury grants.</p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
              DAO Governance Active
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {proposals.map((prop) => (
              <div key={prop.id} className="p-5 bg-slate-950 border border-slate-800 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm">{prop.title}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {prop.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">Ends: {prop.endTime}</span>
                </div>

                <p className="text-xs text-slate-400">{prop.description}</p>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-emerald-400 font-bold">For: {prop.forVotes.toLocaleString()} ABCD</span>
                    <span className="text-rose-400 font-bold">Against: {prop.againstVotes.toLocaleString()} ABCD</span>
                  </div>

                  {!prop.voted ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVote(prop.id, true)}
                        disabled={voting}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                      >
                        Vote FOR
                      </button>
                      <button
                        onClick={() => handleVote(prop.id, false)}
                        disabled={voting}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                      >
                        Vote AGAINST
                      </button>
                    </div>
                  ) : (
                    <span className="text-emerald-400 font-bold text-xs">Vote Cast ✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default FinancialWellnessDashboard;
