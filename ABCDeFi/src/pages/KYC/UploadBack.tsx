import React, { useState } from 'react';
import { UploadCloud, FileCheck, ArrowRight } from 'lucide-react';

interface UploadBackProps {
  docType: string;
  onContinue: () => void;
}

export const UploadBack: React.FC<UploadBackProps> = ({ docType, onContinue }) => {
  const [uploaded, setUploaded] = useState<boolean>(false);

  return (
    <div className="space-y-6 text-slate-100 font-mono">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Step 4: Upload Back Side</h2>
        <p className="text-xs text-slate-400">Upload a clear scan of the back of your {docType}.</p>
      </div>

      {!uploaded ? (
        <div
          onClick={() => setUploaded(true)}
          className="border-2 border-dashed border-indigo-500/40 bg-indigo-950/20 hover:bg-indigo-950/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition text-center group"
        >
          <UploadCloud className="w-12 h-12 text-indigo-400 group-hover:scale-110 transition mb-3" />
          <span className="font-bold text-indigo-300 text-xs">Choose File to Upload {docType} (Back)</span>
          <span className="text-[10px] text-slate-500 mt-2">Supported: JPG, PNG, PDF • Max Size: 10 MB</span>
        </div>
      ) : (
        <div className="bg-emerald-950/60 border border-emerald-500/40 p-5 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <FileCheck className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="font-bold text-emerald-300">{docType} (Back) Uploaded</div>
              <div className="text-[10px] text-slate-400">Barcode & Address Readability: 100% Clear</div>
            </div>
          </div>
          <button onClick={() => setUploaded(false)} className="text-[10px] text-slate-400 hover:text-white underline">
            Replace
          </button>
        </div>
      )}

      <button
        disabled={!uploaded}
        onClick={onContinue}
        className={`w-full py-3.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
          uploaded ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        <span>Continue to Selfie Check →</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UploadBack;
