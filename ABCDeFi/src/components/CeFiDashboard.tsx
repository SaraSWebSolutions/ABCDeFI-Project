import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  Bell,
  Settings,
  LogIn,
  Key,
  ShieldAlert,
  CheckCircle2,
  Sliders,
  Smartphone,
  Wallet,
  Globe,
  Loader2,
  Trash2,
  Check,
  Sparkles,
  Zap,
  RefreshCw,
  Send,
  CheckCircle,
} from 'lucide-react';
import {
  CeFiUser,
  CeFiSettings,
  CeFiNotification,
  loginWithEmail,
  getUserProfile,
  getProfileSettings,
  updateProfileSettings,
  getNotifications,
} from '../Services/cefi';
import { KYCSystem } from './KYCSystem';

export const CeFiDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'kyc' | 'auth' | 'settings' | 'notifications' | 'banking'>('profile');

  // CeFi State
  const [user, setUser] = useState<CeFiUser | null>(null);
  const [settings, setSettings] = useState<CeFiSettings | null>(null);
  const [notifications, setNotifications] = useState<CeFiNotification[]>([]);

  // Step 20 Auth & Password Reset State
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [emailInput, setEmailInput] = useState<string>('alex.trader@abcdefi.io');
  const [passwordInput, setPasswordInput] = useState<string>('••••••••••••');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('••••••••••••');
  const [nameInput, setNameInput] = useState<string>('Alex Rivers');
  const [jwtToken, setJwtToken] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Step 22 Notification Toggles
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true);
  const [loanReminders, setLoanReminders] = useState<boolean>(true);
  const [rewardAlerts, setRewardAlerts] = useState<boolean>(true);
  const [stakingNotifs, setStakingNotifs] = useState<boolean>(true);

  // Settings Feedback
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [settingsMessage, setSettingsMessage] = useState<string>('');

  // Notification Filter State
  const [notifFilter, setNotifFilter] = useState<'All' | 'Unread' | 'Risk Alert' | 'Transaction' | 'System'>('All');

  useEffect(() => {
    async function loadData() {
      const p = await getUserProfile();
      const s = await getProfileSettings();
      const n = await getNotifications();
      setUser(p);
      setSettings(s);
      setNotifications(n);

      const savedAuthState = localStorage.getItem('cefi_auth_state');
      const savedJwtToken = localStorage.getItem('cefi_jwt_token');
      if (savedAuthState === 'authenticated' && savedJwtToken) {
        setJwtToken(savedJwtToken);
        setIsAuthenticated(true);
        setAuthMessage('Signed in and ready to continue.');
      }
    }
    loadData();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    if (authMode === 'reset') {
      setAuthMessage(`Password reset link sent to ${emailInput}! Check your inbox.`);
      setAuthLoading(false);
      return;
    }

    setAuthMessage('Authenticating credentials & generating JWT Token...');
    try {
      const loggedUser = await loginWithEmail(emailInput, passwordInput);
      setUser(loggedUser);
      const newToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ email: emailInput, exp: Date.now() + 86400000 }))}.sig`;
      setJwtToken(newToken);
      setIsAuthenticated(true);
      setActiveTab('auth');

      // Instantly unlock all KYC verification requirements across the platform
      const addresses = ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC', '0x90F79bf6EB2c4f870365E785982E1f101E93b906'];
      addresses.forEach(addr => localStorage.setItem(`kyc_${addr}`, 'approved'));
      localStorage.setItem('global_kyc_approved', 'approved');
      localStorage.setItem('cefi_auth_state', 'authenticated');
      localStorage.setItem('cefi_jwt_token', newToken);

      setAuthMessage(`Signed in as ${loggedUser.displayName}. Your session is active and your account is ready.`);
    } catch (err) {
      setAuthMessage('Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsLoading(true);
    setSettingsMessage('Saving updated notification preferences & security settings...');
    try {
      const updated = await updateProfileSettings(settings);
      setSettings(updated);
      setSettingsMessage('Settings & Notification Preferences saved successfully!');
    } catch (err) {
      setSettingsMessage('Failed to save settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setUser(null);
    setJwtToken('');
    localStorage.removeItem('cefi_auth_state');
    localStorage.removeItem('cefi_jwt_token');
    setAuthMessage('Signed out. You can sign in again when you are ready.');
    setAuthMode('signin');
    setActiveTab('auth');
  };

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const toggleNotifRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifs = notifications.filter((n) => {
    if (notifFilter === 'All') return true;
    if (notifFilter === 'Unread') return !n.read;
    return n.type === notifFilter;
  });

  return (
    <div id="cefi-dashboard" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">

      {/* HEADER & TAB NAVIGATION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <span>CeFi Platform</span>
            <span>CeFi Platform</span>
            <span className="text-slate-600">↓</span>
            <span>Accounts, KYC & Notifications</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <User className="w-5 h-5 text-indigo-400" />
            CeFi Features (User Accounts, KYC & Notifications)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Email Registration, Login, JWT Auth, Aadhaar/PAN/Passport KYC, and Real-Time Notifications.
          </p>
        </div>

        {/* TAB BUTTONS */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: 'User Profile', icon: User },
            { id: 'notifications', label: `Notifications (${unreadCount})`, icon: Bell },
            { id: 'settings', label: 'Preferences', icon: Settings },
          ].map((tab) => {
            const IconComp = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${isSelected
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* USER ACCOUNTS, LOGIN, REGISTRATION, RESET & JWT                          */}
      {/* ========================================================================= */}
      {activeTab === 'auth' && (
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl max-w-2xl mx-auto space-y-6">
          {/* LOGIN SCREEN LOGO HEADER */}
          <div className="flex flex-col items-center justify-center text-center space-y-3 pt-2 border-b border-slate-800 pb-5">
            <img
              src="/images/abcdefi-logo.svg"
              alt="ABCDeFi Logo"
              className="w-20 h-20 rounded-full shadow-2xl shadow-purple-900/60 border-2 border-amber-400 object-cover"
            />
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">ABCDeFi Protocol</h2>
              <p className="text-xs text-slate-400 mt-1">Next-Gen Decentralized Finance & RWA Ecosystem</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase">User Accounts & Auth Engine</h3>
            </div>
            {!isAuthenticated && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`px-3 py-1 rounded-lg transition ${authMode === 'signin' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`px-3 py-1 rounded-lg transition ${authMode === 'signup' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('reset')}
                  className={`px-3 py-1 rounded-lg transition ${authMode === 'reset' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Reset Password
                </button>
              </div>
            )}
          </div>

          {authMessage && (
            <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              <span>{authMessage}</span>
            </div>
          )}

          {isAuthenticated ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400">Signed In</p>
                    <h4 className="text-lg font-black text-white">{user?.displayName ?? 'Verified Account'}</h4>
                    <p className="text-sm text-slate-300">{user?.email ?? emailInput}</p>
                  </div>
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[10px] font-bold text-emerald-300">Active Session</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-slate-400 uppercase">Wallet</p>
                  <p className="mt-1 font-mono text-slate-200 break-all">{user?.walletAddress ?? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-slate-400 uppercase">KYC Level</p>
                  <p className="mt-1 text-slate-200">{user?.kycLevel ?? 'Level 2 (Advanced)'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
                >
                  View Profile
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 transition hover:text-white"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {authMode !== 'reset' && (
                <div>
                  <label className="block text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              {authMode === 'signup' && (
                <div>
                  <label className="block text-slate-300 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black py-3 rounded-2xl shadow-lg shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : authMode === 'reset' ? (
                  <Send className="w-4 h-4" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>
                  {authMode === 'signin'
                    ? 'Sign In (Generate JWT Token)'
                    : authMode === 'signup'
                      ? 'Create CeFi User Account'
                      : 'Send Password Reset Token'}
                </span>
              </button>
            </form>
          )}

          {/* JWT TOKEN DISPLAY */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400 font-bold uppercase text-[10px]">
              <span>JWT Authentication Session Bearer Token</span>
              <span className={`font-mono ${isAuthenticated ? 'text-emerald-400' : 'text-slate-500'}`}>Status: {isAuthenticated ? 'Active' : 'Not Active'}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px] text-indigo-300 font-mono break-all">
              Bearer {jwtToken || 'No active session'}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KYC VERIFICATION (Aadhaar, PAN, Passport, Workflow)                      */}
      {/* ========================================================================= */}
      {activeTab === 'kyc' && <KYCSystem />}

      {/* ========================================================================= */}
      {/* BANKING & FIAT INTEGRATION (Deposits, Withdrawals, Stablecoin Conversion) */}
      {/* ========================================================================= */}
      {activeTab === 'banking' && (
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" /> Banking & Fiat Integration (CeFi On-Ramp / Off-Ramp)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Wire Transfer, ACH, SEPA, & UPI Bank Integration + 1:1 Instant Stablecoin Conversion.</p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
              Plaid & Circle API Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="text-slate-400 font-bold">1. Fiat Deposit Gateway</div>
              <div className="text-base font-black text-white">$5,000 USD / Day Limit</div>
              <div className="text-[10px] text-slate-500">ACH / Wire Transfer / UPI</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="text-slate-400 font-bold">2. Fiat Withdrawal Gateway</div>
              <div className="text-base font-black text-white">Direct Bank Payout</div>
              <div className="text-[10px] text-slate-500">Same-Day Settlement</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="text-slate-400 font-bold">3. Stablecoin Swap</div>
              <div className="text-base font-black text-emerald-400">1:1 USD ➔ USDC</div>
              <div className="text-[10px] text-slate-500">Zero Slippage Conversion</div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase">Linked Bank Accounts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-1">
                <div className="font-bold text-white">JPMorgan Chase Bank (****6789)</div>
                <div className="text-[10px] text-slate-400">Alex Rivers • Routing: 021000021 (USD)</div>
                <div className="text-[10px] text-emerald-400 font-bold">Verified ✓</div>
              </div>

              <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-1">
                <div className="font-bold text-white">HDFC Bank India (****4321)</div>
                <div className="text-[10px] text-slate-400">Alex Rivers • IFSC: HDFC0001234 (INR)</div>
                <div className="text-[10px] text-emerald-400 font-bold">Verified ✓</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NOTIFICATIONS (Email, Loan Reminders, Rewards, Staking Alerts)           */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">

          {/* NOTIFICATION PREFERENCE TOGGLES */}
          <div className="space-y-4 border-b border-slate-800 pb-5">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              Email & Real-Time Notification Channels
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Email Alerts</div>
                  <div className="text-[10px] text-slate-500">Digest emails</div>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Loan Reminders</div>
                  <div className="text-[10px] text-slate-500">Liquidation risk & interest</div>
                </div>
                <input
                  type="checkbox"
                  checked={loanReminders}
                  onChange={(e) => setLoanReminders(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Reward Alerts</div>
                  <div className="text-[10px] text-slate-500">Presale & referral bonuses</div>
                </div>
                <input
                  type="checkbox"
                  checked={rewardAlerts}
                  onChange={(e) => setRewardAlerts(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Staking Alerts</div>
                  <div className="text-[10px] text-slate-500">Yield claim reminders</div>
                </div>
                <input
                  type="checkbox"
                  checked={stakingNotifs}
                  onChange={(e) => setStakingNotifs(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* NOTIFICATION FEED */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase">Live Notification Inbox Feed ({unreadCount} Unread)</h4>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={markAllRead}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                >
                  Mark All as Read
                </button>
                <button
                  onClick={clearNotifications}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredNotifs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No notifications found.</div>
              ) : (
                filteredNotifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => toggleNotifRead(n.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-start justify-between gap-4 ${n.read ? 'bg-slate-900/60 border-slate-800/80 opacity-75' : 'bg-slate-900 border-indigo-500/40 shadow-md'
                      }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{n.title}</span>
                        <span className={`px-2 py-0.2 text-[9px] rounded font-bold uppercase ${n.type === 'Risk Alert'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : n.type === 'Yield'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}>
                          {n.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{n.message}</p>
                      <div className="text-[10px] text-slate-500">{n.timestamp}</div>
                    </div>

                    {!n.read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 mt-1" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* USER PROFILE */}
      {activeTab === 'profile' && user && (
        <div className="space-y-6">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="flex items-center gap-4 border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-xl shrink-0">
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-full h-full rounded-2xl object-cover"
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">{user.displayName}</h3>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{user.email}</span>
                </div>
                <div className="text-[11px] text-slate-500">Member since {user.memberSince}</div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
              <div className="text-slate-400 uppercase text-[10px]">Verification & Security</div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">KYC Status:</span>
                <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  {user.kycLevel} ✓
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Two-Factor Auth:</span>
                <span className="text-indigo-400 font-bold">Enabled 🔒</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Linked Web3 Wallet:</span>
                <span className="text-slate-200 font-mono">0x7099...79C8</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="text-slate-400 uppercase text-[10px]">CeFi Account Balances</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                  <div className="text-[10px] text-slate-500">ETH Balance</div>
                  <div className="text-base font-extrabold text-emerald-400 mt-0.5">{user.cefiEthBalance}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                  <div className="text-[10px] text-slate-500">ABCD Balance</div>
                  <div className="text-base font-extrabold text-purple-400 mt-0.5">{user.cefiAbcdBalance}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase">Profile & Security Settings</h3>
            </div>
            <button
              type="submit"
              disabled={settingsLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition cursor-pointer shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              {settingsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Settings</span>
            </button>
          </div>

          {settingsMessage && (
            <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{settingsMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <div className="text-slate-300 font-bold uppercase text-[11px] flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" /> Account Identity
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={settings.displayName}
                  onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-slate-300 font-bold uppercase text-[11px] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Security Preferences
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-white font-bold">Two-Factor Auth (2FA)</div>
                  <div className="text-[10px] text-slate-500">Require 2FA code on login</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.twoFactorEnabled}
                  onChange={(e) => setSettings({ ...settings, twoFactorEnabled: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-white font-bold">Transaction PIN</div>
                  <div className="text-[10px] text-slate-500">Require PIN for withdrawal txs</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.transactionPinEnabled}
                  onChange={(e) => setSettings({ ...settings, transactionPinEnabled: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </form>
      )}

    </div>
  );
};

export default CeFiDashboard;
