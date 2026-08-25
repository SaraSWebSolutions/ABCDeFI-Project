import React, { useState } from 'react';
import { User, AuthTokens } from '../types';
import { Mail, Key, UserCheck, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Send } from 'lucide-react';

interface AuthSectionProps {
  user: User | null;
  tokens: AuthTokens | null;
  onLoginSuccess: (user: User, tokens: AuthTokens) => void;
  onRefreshProfile: () => void;
  onNextStep: () => void;
}

export const AuthSection: React.FC<AuthSectionProps> = ({
  user,
  tokens,
  onLoginSuccess,
  onRefreshProfile,
  onNextStep
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form States
  const [name, setName] = useState('Alex Vance');
  const [email, setEmail] = useState('alex@abcdefi.io');
  const [password, setPassword] = useState('Password123!');
  const [confirmPassword, setConfirmPassword] = useState('Password123!');
  const [country, setCountry] = useState('India');
  const [referralCode, setReferralCode] = useState('ABC123');

  // Login States
  const [loginEmail, setLoginEmail] = useState('alex@abcdefi.io');
  const [loginPassword, setLoginPassword] = useState('Password123!');

  // UI Statuses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Verification Inbox State
  const [emailSimInbox, setEmailSimInbox] = useState<Array<{ to: string; url: string; token: string }>>([]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, country, referralCode })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      setSuccessMsg(data.message || 'User registered! Check your simulated email inbox below to verify.');

      // Auto-fetch sent emails for inbox simulator
      fetchSentEmails();

      // Auto switch to login with email
      setLoginEmail(email);
      setLoginPassword(password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    setLoading(true);
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      console.log("Login response:", data);

      if (!res.ok) {
        throw new Error(data.message || data.error || JSON.stringify(data));
      }

      onLoginSuccess(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
      setSuccessMsg('Login successful! JWT Access & Refresh Tokens issued.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSentEmails = async () => {
    try {
      const res = await fetch('/api/admin/db-tables');
      const data = await res.json();
      if (data.emailsSent) {
        setEmailSimInbox(data.emailsSent);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleVerifyEmailByToken = async (token: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/user/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: token })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Email verification failed');
      }

      setSuccessMsg('Email successfully verified! Step 2 complete.');
      onRefreshProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-xs font-semibold border border-emerald-800/60">
                Steps 1 - 3
              </span>
              <h2 className="text-xl font-bold text-slate-100">Authentication & Email Verification</h2>
            </div>
            <p className="text-xs text-slate-400">
              Create your ABCDeFi account, verify email address, and receive secure JWT tokens.
            </p>
          </div>

          {user && user.isEmailVerified && (
            <button
              onClick={onNextStep}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center space-x-2 self-start md:self-auto transition"
            >
              <span>Next: Connect Wallet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid: Form vs User Profile / JWT Token Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left Column: Register or Login Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100">
              {isRegisterMode ? 'Step 1 – User Registration' : 'Step 3 – User Login'}
            </h3>
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline"
            >
              {isRegisterMode ? 'Already registered? Login instead' : "Don't have an account? Register"}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {isRegisterMode ? (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                  placeholder="e.g. Alex Vance"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                  placeholder="alex@gmail.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Country *</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="India">India</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Singapore">Singapore</option>
                    <option value="UAE">UAE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Referral Code (Optional)</label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="ABC123"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Register Account</span>}
              </button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Log In (Generate JWT)</span>}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: User State & Email Inbox Verification Simulator */}
        <div className="space-y-6">

          {/* User Account Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>Authenticated User Profile</span>
              {user?.isEmailVerified ? (
                <span className="text-xs text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
                  Email Verified ✓
                </span>
              ) : (
                <span className="text-xs text-amber-400 bg-amber-950 px-2.5 py-1 rounded-full border border-amber-800">
                  Email Unverified ⚠️
                </span>
              )}
            </h3>

            {user ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-slate-400 font-mono text-[10px]">USER ID</span>
                    <p className="font-semibold text-slate-200 font-mono">{user.id}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[10px]">NAME</span>
                    <p className="font-semibold text-slate-200">{user.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[10px]">EMAIL</span>
                    <p className="font-semibold text-slate-200 truncate">{user.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[10px]">COUNTRY</span>
                    <p className="font-semibold text-slate-200">{user.country}</p>
                  </div>
                </div>

                {tokens && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                      <span>JWT ACCESS TOKEN</span>
                      <span className="text-[10px] text-slate-400 font-normal">Expires: 1 Hour</span>
                    </div>
                    <p className="text-[10px] text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800/80">
                      {tokens.accessToken}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 pt-2">
                      <span>REFRESH TOKEN</span>
                      <span className="text-[10px] text-slate-400 font-normal">Expires: 7 Days</span>
                    </div>
                    <p className="text-[10px] text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800/80">
                      {tokens.refreshToken}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-dashed border-slate-800">
                No active session. Please register or login to acquire JWT tokens.
              </div>
            )}
          </div>

          {/* Step 2 – Email Verification Simulator */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-100">Step 2 – Simulated Verification Inbox</h4>
              </div>
              <button
                onClick={fetchSentEmails}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Fetch Inbox</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              When a user registers, an email is generated containing the verification token link. Click the verification link below to verify:
            </p>

            {emailSimInbox.length > 0 ? (
              <div className="space-y-3">
                {emailSimInbox.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">Verify your ABCDeFi Account</span>
                      <span className="text-[10px] text-slate-500 font-mono">To: {item.to}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {item.url}
                    </p>
                    <button
                      onClick={() => handleVerifyEmailByToken(item.token)}
                      className="w-full py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/40 text-xs transition flex items-center justify-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Click to Verify Email (POST /api/user/verify-otp)</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                Register a new account above to generate a verification email dispatch token.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
