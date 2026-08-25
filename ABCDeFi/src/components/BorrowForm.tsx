import React, { useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { useLoans } from '../hooks/useLoans';

export const BorrowForm: React.FC = () => {
  const { address, createLoan, jwtToken } = useWallet();
  const { loans, refetch } = useLoans();
  const [depositId, setDepositId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [duration, setDuration] = useState('30'); // days
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!jwtToken) return;
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/loans/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ loanAmount, collateralValue: '0', duration }),
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.data);
        setError(null);
      } else {
        setError(data.message || 'Preview failed');
        setPreview(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSubmit = async () => {
    if (!address) {
      setError('Connect wallet first');
      return;
    }
    try {
      const tx = await createLoan(depositId, loanAmount, parseInt(duration, 10));
      await tx.wait();
      setSuccess('Loan created, transaction confirmed');
      setError(null);
      await refetch();
    } catch (e: any) {
      setError(e.message || 'Loan creation failed');
    }
  };

  const maxLtv = (import.meta as any).env?.VITE_MAX_LTV || 50;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col space-y-4">
      <h3 className="text-lg font-bold text-slate-100">Create a Loan</h3>
      <div className="space-y-2">
        <label className="block text-xs text-slate-400">Deposit ID (locked collateral)</label>
        <input
          type="text"
          value={depositId}
          onChange={(e) => setDepositId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-100"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs text-slate-400">Loan Amount (USDT)</label>
        <input
          type="number"
          value={loanAmount}
          onChange={(e) => setLoanAmount(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-100"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs text-slate-400">Duration (days)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-100"
        />
      </div>
      <button
        onClick={handlePreview}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-md text-xs"
      >
        Preview Loan
      </button>

      {preview && (
        <div className="p-3 bg-slate-800 rounded-md text-xs text-slate-200">
          <p>LTV: {preview.ltv.toFixed(2)}% (max {maxLtv}%)</p>
          <p>Total Interest: {preview.totalInterest.toFixed(2)} USDT</p>
          <p>Estimated Monthly EMI: {preview.estimatedMonthlyEMI.toFixed(2)} USDT</p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-emerald-400 text-xs">{success}</p>}

      <button
        onClick={handleSubmit}
        disabled={!!error || !preview}
        className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-slate-100 rounded-md text-xs disabled:opacity-40"
      >
        Submit Loan Request
      </button>
    </div>
  );
};
