import React from 'react';
import { ShieldCheck, Clock, CheckCircle2, FileText, Camera, Wifi } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="space-y-6 text-slate-100 font-mono">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Identity Verification</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Provider:</span>
              <span className="text-indigo-400 font-bold bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                Sumsub (Demo)
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> 3–5 Minutes
          </span>
        </div>
      </div>

      {/* What You'll Need Checklist */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          What You'll Need:
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Government Issued ID</span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Live Liveness Selfie</span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Working Web Camera</span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Stable Internet Connection</span>
          </div>
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
      >
        <span>Start Verification Now →</span>
      </button>
    </div>
  );
};

export default Landing;
