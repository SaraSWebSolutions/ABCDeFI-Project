import React from 'react';
import { CheckCircle2, ShieldCheck, ArrowRight, Lock, Check, Zap } from 'lucide-react';

interface SuccessProps {
  applicantId: string;
  walletAddress: string;
  onReturn: () => void;
}

export const Success: React.FC<SuccessProps> = ({ applicantId, walletAddress, onReturn }) => {
  const unlockedFeatures = [
    { title: 'Lending Pools & Interest Earnings', desc: 'Deposit crypto assets & earn automated protocol yield.' },
    { title: 'Borrowing Capacity & Loans', desc: 'Access instant loans with up to 80% LTV.' },
    { title: 'High-Value Withdrawal Limits', desc: 'Withdraw up to $50,000 USDC per transaction.' },
    { title: 'Fiat CeFi Banking Features', desc: 'Virtual debit card, bank transfers, and fiat deposits.' },
    { title: 'One-Time ICO Demographic Bonuses', desc: 'Age, Women, Low-Income, and Fin-Pro bonus rewards.' },
  ];

  return (
    <div className="space-y-6 text-slate-100 font-sans text-center">
      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/50 shadow-xl shadow-emerald-950/50">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
      </div>

      <div className="space-y-1">
        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
          Sumsub Verified GREEN ✓
        </span>
        <h2 className="text-xl font-bold text-white tracking-tight mt-2">Identity Verification Complete</h2>
        <p className="text-xs text-slate-400">Sumsub 7-Point verification & AML screening passed successfully.</p>
      </div>

      {/* UNLOCKED PLATFORM FEATURES LIST */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-3 text-xs text-left">
        <h3 className="font-bold text-white uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-emerald-400" /> Unlocked Protocol Capabilities
        </h3>

        <div className="space-y-2 pt-1">
          {unlockedFeatures.map((f) => (
            <div key={f.title} className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800/80 flex items-start gap-2.5">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                ✓
              </div>
              <div>
                <div className="font-bold text-white text-xs">{f.title}</div>
                <div className="text-[10px] text-slate-400">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onReturn}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold rounded-2xl text-xs transition cursor-pointer shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2"
      >
        <span>Return to ABCDeFi Banking Dashboard →</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Success;
