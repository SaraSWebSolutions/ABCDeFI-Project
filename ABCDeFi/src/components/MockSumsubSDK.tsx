import React, { useState, useEffect } from 'react';
import { ShieldCheck, UploadCloud, Camera, CheckCircle2, Loader2, Info, FileCheck, ArrowRight } from 'lucide-react';

interface MockSumsubSDKProps {
  sdkToken: string;
  onComplete: () => void;
}

export default function MockSumsubSDK({ sdkToken, onComplete }: MockSumsubSDKProps) {
  const [step, setStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDoc, setSelectedDoc] = useState<'International Public Security'>('International Public Security');
  const [docUploaded, setDocUploaded] = useState<boolean>(false);
  const [selfieTaken, setSelfieTaken] = useState<boolean>(false);

  // Simulate SDK Loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [sdkToken]);

  const handleDocUpload = () => {
    setLoading(true);
    setTimeout(() => {
      setDocUploaded(true);
      setLoading(false);
    }, 1000);
  };

  const handleSelfieCapture = () => {
    setLoading(true);
    setTimeout(() => {
      setSelfieTaken(true);
      setLoading(false);
    }, 1200);
  };

  const handleNextStep = () => {
    if (step === 0 && docUploaded) {
      setStep(1);
    } else if (step === 1 && selfieTaken) {
      setStep(2);
    } else if (step === 2) {
      onComplete();
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center min-h-[420px] font-mono">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
        <div className="text-white font-bold text-lg">Sumsub Web SDK Loading...</div>
        <div className="text-indigo-300 text-xs mt-1">Initializing secure SSL verification pipeline...</div>
        <div className="mt-4 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-500">
          Token: {sdkToken.substring(0, 18)}...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden font-mono text-slate-100">
      {/* Sumsub Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white text-sm">Identity & Document Verification</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          Powered by Sumsub AI
        </span>
      </div>

      {/* Progress Bar */}
      <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900/60 border-b border-slate-800 text-[10px] text-center font-bold">
        <div className={`py-1 rounded ${step >= 0 ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>1. Document</div>
        <div className={`py-1 rounded ${step >= 1 ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>2. Liveness Selfie</div>
        <div className={`py-1 rounded ${step >= 2 ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>3. Review Result</div>
      </div>

      {/* Body */}
      <div className="p-6">
        {step === 0 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-1">Select Identity Document</h3>
              <p className="text-slate-400 text-xs">Choose document type and upload a clear front/back photo.</p>
            </div>

            {/* Document Selector */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['International Public Security'] as const).map((doc) => (
                <button
                  key={doc}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setDocUploaded(false);
                  }}
                  className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                    selectedDoc === doc
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {doc}
                </button>
              ))}
            </div>

            {!docUploaded ? (
              <div
                onClick={handleDocUpload}
                className="border-2 border-dashed border-indigo-500/40 bg-indigo-950/20 hover:bg-indigo-950/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition text-center group"
              >
                <UploadCloud className="w-12 h-12 text-indigo-400 group-hover:scale-110 transition mb-3" />
                <span className="font-bold text-indigo-300 text-xs">Click to upload {selectedDoc} Card</span>
                <span className="text-[10px] text-slate-500 mt-1">JPEG, PNG, or PDF (Max 10MB) • High Resolution</span>
              </div>
            ) : (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-6 h-6 text-emerald-400" />
                  <div>
                    <div className="font-bold text-emerald-300">{selectedDoc} Uploaded & Validated</div>
                    <div className="text-[10px] text-slate-400">OCR Scanned: Front & Back Clear</div>
                  </div>
                </div>
                <button onClick={() => setDocUploaded(false)} className="text-[10px] text-slate-400 hover:text-white underline">
                  Change
                </button>
              </div>
            )}

            <button
              disabled={!docUploaded}
              onClick={handleNextStep}
              className={`w-full py-3 rounded-xl font-bold transition cursor-pointer text-xs flex items-center justify-center gap-2 ${
                docUploaded
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Continue to Liveness Check</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-1">Liveness Check & Biometrics</h3>
              <p className="text-slate-400 text-xs">Center your face in the oval frame to verify identity.</p>
            </div>

            <div className="w-48 h-48 rounded-full border-4 border-indigo-500/50 bg-slate-900 flex flex-col items-center justify-center mx-auto overflow-hidden relative shadow-xl">
              {!selfieTaken ? (
                <>
                  <Camera className="w-12 h-12 text-indigo-400 animate-pulse mb-2" />
                  <div className="text-[10px] text-slate-400">Fit face inside oval</div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                  <div className="text-xs text-emerald-300 font-bold">Selfie Captured</div>
                </div>
              )}
            </div>

            {!selfieTaken ? (
              <button
                onClick={handleSelfieCapture}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Take Selfie & Check Liveness
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <span>Submit to Sumsub AI Engine</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 text-center py-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/50">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Documents Under Review</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Sumsub AI screening is processing OCR, Liveness, and Fraud Detection. Webhook will dispatch automatically.
              </p>
            </div>

            <button
              onClick={handleNextStep}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/30"
            >
              Close WebSDK & Trigger Webhook
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
