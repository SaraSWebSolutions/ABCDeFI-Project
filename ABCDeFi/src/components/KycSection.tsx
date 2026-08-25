import React, { useState } from 'react';
import { User, KycRecord } from '../types';
import { ShieldCheck, ShieldAlert, ArrowRight, RefreshCw, Zap, CheckCircle2, FileText, Send } from 'lucide-react';
import { SumsubKycModal } from './SumsubKycModal';

interface KycSectionProps {
  user: User | null;
  kycRecord: KycRecord | null;
  onKycCompleted: () => void;
  onNextStep: () => void;
}

export const KycSection: React.FC<KycSectionProps> = ({
  user,
  kycRecord,
  onKycCompleted,
  onNextStep
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [applicantId, setApplicantId] = useState<string>(kycRecord?.sumsubApplicantId || 'applicant_sumsub_88301');
  const [accessToken, setAccessToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 6 – Launch Sumsub
  const handleLaunchSumsubSDK = async () => {
    if (!user) {
      setError('Please sign in or register first');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/kyc/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('abcdefi_token') || ''}`
        },
        body: JSON.stringify({ userId: user.id, docType: 'Passport' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize Sumsub KYC SDK');

      setApplicantId(data.applicantId);
      setAccessToken(data.accessToken);
      setIsModalOpen(true);
    } catch (err: any) {
      setError(err.message);
      // Fallback modal open for testing
      setIsModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Direct Webhook Trigger Simulation
  const handleDirectWebhookTrigger = async (reviewResult: 'GREEN' | 'RED') => {
    setLoading(true);
    try {
      await fetch('/api/webhooks/sumsub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantId: kycRecord?.sumsubApplicantId || applicantId,
          reviewResult
        })
      });
      onKycCompleted();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-xs font-semibold border border-emerald-800/60">
                Steps 6, 7 & 8
              </span>
              <h2 className="text-xl font-bold text-slate-100">Sumsub KYC SDK & Webhook Processing</h2>
            </div>
            <p className="text-xs text-slate-400">
              Identity document verification, facial liveness detection, and automated Sumsub Webhook review events.
            </p>
          </div>

          {user?.isKycVerified && (
            <button
              onClick={onNextStep}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center space-x-2 self-start md:self-auto transition"
            >
              <span>Next: BSC Smart Contract Status</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Sumsub SDK Launch Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100">Step 6 – Launch Sumsub SDK</h3>
            <span className="text-xs text-emerald-400 font-mono bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
              API Token Ready
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Click below to generate a Sumsub WebSDK access token and launch the interactive identity verification flow inside our secure application dialog.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Target User:</span>
              <span className="font-semibold text-slate-200">{user?.name || 'Not Logged In'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Wallet Linked:</span>
              <span className="font-mono text-emerald-400 text-[11px] truncate max-w-[180px]">
                {user?.walletAddress || 'No wallet connected'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">KYC Status:</span>
              <span className={`font-bold ${user?.isKycVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                {user?.isKycVerified ? 'APPROVED (GREEN)' : 'PENDING / UNVERIFIED'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLaunchSumsubSDK}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Launch Sumsub Identity Verification SDK</span>
              </>
            )}
          </button>
        </div>

        {/* Step 8 Webhook Status & Manual Simulator */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100">Step 8 – Sumsub Webhook Endpoint</h3>
            <span className="text-[11px] text-cyan-400 font-mono">POST /api/webhooks/sumsub</span>
          </div>

          {user?.isKycVerified ? (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 space-y-3">
              <div className="flex items-center space-x-2 text-sm font-bold text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span>KYC Review Approved & Verified!</span>
              </div>
              <div className="text-xs space-y-1 font-mono text-slate-300">
                <p>Applicant ID: {kycRecord?.sumsubApplicantId || applicantId}</p>
                <p>Review Result: GREEN</p>
                <p>Verified At: {kycRecord?.verifiedAt || new Date().toLocaleString()}</p>
              </div>
              <p className="text-[11px] text-slate-400 pt-2 border-t border-emerald-900/50">
                On-Chain Status: <span className="text-amber-400 font-mono">RegistrationRegistry.sol setKYCStatus(user, true)</span> executed!
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 space-y-2">
              <div className="flex items-center space-x-2 text-sm font-bold text-amber-400">
                <ShieldAlert className="w-5 h-5" />
                <span>KYC Pending Approval</span>
              </div>
              <p className="text-xs text-slate-300">
                Complete the Sumsub document and liveness scan to trigger the GREEN webhook approval event.
              </p>
            </div>
          )}

          {/* Webhook Tester Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <span>Direct Webhook Dispatch Tester</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Test sending real webhook JSON payload <code className="text-cyan-300">{"{ applicantId, reviewResult: 'GREEN' }"}</code> directly to backend:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDirectWebhookTrigger('GREEN')}
                disabled={loading}
                className="py-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition"
              >
                Send GREEN Webhook
              </button>
              <button
                onClick={() => handleDirectWebhookTrigger('RED')}
                disabled={loading}
                className="py-2 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 font-bold text-xs transition"
              >
                Send RED Webhook
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Sumsub Modal */}
      <SumsubKycModal
        applicantId={applicantId}
        accessToken={accessToken}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onKycCompleted={() => {
          setIsModalOpen(false);
          onKycCompleted();
        }}
      />
    </div>
  );
};
