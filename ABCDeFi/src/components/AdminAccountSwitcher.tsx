import React, { useState } from 'react';
import { useAuth } from '../Context/AuthContext';

type SwitchTarget = { id: string; email: string; name?: string; adminRole: string; active: boolean; suspended: boolean };

// This is a server-authorized account delegation control, not a role selector.
// The browser submits only a target ID returned by the Super-Admin-only API.
export const AdminAccountSwitcher: React.FC = () => {
  const { user, loading, adminSwitchTargets, switchAdminSession, returnToSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<SwitchTarget[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  if (user?.role !== 'admin') return null;
  const isSuperAdmin = user.adminRole === 'super_admin';
  const isDelegatedAdminSession = user.isDelegatedAdminSession === true;
  const mainAdminEmail = user.delegatedFromMainAdmin?.email || 'Canonical Main Admin unavailable';

  const openTargets = async () => {
    setStatus(null);
    const result = await adminSwitchTargets();
    if (!result.success) { setStatus(result.message || 'Available administrator accounts are unavailable.'); return; }
    setTargets(result.targets); setOpen(true);
  };
  const switchTo = async (target: SwitchTarget) => {
    setStatus(`Switching to ${target.adminRole}…`);
    const result = await switchAdminSession(target.id);
    if (!result.success) { setStatus(result.message || 'Administrator session switch was denied.'); return; }
    setOpen(false); setTargets([]); setStatus(null);
  };
  const returnToSource = async () => {
    setStatus('Returning to Super Admin…');
    const result = await returnToSuperAdmin();
    if (!result.success) { setStatus(result.message || 'Return to Super Admin was denied.'); return; }
    setStatus(null);
  };

  return <section aria-label="Admin session" className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-3 text-xs text-slate-300">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-white">Admin session</p><p className="mt-1 break-all">Account: <b>{user.email || 'unavailable'}</b></p><p className="mt-1">Application role: <b>{user.adminRole || 'ADMIN_ROLE_NOT_CONFIGURED'}</b></p><p className="mt-1">Session provenance: <b>{isDelegatedAdminSession ? 'DELEGATED FROM MAIN ADMIN' : 'DIRECT AUTHENTICATED SESSION'}</b></p>{isDelegatedAdminSession && <p className="mt-1 break-all">Main Admin: <b>{mainAdminEmail}</b></p>}<p className="mt-1 text-slate-500">Application identity is separate from the connected blockchain wallet and live module role checks.</p></div>{isSuperAdmin ? <button type="button" onClick={() => void openTargets()} disabled={loading} className="rounded-lg border border-cyan-400/50 px-3 py-2 font-bold text-cyan-100">Switch Admin</button> : isDelegatedAdminSession ? <button type="button" onClick={() => void returnToSource()} disabled={loading} className="rounded-lg border border-cyan-400/50 px-3 py-2 font-bold text-cyan-100">Return to Main Admin</button> : null}</div>
    {status && <p role="status" className="mt-2 text-amber-200">{status}</p>}
    {open && <div role="dialog" aria-label="Switch Admin Account" className="mt-3 rounded-lg border border-slate-700 bg-slate-900 p-3"><p className="font-bold text-white">Switch Admin</p><p className="mt-1 text-slate-400">Available accounts are returned only for the authenticated Super Admin. Selecting a server-issued targetUserId creates a bounded application session; no target password or OTP is collected, and the connected wallet and blockchain roles never change.</p><div className="mt-3 space-y-2">{targets.length === 0 ? <p className="text-slate-400">No eligible application Admin account is available.</p> : targets.map((target) => <article key={target.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-700 p-2"><div><p className="font-bold text-white">{target.adminRole}</p><p className="break-all text-slate-400">{target.email}</p><p className={target.active && !target.suspended ? 'text-emerald-300' : 'text-amber-200'}>{target.active && !target.suspended ? 'ACTIVE' : target.suspended ? 'SUSPENDED' : 'INACTIVE'}</p></div><button type="button" disabled={loading || !target.active || target.suspended} onClick={() => void switchTo(target)} className="rounded border border-cyan-400/50 px-3 py-2 font-bold text-cyan-100">Switch to {target.adminRole}</button></article>)}</div><button type="button" onClick={() => { setOpen(false); setTargets([]); setStatus(null); }} className="mt-3 rounded border border-slate-600 px-3 py-2">Cancel</button></div>}
  </section>;
};
