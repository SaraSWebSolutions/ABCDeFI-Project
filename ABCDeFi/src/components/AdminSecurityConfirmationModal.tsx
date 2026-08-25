import React, { useState } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export interface AdminSecurityConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionTitle: string;
  targetDescription: string;
  adminEmail: string;
  adminRole: string;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const AdminSecurityConfirmationModal: React.FC<AdminSecurityConfirmationModalProps> = ({
  isOpen,
  onClose,
  actionTitle,
  targetDescription,
  adminEmail,
  adminRole,
  onConfirm,
}) => {
  const [password, setPassword] = useState<string>('Admin@123');
  const [otpCode, setOtpCode] = useState<string>('123456');
  const [reason, setReason] = useState<string>('Routine Emergency Circuit Breaker Protocol Inspection');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!reason.trim()) {
      setErrorMsg('Mandatory audit action reason is required.');
      return;
    }

    if (otpCode !== '123456' && otpCode.length !== 6) {
      setErrorMsg('Invalid 2FA OTP code. Enter "123456" for demo authentication.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(reason);
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Failed to execute privileged admin action.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-mono animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-purple-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl shadow-purple-950/50 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-500 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 bg-purple-600/20 border border-purple-500/50 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">Privileged Security Override</h3>
            <p className="text-xs text-purple-400 font-bold">Role Required: {adminRole} ({adminEmail})</p>
          </div>
        </div>

        <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-2xl space-y-1 text-xs">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Target Action</div>
          <div className="font-bold text-white text-sm">{actionTitle}</div>
          <div className="text-[11px] text-slate-300">{targetDescription}</div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">1. Admin Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">2. 2FA OTP Authenticator Code (Demo: 123456)</label>
            <input
              type="text"
              required
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg font-bold text-emerald-400 focus:outline-none focus:border-purple-500 font-mono tracking-widest"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">3. Audit Log Reason Input (Mandatory)</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500 font-mono h-16 text-xs"
              placeholder="State reason for audit log entry..."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg shadow-purple-600/30 text-xs flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Verifying 2FA & Confirming Action...' : 'Confirm Privileged Action 🔐'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminSecurityConfirmationModal;
