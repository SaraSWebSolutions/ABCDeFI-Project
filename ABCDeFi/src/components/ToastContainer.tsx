import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-3 max-w-sm w-full font-mono">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`p-4 rounded-2xl border shadow-2xl flex items-start justify-between gap-3 animate-in slide-in-from-right duration-300 ${
            t.type === 'success'
              ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
              : t.type === 'error'
              ? 'bg-slate-900 border-rose-500/50 text-rose-300'
              : 'bg-slate-900 border-indigo-500/50 text-indigo-300'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
            <div>
              <div className="font-bold text-xs text-white">{t.title}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">{t.message}</div>
            </div>
          </div>
          <button onClick={() => onDismiss(t.id)} className="text-slate-500 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
