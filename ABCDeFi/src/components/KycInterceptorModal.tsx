import React from 'react';
import { ShieldCheck, Lock, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { startKYCRedirect } from '../Services/kycService';

export interface KycInterceptorModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionName: string;
  onStartKyc?: () => void;
  userAddress?: string;
}

export const KycInterceptorModal: React.FC<KycInterceptorModalProps> = ({
  isOpen,
  onClose,
  actionName,
  onStartKyc,
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Icon */}
        <div className="flex justify-between items-start">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 font-mono">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Compliance Gate
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            KYC Verification Required
          </h3>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            To perform <span className="text-amber-400 font-bold">{actionName}</span>, your account must be verified by Sumsub to comply with Web3 DeFi regulatory standards.
          </p>
        </div>

        {/* Unlocked Benefits List */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Verification Unlocks:
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>P2P Borrowing & Lending Access</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>High Withdrawal & Fiat Limits</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Franchise Node Governance Registration</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              if (onStartKyc) onStartKyc();
              startKYCRedirect(userAddress);
            }}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Complete KYC Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default KycInterceptorModal;
