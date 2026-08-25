import React, { useState } from 'react';
import Landing from './Landing';
import SelectDocument, { DemographicData } from './SelectDocument';
import UploadFront from './UploadFront';
import UploadBack from './UploadBack';
import Selfie from './Selfie';
import Liveness from './Liveness';
import Processing from './Processing';
import Success from './Success';
import { submitManualKYC, saveKYCRecord, getKYCRecord } from '../../Services/kycService';

export const KycDemoEngine: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [docType, setDocType] = useState<'National ID' | 'Passport' | 'Aadhaar' | 'Workplace ID'>('National ID');
  const [demographics, setDemographics] = useState<DemographicData>({
    fullName: 'Dinesh Rivers',
    gender: 'Male',
    dateOfBirth: '2002-05-14',
    nationality: 'India',
    address: 'Hyderabad, Telangana, India',
    isLowIncomeEconomy: true,
    isFinancialProfessional: false,
    workplaceIdCardUploaded: false,
  });

  const urlParams = new URLSearchParams(window.location.search);
  const applicantId = urlParams.get('applicantId') || 'APP_70997970';
  const walletAddress = urlParams.get('wallet') || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  const handleDocumentSelected = (selectedDoc: 'National ID' | 'Passport' | 'Aadhaar' | 'Workplace ID', demoData: DemographicData) => {
    setDocType(selectedDoc);
    setDemographics(demoData);
    setStep(3);
  };

  const handleReturnToApp = async () => {
    // 1. Update KYC Record with Demographics & Whitepaper Verification
    try {
      const record = await getKYCRecord(walletAddress);
      record.status = 'approved';
      record.fullName = demographics.fullName;
      record.country = demographics.nationality;
      record.documentType = docType;
      record.verifiedAt = new Date().toISOString().substring(0, 10);
      record.verificationLevel = 'Identity + Liveness + Whitepaper Demographics';
      record.history.unshift({
        date: record.verifiedAt,
        event: 'Sumsub Verification Approved ✓',
        status: 'Approved',
        note: `Identity verified. Age/DOB (${demographics.dateOfBirth}), Gender (${demographics.gender}), and Address confirmed. ICO Bonuses & Platform Features unlocked.`,
      });
      await saveKYCRecord(record);
    } catch (e) {
      console.error('Error saving KYC record', e);
    }

    // 2. Call Webhook Simulation
    try {
      await fetch('http://localhost:5000/api/webhooks/sumsub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantId,
          reviewStatus: 'completed',
          reviewResult: 'GREEN',
          walletAddress,
          demographics,
        }),
      });
    } catch (e) {
      console.error('Error posting webhook', e);
    }

    localStorage.setItem(`kyc_${walletAddress}`, 'approved');
    window.location.href = `${window.location.protocol}//${window.location.host}?kyc=approved`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Progress Bar Header */}
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-3">
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span>🛡️</span> ABCDeFi Sumsub Compliance Portal
          </span>
          <span className="text-slate-400 font-mono">Step {step} of 8</span>
        </div>

        {step === 1 && <Landing onStart={() => setStep(2)} />}
        {step === 2 && <SelectDocument onSelect={handleDocumentSelected} />}
        {step === 3 && <UploadFront docType={docType} onContinue={() => setStep(4)} />}
        {step === 4 && <UploadBack docType={docType} onContinue={() => setStep(5)} />}
        {step === 5 && <Selfie onContinue={() => setStep(6)} />}
        {step === 6 && <Liveness onContinue={() => setStep(7)} />}
        {step === 7 && <Processing onComplete={() => setStep(8)} />}
        {step === 8 && (
          <Success
            applicantId={applicantId}
            walletAddress={walletAddress}
            onReturn={handleReturnToApp}
          />
        )}
      </div>
    </div>
  );
};

export default KycDemoEngine;
