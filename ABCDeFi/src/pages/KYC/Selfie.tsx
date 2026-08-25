import React, { useState } from 'react';
import { Camera, CheckCircle2, ArrowRight } from 'lucide-react';

interface SelfieProps {
  onContinue: () => void;
}

export const Selfie: React.FC<SelfieProps> = ({ onContinue }) => {
  const [captured, setCaptured] = useState<boolean>(false);

  return (
    <div className="space-y-6 text-slate-100 font-mono">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Step 5: Take Selfie</h2>
        <p className="text-xs text-slate-400">Position your face inside the circle frame for face matching.</p>
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 text-center">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Camera Preview
        </div>

        <div className="relative w-40 h-40 rounded-full border-4 border-indigo-500/60 bg-slate-900 flex flex-col items-center justify-center mx-auto overflow-hidden shadow-inner">
          {!captured ? (
            <>
              <div className="text-5xl animate-bounce">😀</div>
              <div className="absolute inset-x-0 bottom-2 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold py-0.5 border-t border-emerald-500/30">
                Face Detected ✓
              </div>
            </>
          ) : (
            <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
          )}
        </div>

        {!captured ? (
          <button
            onClick={() => setCaptured(true)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 mx-auto"
          >
            <Camera className="w-4 h-4" />
            <span>Capture Selfie</span>
          </button>
        ) : (
          <div className="text-xs text-emerald-400 font-bold">Selfie Captured & Verified ✓</div>
        )}
      </div>

      <button
        disabled={!captured}
        onClick={onContinue}
        className={`w-full py-3.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
          captured ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        <span>Continue to Liveness Check →</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Selfie;
