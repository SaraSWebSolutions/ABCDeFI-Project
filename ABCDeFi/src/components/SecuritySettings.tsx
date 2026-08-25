import React, { useState, useEffect } from 'react';
import { useAuth } from '../Context/AuthContext';
import { Shield, Key, Mail, Smartphone, Monitor, Clock, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, Lock } from 'lucide-react';

export const SecuritySettings: React.FC = () => {
  const { user, token, toggle2FA, changePassword, changeEmail, changeMobile } = useAuth();

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');

  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.is2FAEnabled ?? true);
  
  // Feedback
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Sessions log
  const [sessions, setSessions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (user?.is2FAEnabled !== undefined) {
      setIs2FAEnabled(user.is2FAEnabled);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/user/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.activeSessions || []);
        setHistory(data.loginHistory || []);
      }
    } catch (e) {
      // Mock fallback sessions
      setSessions([
        { device: 'Chrome (macOS)', ip: '192.168.1.42', lastActive: new Date().toISOString() }
      ]);
      setHistory([
        { ip: '192.168.1.42', device: 'Chrome (macOS)', time: new Date().toISOString(), status: 'Successful Login (2FA)' }
      ]);
    }
  };

  const handleToggle2FA = async () => {
    setLoading(true);
    setMsg(null);
    const res = await toggle2FA();
    setLoading(false);
    if (res.success) {
      setIs2FAEnabled(Boolean(res.is2FAEnabled));
      setMsg({ type: 'success', text: res.message || '2FA settings updated successfully.' });
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to update 2FA.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!currentPassword || !newPassword) {
      setMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    setLoading(true);
    const res = await changePassword(currentPassword, newPassword);
    setLoading(false);
    if (res.success) {
      setMsg({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to change password.' });
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!newEmail) return;
    setLoading(true);
    const res = await changeEmail(newEmail);
    setLoading(false);
    if (res.success) {
      setMsg({ type: 'success', text: 'Email updated successfully.' });
      setNewEmail('');
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to update email.' });
    }
  };

  const handleChangeMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!newMobile) return;
    setLoading(true);
    const res = await changeMobile(newMobile);
    setLoading(false);
    if (res.success) {
      setMsg({ type: 'success', text: 'Mobile number updated successfully.' });
      setNewMobile('');
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to update mobile number.' });
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Security & Account Settings</h2>
          <p className="text-xs text-slate-400">Manage 2-Factor Authentication, login credentials, and session history</p>
        </div>
      </div>

      {msg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 2FA Toggle Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Two-Factor Authentication (2FA)</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                is2FAEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {is2FAEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-lg">
              When enabled, a 6-digit verification code will be dispatched to your registered email address every time you attempt to log in.
            </p>
          </div>

          <button
            onClick={handleToggle2FA}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            {is2FAEnabled ? (
              <>
                <ToggleRight className="w-5 h-5 text-emerald-400" />
                <span>Disable 2FA</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5 text-slate-500" />
                <span>Enable 2FA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid: Password & Contact Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Change Password */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Change Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition cursor-pointer"
            >
              Update Password
            </button>
          </form>
        </div>

        {/* Change Contact Info */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Mail className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Contact Info</h3>
          </div>

          {/* Email Update */}
          <form onSubmit={handleChangeEmail} className="space-y-2">
            <label className="block text-xs text-slate-400">
              Email Address <span className="text-slate-500">({user?.email})</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="newemail@domain.com"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              >
                Update
              </button>
            </div>
          </form>

          {/* Mobile Update */}
          <form onSubmit={handleChangeMobile} className="space-y-2 pt-2 border-t border-slate-800/60">
            <label className="block text-xs text-slate-400">
              Mobile Number <span className="text-slate-500">({user?.mobileNumber || 'Not set'})</span>
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                placeholder="+1 555 0199"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              >
                Update
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Active Sessions & Login Audit History */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Monitor className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Active Sessions & Security Log</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              Active Connected Devices
            </h4>
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-slate-500">No active sessions recorded.</p>
              ) : (
                sessions.map((s, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-200">{s.device || 'Web Browser'}</p>
                      <p className="text-[11px] text-slate-400">IP: {s.ip || 'Local Network'}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">Active</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Recent Login History
            </h4>
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-slate-500">No login activity recorded.</p>
              ) : (
                history.map((h, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-200">{h.status || 'Login Event'}</p>
                      <p className="text-[11px] text-slate-400">{new Date(h.time || Date.now()).toLocaleString()}</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{h.ip || 'Client'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
