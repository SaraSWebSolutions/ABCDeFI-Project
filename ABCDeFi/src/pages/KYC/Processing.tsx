import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, ShieldCheck, Search, UserCheck, Eye, ShieldAlert, Globe, Check } from 'lucide-react';

interface ProcessingProps {
  onComplete: () => void;
}

export const Processing: React.FC<ProcessingProps> = ({ onComplete }) => {
  const [p1, setP1] = useState<number>(0);
  const [p2, setP2] = useState<number>(0);
  const [p3, setP3] = useState<number>(0);
  const [p4, setP4] = useState<number>(0);
  const [p5, setP5] = useState<number>(0);
  const [p6, setP6] = useState<number>(0);
  const [p7, setP7] = useState<number>(0);

  useEffect(() => {
    const timer1 = setInterval(() => setP1((prev) => (prev < 100 ? prev + 34 : 100)), 200);
    const timer2 = setTimeout(() => {
      const i2 = setInterval(() => setP2((prev) => (prev < 100 ? prev + 34 : 100)), 200);
      return () => clearInterval(i2);
    }, 600);
    const timer3 = setTimeout(() => {
      const i3 = setInterval(() => setP3((prev) => (prev < 100 ? prev + 34 : 100)), 200);
      return () => clearInterval(i3);
    }, 1200);
    const timer4 = setTimeout(() => {
      const i4 = setInterval(() => setP4((prev) => (prev < 100 ? prev + 34 : 100)), 200);
      return () => clearInterval(i4);
    }, 1800);
    const timer5 = setTimeout(() => {
      const i5 = setInterval(() => setP5((prev) => (prev < 100 ? prev + 34 : 100)), 200);
      return () => clearInterval(i5);
    }, 2400);
    const timer6 = setTimeout(() => {
      const i6 = setInterval(() => setP6((prev) => (prev < 100 ? prev + 34 : 100)), 200);
      return () => clearInterval(i6);
    }, 3000);
    const timer7 = setTimeout(() => {
      const i7 = setInterval(() => {
        setP7((prev) => {
          if (prev < 100) return prev + 34;
          clearInterval(i7);
          setTimeout(onComplete, 600);
          return 100;
        });
      }, 200);
    }, 3600);

    return () => {
      clearInterval(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      clearTimeout(timer6);
      clearTimeout(timer7);
    };
  }, []);

  const overall = Math.floor((p1 + p2 + p3 + p4 + p5 + p6 + p7) / 7);

  const steps = [
    { title: '1. Document Authenticity Check', desc: 'Validates government document, security holograms, and expiration.', val: p1, icon: ShieldCheck },
    { title: '2. OCR Text Extraction', desc: 'Extracts Legal Name, DOB, Doc Number, and Nationality.', val: p2, icon: Search },
    { title: '3. Face Matching', desc: 'Compares ID Photo vs Live Selfie (99.8% match rate).', val: p3, icon: UserCheck },
    { title: '4. Liveness Detection', desc: 'Verifies live presence (Blink, Turn Head, Smile).', val: p4, icon: Eye },
    { title: '5. Fraud Detection', desc: 'Scans for edited/photoshop images, duplicate IDs, and device anomalies.', val: p5, icon: ShieldAlert },
    { title: '6. AML & Sanctions Screening', desc: 'Screens PEP lists, Global Watchlists, and Sanctions databases.', val: p6, icon: Globe },
    { title: '7. Final Decision & Webhook', desc: 'Issues GREEN status & dispatches webhook to ABCDeFi protocol.', val: p7, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      <div>
        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
          Sumsub AI Verification Engine
        </span>
        <h2 className="text-lg font-bold text-white tracking-tight mt-1.5">Step 7: 7-Point Identity Verification Engine</h2>
        <p className="text-xs text-slate-400">Sumsub specialized compliance engine is processing identity proof & AML screening.</p>
      </div>

      <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            Executing Sumsub Verification Pipeline...
          </span>
          <span className="text-emerald-400 font-mono font-bold text-base">{overall}%</span>
        </div>

        {/* OVERALL PROGRESS BAR */}
        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300" style={{ width: `${overall}%` }} />
        </div>

        {/* 7 SUMSUB CHECKS LIST */}
        <div className="space-y-3 pt-2 text-xs">
          {steps.map((s) => {
            const Icon = s.icon;
            const isDone = s.val === 100;
            return (
              <div key={s.title} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${isDone ? 'text-emerald-400' : 'text-indigo-400'}`} />
                    <span className={`font-bold ${isDone ? 'text-white' : 'text-slate-300'}`}>{s.title}</span>
                  </div>
                  <span className={`font-mono font-bold ${isDone ? 'text-emerald-400' : 'text-indigo-400'}`}>
                    {isDone ? 'PASSED ✓' : `${s.val}%`}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">{s.desc}</div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full transition-all duration-200" style={{ width: `${s.val}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Processing;
