import React, { useState } from "react";
import { Award, ShieldCheck, Flame, Users, Calendar } from "lucide-react";
import { calculateCreditScore, CreditScoreMetrics } from "../Services/lending";
import { Card } from "./UI";

const CreditScoreCard: React.FC = () => {
  const [metrics, setMetrics] = useState<CreditScoreMetrics>({
    loansRepaid: 8,
    latePayments: 0,
    liquidations: 0,
    referralsCount: 5,
    walletAgeDays: 365,
  });

  const creditResult = calculateCreditScore(metrics);

  const getScoreColor = (score: number) => {
    if (score >= 800) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 670) return "text-teal-400 border-teal-500/30 bg-teal-500/10";
    if (score >= 580) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <Card className="p-6 bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-xl font-mono">
      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
        {/* Left Side: Score Display */}
        <div className="flex items-center gap-6">
          <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 border-slate-800 bg-slate-950/50 shadow-inner">
            <div className="text-center">
              <span className="text-3xl font-extrabold tracking-wider text-white">
                {creditResult.score}
              </span>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                Score
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-bold rounded border uppercase ${getScoreColor(creditResult.score)}`}>
                {creditResult.tier}
              </span>
              <span className="text-slate-400 text-xs font-bold uppercase">
                {creditResult.reputationLevel} Level
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 uppercase tracking-wider">
              On-Chain Reputation Card
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Your credit score determines LTV allowances and APY rate discounts across the ABCDeFi platform.
            </p>
          </div>
        </div>

        {/* Right Side: Metrics / Multipliers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full lg:w-auto">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <Award className="w-4 h-4 mx-auto mb-1 text-indigo-400" />
            <div className="text-[10px] text-slate-400 uppercase">Repaid</div>
            <div className="text-sm font-bold text-white mt-0.5">{metrics.loansRepaid}</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <Flame className="w-4 h-4 mx-auto mb-1 text-amber-500" />
            <div className="text-[10px] text-slate-400 uppercase">Late</div>
            <div className="text-sm font-bold text-white mt-0.5">{metrics.latePayments}</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-rose-500" />
            <div className="text-[10px] text-slate-400 uppercase">Liq</div>
            <div className="text-sm font-bold text-white mt-0.5">{metrics.liquidations}</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <Users className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
            <div className="text-[10px] text-slate-400 uppercase">Refs</div>
            <div className="text-sm font-bold text-white mt-0.5">{metrics.referralsCount}</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-center col-span-2 sm:col-span-1">
            <Calendar className="w-4 h-4 mx-auto mb-1 text-teal-400" />
            <div className="text-[10px] text-slate-400 uppercase">Age (Days)</div>
            <div className="text-sm font-bold text-white mt-0.5">{metrics.walletAgeDays}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CreditScoreCard;
