// src/Components/LoanForm.tsx
import React, { useState } from 'react';
import CollateralSelector from './CollateralSelector';
import LoanSummary from './LoanSummary';

export interface LoanFormData {
  principal: number;
  interestRate: number;
  duration: number;
  purpose: string;
  collateral: { asset: string; amount: string };
}

interface LoanFormProps {
  onSubmit: (data: LoanFormData) => void;
  onCancel: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ onSubmit, onCancel }) => {
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [duration, setDuration] = useState('');
  const [purpose, setPurpose] = useState('');
  const [collateral, setCollateral] = useState<{ asset: string; amount: string }>({ asset: 'ETH', amount: '' });
  const [step, setStep] = useState<'details' | 'preview'>('details');

  const handleNext = () => setStep('preview');
  const handleBack = () => setStep('details');

  const handleConfirm = () => {
    const payload = {
      principal: Number(principal),
      interestRate: Number(interestRate),
      duration: Number(duration),
      purpose,
      collateral,
    };
    onSubmit(payload);
  };

  return (
    <div className="p-4">
      {step === 'details' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Loan Details</h2>
          <input
            type="number"
            placeholder="Principal Amount"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Interest Rate (bps)"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Duration (months)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <CollateralSelector onSelect={setCollateral} />
          <div className="flex space-x-2">
            <button onClick={handleNext} className="px-4 py-2 bg-indigo-600 text-white rounded">
              Review
            </button>
            <button onClick={onCancel} className="px-4 py-2 bg-gray-300 text-gray-800 rounded">
              Cancel
            </button>
          </div>
        </div>
      )}
      {step === 'preview' && (
        <div className="space-y-4">
          <LoanSummary data={{ principal, interestRate, duration, purpose, collateral }} />
          <div className="flex space-x-2">
            <button onClick={handleConfirm} className="px-4 py-2 bg-green-600 text-white rounded">
              Confirm
            </button>
            <button onClick={handleBack} className="px-4 py-2 bg-gray-300 text-gray-800 rounded">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanForm;
