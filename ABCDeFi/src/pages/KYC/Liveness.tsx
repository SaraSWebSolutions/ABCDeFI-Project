import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

interface LivenessProps {
  onContinue: () => void;
}

export const Liveness: React.FC<LivenessProps> = ({ onContinue }) => {
  const [promptIdx, setPromptIdx] = useState<number>(0);
  const [complete, setComplete] = useState<boolean>(false);

  const prompts = [
    { title: 'Please Blink Your Eyes', emoji: '😉' },
    { title: 'Turn Head Slowly Left', emoji: '👈' },
    { title: 'Turn Head Slowly Right', emoji: '👉' },
    { title: 'Smile at the Camera', emoji: '😊' },
  ];

  useEffect(() => {
    if (promptIdx < prompts.length) {
      const timer = setTimeout(() => {
        setPromptIdx((prev) => prev + 1);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setComplete(true);
    }
  }, [promptIdx]);

  return (
    <div className="space-y-6 text-slate-100 font-mono">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Step 6: Liveness Check</h2>
        <p className="text-xs text-slate-400">Perform the required head movements to verify live presence.</p>
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 text-center">
        <div className="w-36 h-36 rounded-full border-4 border-indigo-500/60 bg-slate-900 flex flex-col items-center justify-center mx-auto shadow-inner">
          {!complete ? (
            <div className="text-5xl animate-pulse font-mono">
              {prompts[Math.min(promptIdx, prompts.length - 1)].emoji}
            </div>
          ) : (
            <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
          )}
        </div>

        {!complete ? (
          <div className="space-y-2">
            <div className="text-sm font-bold text-indigo-300 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>{prompts[Math.min(promptIdx, prompts.length - 1)].title}</span>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              {prompts.map((p, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    idx < promptIdx
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : idx === promptIdx
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : 'bg-slate-900 text-slate-600'
                  }`}
                >
                  ✓ {p.title.split(' ')[1] || p.title}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-emerald-400 font-bold">Liveness Verification Completed ✓</div>
        )}
      </div>

      <button
        disabled={!complete}
        onClick={onContinue}
        className={`w-full py-3.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
          complete ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        <span>Proceed to Verification Review →</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Liveness;
