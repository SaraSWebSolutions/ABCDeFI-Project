import React, { useState } from 'react';
import { ShieldCheck, UploadCloud, Camera, CheckCircle2, ArrowRight, Info, FileCheck } from 'lucide-react';

export const MockSumsubHostedPage: React.FC = () => {
  const [docType, setDocType] = useState<'International Public Security'>('International Public Security');
  const [uploaded, setUploaded] = useState<boolean>(false);
  const [selfieTaken, setSelfieTaken] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const urlParams = new URLSearchParams(window.location.search);
  const applicantId = urlParams.get('applicantId') || 'APP_70997970';
  const walletAddress = urlParams.get('wallet') || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  const handleUpload = () => {
    setUploaded(true);
  };

  const handleSelfie = () => {
    setSelfieTaken(true);
  };

  const handleSubmitAndRedirect = async (result: 'GREEN' | 'RED') => {
    setSubmitted(true);

    // Call Backend Webhook Simulation POST /api/webhooks/sumsub
    try {
      await fetch('http://localhost:5000/api/webhooks/sumsub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantId,
          reviewStatus: 'completed',
          reviewResult: result,
          walletAddress,
          rejectReason: result === 'RED' ? 'Document Forgery or Face Mismatch Detected' : undefined,
        }),
      });
    } catch (e) {
      console.error('Error posting to backend webhook', e);
    }

    // Set local storage status
    const status = result === 'GREEN' ? 'approved' : 'rejected';
    localStorage.setItem(`kyc_${walletAddress}`, status);

    // Redirect user back to ABCDeFi Dashboard with ?kyc=approved or ?kyc=rejected
    setTimeout(() => {
      window.location.href = `${window.location.protocol}//${window.location.host}?kyc=${status}`;
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-mono">
      {/* Sumsub Header Bar */}
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Sumsub Identity Portal</h1>
              <p className="text-xs text-slate-400">https://api.sumsub.com/verify/abcdefi/{applicantId}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold">
            SSL Secured
          </span>
        </div>

        {!submitted ? (
          <div className="space-y-6">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                1. Select Document Type
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['International Public Security'] as const).map((doc) => (
                  <button
                    key={doc}
                    onClick={() => {
                      setDocType(doc);
                      setUploaded(false);
                    }}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      docType === doc
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {doc}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Upload Area */}
            {!uploaded ? (
              <div
                onClick={handleUpload}
                className="border-2 border-dashed border-indigo-500/40 bg-indigo-950/20 hover:bg-indigo-950/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition text-center group"
              >
                <UploadCloud className="w-12 h-12 text-indigo-400 group-hover:scale-110 transition mb-3" />
                <span className="font-bold text-indigo-300 text-xs">Click to upload {docType} Photo</span>
                <span className="text-[10px] text-slate-500 mt-1">Clear front & back scan • JPEG, PNG, or PDF</span>
              </div>
            ) : (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-6 h-6 text-emerald-400" />
                  <div>
                    <div className="font-bold text-emerald-300">{docType} Uploaded & Validated</div>
                    <div className="text-[10px] text-slate-400">OCR Readability: 100% Clear</div>
                  </div>
                </div>
                <button onClick={() => setUploaded(false)} className="text-[10px] text-slate-400 hover:text-white underline">
                  Replace
                </button>
              </div>
            )}

            {/* Liveness Check Section */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-center">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left">
                2. Liveness & Face Match
              </div>
              <div className="w-32 h-32 rounded-full border-4 border-indigo-500/50 bg-slate-900 flex flex-col items-center justify-center mx-auto overflow-hidden">
                {!selfieTaken ? (
                  <Camera className="w-10 h-10 text-indigo-400 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                )}
              </div>
              {!selfieTaken ? (
                <button
                  onClick={handleSelfie}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Capture Liveness Selfie
                </button>
              ) : (
                <div className="text-xs text-emerald-400 font-bold">Liveness Verified ✓</div>
              )}
            </div>

            {/* Final Submit & Redirect Options */}
            <div className="space-y-2 pt-2">
              <button
                disabled={!uploaded || !selfieTaken}
                onClick={() => handleSubmitAndRedirect('GREEN')}
                className={`w-full py-3.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                  uploaded && selfieTaken
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>✅ Accept & Proceed (GREEN Result)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                disabled={!uploaded || !selfieTaken}
                onClick={() => handleSubmitAndRedirect('RED')}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                  uploaded && selfieTaken
                    ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300'
                    : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                }`}
              >
                <span>❌ Reject Verification (RED Result)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/50">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>
            <h2 className="text-xl font-bold text-white">Verification Completed!</h2>
            <p className="text-xs text-emerald-400 font-bold">
              Sumsub has sent Webhook GREEN payload to ABCDeFi backend. Redirecting...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockSumsubHostedPage;
