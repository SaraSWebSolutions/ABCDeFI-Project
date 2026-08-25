import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Globe,
  Zap,
  Upload,
} from 'lucide-react';
import {
  getKYCRecord,
  createSumsubApplicant,
  KYCRecord,
} from '../Services/kycService';

interface KYCSystemProps {
  userAddress?: string;
  onKycStatusChange?: (status: string) => void;
}

export const KYCSystem: React.FC<KYCSystemProps> = ({
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  onKycStatusChange,
}) => {
  const [record, setRecord] = useState<KYCRecord | null>(null);
  // Start in a ready state; we’ll only show the spinner while an async request runs.
  const [loading, setLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // Controls whether the manual‑upload form is visible.
  const [showManualForm, setShowManualForm] = useState<boolean>(false);

  useEffect(() => {
    loadStatus();
  }, [userAddress]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const rec = await getKYCRecord(userAddress);
      setRecord(rec);
      if (onKycStatusChange) {
        onKycStatusChange(rec.status);
      }
    } catch (e) {
      console.error('Error loading KYC status', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartKyc = async () => {
    setLoading(true);
    try {
      await createSumsubApplicant(userAddress, {
        country: 'India',
        fullName: 'Alex Rivers',
        documentType: 'International Public Security',
      });
      await loadStatus();
      setActionNotice('KYC was submitted to the authenticated backend and is pending provider review.');
    } catch (e) {
      console.error('Failed to start KYC', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-xs">Loading Sumsub Identity Verification Pipeline...</p>
      </div>
    );
  }

  const isApproved = record?.status === 'approved';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono text-slate-100">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Identity & Compliance Standard
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            KYC & Verification System
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated Sumsub AI verification linked to EVM Smart Contract Access Controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isApproved ? (
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Status: Verified
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-full flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" /> Status: Unverified
            </span>
          )}

        </div>
      </div>

      {/* ACTION NOTIFICATION */}
      {actionNotice && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs text-emerald-300 font-bold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* KYC SUBMISSION METHOD SELECTOR BUTTONS */}
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={handleStartKyc}
          className="p-4 rounded-2xl border bg-slate-950 border-slate-800 hover:border-emerald-500/50 text-left transition flex items-start gap-3 cursor-pointer group"
        >
          <div className="p-3 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl group-hover:scale-105 transition">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Automated Sumsub AI SDK</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold rounded-full border border-emerald-500/30">
                Live AI Webhook
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Launch instant Sumsub biometric face match & document scan via web SDK.
            </p>
          </div>
        </button>
      </div>

      {/* COMPLIANCE CARD DETAILS */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-400" /> Identity & Compliance Panel
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Provider</span>
            <div className="font-bold text-white mt-0.5">{record?.provider || 'Sumsub'}</div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Status</span>
            <div className={`font-bold mt-0.5 ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isApproved ? 'Verified' : 'Pending Verification'}
            </div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Verification Date</span>
            <div className="font-bold text-white mt-0.5">{record?.verifiedAt || '31 Jul 2026'}</div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Applicant Reference</span>
            <div className="font-bold text-indigo-400 mt-0.5">{record?.referenceId || 'APP_123456'}</div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Verification Level</span>
            <div className="font-bold text-white mt-0.5">{record?.verificationLevel || 'Identity + Liveness'}</div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Country</span>
            <div className="font-bold text-white mt-0.5">{record?.country || 'India'}</div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 sm:col-span-2">
            <span className="text-slate-500 text-[10px] uppercase">Verified Wallet Address</span>
            <div className="font-bold text-emerald-400 font-mono mt-0.5 truncate">{userAddress}</div>
          </div>
        </div>
      </div>

      {/* FEATURE UNLOCK MATRIX (BEFORE VS AFTER APPROVAL) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Platform Feature Unlock Matrix
          </h3>
          <span className="text-[11px] text-slate-400 font-normal">
            Enforced by <code className="text-indigo-300 font-mono">require(verifiedKYC[msg.sender])</code>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
          {[
            { name: 'P2P Borrowing', key: 'borrow' },
            { name: 'P2P Lending', key: 'lend' },
            { name: 'High Withdrawals', key: 'withdraw' },
            { name: 'Fiat Deposits', key: 'fiat' },
            { name: 'Gift Economy', key: 'gift' },
            { name: 'Franchise Registry', key: 'franchise' },
          ].map((feat) => (
            <div
              key={feat.key}
              className={`p-3 rounded-xl border transition ${isApproved
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
            >
              <div className="text-[16px] mb-1">{isApproved ? '✓' : '×'}</div>
              <div>{feat.name}</div>
              <div className="text-[9px] mt-1 uppercase text-slate-500 font-mono">
                {isApproved ? 'Unlocked' : 'Locked'}
              </div>
            </div>
          ))}
        </div>

        {!isApproved && !showManualForm && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowManualForm(true)}
              className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Submit KYC Manually (International Public Security)</span>
            </button>
            <button
              onClick={handleStartKyc}
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Submit KYC for Provider Review</span>
            </button>
          </div>
        )}
      </div>

      {/* VERIFICATION HISTORY TIMELINE */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" /> Verification History Log
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-mono">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Event</th>
                <th className="p-3">Status</th>
                <th className="p-3">Audit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {record?.history.map((h, i) => (
                <tr key={i} className="hover:bg-slate-900/50">
                  <td className="p-3 text-slate-400">{h.date}</td>
                  <td className="p-3 font-bold text-white">{h.event}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {h.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 text-[11px]">{h.note}</td>
                </tr>
              ))}
              {(!record?.history || record.history.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500 font-mono">
                    No history log recorded yet. Launch Sumsub verification or Submit KYC Manually to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KYCSystem;
