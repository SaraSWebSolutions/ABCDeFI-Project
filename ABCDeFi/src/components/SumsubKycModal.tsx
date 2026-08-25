import React, { useState } from 'react';
import { Shield, Camera, FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw, UploadCloud, Eye } from 'lucide-react';

interface SumsubKycModalProps {
  applicantId: string;
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
  onKycCompleted: (reviewResult: 'GREEN' | 'RED') => void;
}

export const SumsubKycModal: React.FC<SumsubKycModalProps> = ({
  applicantId,
  accessToken,
  isOpen,
  onClose,
  onKycCompleted
}) => {
  const [step, setStep] = useState<'SELECT_DOC' | 'UPLOAD_DOC' | 'LIVENESS_SELFIE' | 'SUBMITTING' | 'RESULT'>('SELECT_DOC');
  const [selectedDocType, setSelectedDocType] = useState<string>('Passport');
  const [livenessProgress, setLivenessProgress] = useState<number>(0);
  const [simulatedResult, setSimulatedResult] = useState<'GREEN' | 'RED'>('GREEN');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const docTypes = [
    { id: 'Passport', name: 'Passport', desc: 'International Machine Readable Passport', icon: '🛂' },
    { id: 'Aadhaar', name: 'Aadhaar Card', desc: 'Indian Unique Identification Card', icon: '🆔' },
    { id: 'PAN', name: 'PAN Card', desc: 'Permanent Account Number Card', icon: '💳' },
    { id: 'Driving License', name: 'Driving License', desc: 'Government Issued Driver Permit', icon: '🚘' }
  ];

  const handleStartLiveness = () => {
    setStep('LIVENESS_SELFIE');
    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      setLivenessProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setStep('SUBMITTING');
        triggerSumsubWebhook('GREEN');
      }
    }, 600);
  };

  const triggerSumsubWebhook = async (result: 'GREEN' | 'RED') => {
    setLoading(true);
    setSimulatedResult(result);
    try {
      const res = await fetch('/api/webhooks/sumsub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantId,
          reviewResult: result,
          rejectionReason: result === 'RED' ? 'Document unreadable or face mismatch' : undefined
        })
      });

      const data = await res.json();
      setStep('RESULT');
      onKycCompleted(result);
    } catch (e) {
      console.error('Webhook error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Sumsub Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Sumsub Identity SDK</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded font-mono border border-cyan-800">
                  WebSDK v1.0
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Applicant ID: {applicantId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* STEP 1: Select Document Type */}
          {step === 'SELECT_DOC' && (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="text-base font-bold text-slate-100">Step 7a – Choose Document Type</h4>
                <p className="text-xs text-slate-400 mt-1">Select the official government identity document to upload</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docTypes.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedDocType(d.name);
                      setStep('UPLOAD_DOC');
                    }}
                    className={`p-4 rounded-xl border text-left transition flex items-center space-x-3 ${
                      selectedDocType === d.name
                        ? 'bg-emerald-950/40 border-emerald-500 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-3xl">{d.icon}</span>
                    <div>
                      <p className="font-bold text-xs text-slate-200">{d.name}</p>
                      <p className="text-[10px] text-slate-400">{d.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Upload Document Photo */}
          {step === 'UPLOAD_DOC' && (
            <div className="space-y-4 text-center">
              <div>
                <h4 className="text-base font-bold text-slate-100">Step 7b – Upload {selectedDocType}</h4>
                <p className="text-xs text-slate-400 mt-1">Make sure all details are clearly readable without glare</p>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-8 bg-slate-950/60 transition cursor-pointer flex flex-col items-center justify-center space-y-3">
                <UploadCloud className="w-10 h-10 text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-slate-200">Drag & Drop or Click to Upload {selectedDocType}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Supports PNG, JPG, PDF up to 10MB</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep('SELECT_DOC')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Back
                </button>
                <button
                  onClick={() => handleStartLiveness()}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg"
                >
                  Document Uploaded → Proceed to Face Liveness
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Liveness Selfie Test */}
          {step === 'LIVENESS_SELFIE' && (
            <div className="space-y-4 text-center">
              <div>
                <h4 className="text-base font-bold text-slate-100">Step 7c – Face Liveness Detection</h4>
                <p className="text-xs text-slate-400 mt-1">Center your face inside the circle frame and turn slowly</p>
              </div>

              {/* Camera Frame Simulator */}
              <div className="relative w-48 h-48 mx-auto rounded-full border-4 border-emerald-500/80 bg-slate-950 flex items-center justify-center overflow-hidden shadow-2xl shadow-emerald-950/80">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent animate-pulse" />
                <Camera className="w-12 h-12 text-emerald-400 animate-bounce" />
                <div className="absolute bottom-4 text-[10px] font-mono text-emerald-300 font-bold bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-800">
                  3D Liveness Scan {livenessProgress}%
                </div>
              </div>

              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-300"
                  style={{ width: `${livenessProgress}%` }}
                />
              </div>

              <p className="text-xs text-slate-400 animate-pulse">
                Analyzing biometric facial features & anti-spoofing indicators...
              </p>
            </div>
          )}

          {/* STEP 4: Submitting & Webhook Dispatch */}
          {step === 'SUBMITTING' && (
            <div className="py-12 text-center space-y-4">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
              <h4 className="text-base font-bold text-slate-100">Step 8 – Sumsub Processing & Webhook</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Sumsub AI Engine is evaluating document authenticity and sending webhook event POST /api/webhooks/sumsub...
              </p>
            </div>
          )}

          {/* STEP 5: Verification Result */}
          {step === 'RESULT' && (
            <div className="text-center space-y-4 py-4">
              {simulatedResult === 'GREEN' ? (
                <>
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-lg font-bold text-emerald-400">KYC Verification Approved (GREEN)!</h4>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Sumsub webhook received reviewResult: <span className="font-mono font-bold text-emerald-400">GREEN</span>.
                    Backend successfully called <span className="font-mono text-amber-400">RegistrationRegistry.sol approveKYC(wallet)</span> on BNB Smart Chain!
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-rose-500/20 text-rose-400 border border-rose-500/50 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-10 h-10" />
                  </div>
                  <h4 className="text-lg font-bold text-rose-400">KYC Review Rejected (RED)</h4>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Sumsub webhook received reviewResult: <span className="font-mono font-bold text-rose-400">RED</span>.
                    Please re-upload a clearer document photo.
                  </p>
                </>
              )}

              {/* Dev Webhook Switcher for Testing */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2">
                <span className="text-slate-400 font-mono text-[10px]">DEV SIMULATOR TESTER</span>
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => triggerSumsubWebhook('GREEN')}
                    className="px-3 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-semibold"
                  >
                    Simulate GREEN Webhook
                  </button>
                  <button
                    onClick={() => triggerSumsubWebhook('RED')}
                    className="px-3 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-xs font-semibold"
                  >
                    Simulate RED Webhook
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs shadow-lg transition"
              >
                Close Sumsub Window
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
