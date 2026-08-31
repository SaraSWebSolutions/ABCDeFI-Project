import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../Context/AuthContext';
import {
  DevelopmentAuthDiagnostics,
  getDevelopmentAuthDiagnostics,
  resendDevelopmentLoginOtp,
} from '../Services/developmentAuthDiagnostics';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

export const AdminAuthenticationDiagnostics: React.FC = () => {
  const { user } = useAuth();
  const [userId, setUserId] = useState(user?.id || '');
  const [diagnostics, setDiagnostics] = useState<DevelopmentAuthDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(user?.id || '');
  }, [user?.id]);

  const refresh = async () => {
    if (!userId.trim()) {
      setError('Enter the development user ID to inspect.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      setDiagnostics(await getDevelopmentAuthDiagnostics(userId.trim()));
    } catch (requestError) {
      setDiagnostics(null);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load diagnostics.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!userId.trim()) {
      setError('Enter the development user ID before requesting a resend.');
      return;
    }
    setResending(true);
    setError(null);
    try {
      setMessage(await resendDevelopmentLoginOtp(userId.trim()));
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to resend the OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-sky-500/35 bg-sky-500/10 p-5 text-sm text-slate-100">
      <h2 className="font-bold text-sky-100">Authentication Diagnostics</h2>
      <p className="mt-1 text-xs text-sky-100/75">
        Development-only inspector. Login OTPs remain hash-only in MongoDB; any visible code is short-lived backend runtime state.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          aria-label="Development user ID"
          placeholder="Development user ID"
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
        />
        <button onClick={refresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-60">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Diagnostics
        </button>
        <button onClick={resend} disabled={resending} className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/70 px-3 py-2 text-xs font-bold text-sky-100 disabled:opacity-60">
          <Send size={14} /> {resending ? 'Requesting…' : 'Resend OTP'}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 flex items-center gap-2 text-rose-200"><AlertTriangle size={15} />{error}</p>}
      {message && <p className="mt-3 text-emerald-200">{message}</p>}

      {diagnostics && (
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <div><dt className="text-slate-400">User</dt><dd>{diagnostics.userId}</dd></div>
          <div><dt className="text-slate-400">Email</dt><dd>{diagnostics.email}</dd></div>
          <div><dt className="text-slate-400">Role</dt><dd>{diagnostics.role}</dd></div>
          <div><dt className="text-slate-400">Account Status</dt><dd>{diagnostics.accountStatus}</dd></div>
          <div><dt className="text-slate-400">2FA</dt><dd>{diagnostics.twoFactorEnabled ? 'Enabled' : 'Disabled'}</dd></div>
          <div><dt className="text-slate-400">OTP Status</dt><dd>{diagnostics.otpExists ? 'Active' : 'None / expired'}</dd></div>
          <div><dt className="text-slate-400">OTP Expires</dt><dd>{formatDate(diagnostics.otpExpiresAt)}</dd></div>
          <div><dt className="text-slate-400">OTP Remaining</dt><dd>{diagnostics.otpRemainingSeconds}s</dd></div>
          <div><dt className="text-slate-400">Last OTP Generated</dt><dd>{formatDate(diagnostics.lastOtpGeneratedAt)}</dd></div>
          <div><dt className="text-slate-400">Delivery Method</dt><dd>{diagnostics.lastOtpDeliveryMethod || 'Not available'}</dd></div>
          <div><dt className="text-slate-400">Resend Count</dt><dd>{diagnostics.resendCount}</dd></div>
          <div><dt className="text-slate-400">Development OTP</dt><dd className="font-mono font-bold tracking-wider">{diagnostics.developmentOtp || '******'}</dd></div>
        </dl>
      )}
    </section>
  );
};
