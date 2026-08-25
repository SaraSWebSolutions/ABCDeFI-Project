import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  TrendingUp,
  Clock,
  Loader2,
  Building2,
  FileText,
} from 'lucide-react';
import { PortfolioSummary } from '../types';

interface BorrowLoanViewProps {
  portfolio: PortfolioSummary | null;
  onLoanCreatedSuccess: (msg: string) => void;
  onNavigateToMarketplace: () => void;
  onApproveKyc: () => void;
  onNavigateToDeposit: () => void;
}

export const BorrowLoanView: React.FC<BorrowLoanViewProps> = ({
  portfolio,
  onLoanCreatedSuccess,
  onNavigateToMarketplace,
  onApproveKyc,
  onNavigateToDeposit,
}) => {
  const wallet = portfolio?.wallet;
  const isWalletConnected = wallet?.connected ?? false;
  const isKycApproved = wallet?.kycStatus === 'approved';
  const hasLockedCollateral = (portfolio?.depositedCollateralUsd ?? 0) > 0;

  const isEnabled = isWalletConnected && isKycApproved && hasLockedCollateral;

  // Form State matching prompt
  const [loanAmount, setLoanAmount] = useState<string>('400');
  const [duration, setDuration] = useState<number>(12);
  const [interestRate, setInterestRate] = useState<number>(11);
  const [purpose, setPurpose] = useState<string>('Business Expansion');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStep, setTxStep] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [createdLoanId, setCreatedLoanId] = useState<string>('');

  const collateralUsd = portfolio?.depositedCollateralUsd ?? 1020;
  const collateralBnb = portfolio?.depositedCollateralBnb ?? 1.5;
  const maxBorrow = portfolio?.maxBorrowCapacityUsd ?? 510;

  const requestedAmountNum = parseFloat(loanAmount) || 0;

  // Monthly EMI Calculation
  const monthlyRate = interestRate / 100 / 12;
  const estimatedEmi =
    requestedAmountNum > 0
      ? Math.round(
          (requestedAmountNum * monthlyRate * Math.pow(1 + monthlyRate, duration)) /
            (Math.pow(1 + monthlyRate, duration) - 1)
        )
      : 0;

  const handleCreateLoan = async () => {
    setErrorMsg('');
    if (!isEnabled) {
      setErrorMsg('Pre-conditions not met. Ensure Wallet is connected, KYC approved, and Collateral is locked.');
      return;
    }

    if (requestedAmountNum <= 0) {
      setErrorMsg('Please enter a valid loan amount.');
      return;
    }

    if (requestedAmountNum > maxBorrow) {
      setErrorMsg(`Loan amount ($${requestedAmountNum}) exceeds Maximum Borrow capacity ($${maxBorrow}) based on 50% LTV.`);
      return;
    }

    setIsSubmitting(true);
    setTxStep('submitting');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanAmount: requestedAmountNum,
          duration,
          interest: interestRate,
          purpose,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create loan');
      }

      setCreatedLoanId(data.loan?.loanId || 'LOAN-108');
      setTxStep('success');
      onLoanCreatedSuccess(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction error');
      setTxStep('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Step 2 of ABCDeFi Flow</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Borrowing Loan</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Create a loan request published to the <code className="text-amber-400 font-mono text-xs">LoanMarketplace.sol</code>{' '}
          contract for peer liquidity providers to fund.
        </p>
      </div>

      {/* Pre-conditions Check Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Pre-Conditions Required Before Borrowing:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* 1. Wallet Connected */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isWalletConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {isWalletConnected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span className="font-semibold">Wallet Connected</span>
            </div>
            {!isWalletConnected && <span className="text-[10px] font-mono">0x...</span>}
          </div>

          {/* 2. KYC Approved */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isKycApproved
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {isKycApproved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              )}
              <span className="font-semibold">KYC Approved</span>
            </div>
            {!isKycApproved && (
              <button
                onClick={onApproveKyc}
                className="px-2 py-0.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded hover:bg-amber-400"
              >
                Approve
              </button>
            )}
          </div>

          {/* 3. Collateral Locked */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              hasLockedCollateral
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {hasLockedCollateral ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <span className="font-semibold">Collateral Locked</span>
            </div>
            {!hasLockedCollateral && (
              <button
                onClick={onNavigateToDeposit}
                className="px-2 py-0.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded hover:bg-amber-400"
              >
                Deposit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Loan Creation Form matching exact user prompt UI */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <span>Create Loan Request</span>
            </h2>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              50% LTV Enforced
            </span>
          </div>

          {/* Collateral & Values Row */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-850 text-xs">
            <div>
              <div className="text-slate-400 mb-0.5">Collateral</div>
              <div className="font-bold text-white">{collateralBnb} BNB</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Collateral Value</div>
              <div className="font-bold text-white">${collateralUsd.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Maximum Borrow</div>
              <div className="font-bold text-amber-400">${maxBorrow.toLocaleString()}</div>
            </div>
          </div>

          {/* Loan Amount Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Loan Amount (in ABCD)</label>
            <div className="relative">
              <input
                type="number"
                id="borrow-amount-input"
                step="10"
                min="1"
                max={maxBorrow}
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                disabled={!isEnabled}
                placeholder="400"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-40 transition-colors"
              />
              <div className="absolute right-4 top-3.5 text-xs font-bold text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg">
                ABCD
              </div>
            </div>
          </div>

          {/* Duration & Interest Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Duration</label>
              <select
                id="loan-duration-select"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={!isEnabled}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-40"
              >
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Interest (APR)</label>
              <input
                type="text"
                readOnly
                value={`${interestRate}%`}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs font-bold text-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Purpose Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Purpose</label>
            <input
              type="text"
              id="loan-purpose-input"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={!isEnabled}
              placeholder="e.g. Business Expansion, DeFi Liquidity"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-semibold text-white focus:outline-none focus:border-amber-500 disabled:opacity-40"
            />
          </div>

          {/* Repayment Forecast Box */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Estimated Monthly EMI</span>
              <span className="font-extrabold text-amber-400 text-sm">${estimatedEmi} ABCD/mo</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Total Repayment over {duration} Mos</span>
              <span className="font-bold text-slate-200">${(estimatedEmi * duration).toLocaleString()} ABCD</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="create-loan-btn"
            disabled={!isEnabled || isSubmitting}
            onClick={handleCreateLoan}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing to Marketplace...</span>
              </>
            ) : (
              <span>[ Create Loan ]</span>
            )}
          </button>
        </div>

        {/* Right Info Box */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" /> Backend Loan Lifecycle
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850">
                <div className="font-bold text-amber-400 mb-0.5">1. LTV & KYC Validation</div>
                <p className="text-slate-400 text-[11px]">Backend checks KYC approval, wallet balance, and 50% LTV threshold.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850">
                <div className="font-bold text-amber-400 mb-0.5">2. LoanMarketplace.sol -&gt; createLoan()</div>
                <p className="text-slate-400 text-[11px]">
                  Calls smart contract with <code className="text-slate-300">(amount, duration, interest)</code>.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850">
                <div className="font-bold text-amber-400 mb-0.5">3. Marketplace Listing</div>
                <p className="text-slate-400 text-[11px]">
                  Loan enters <span className="text-amber-300 font-mono">Pending</span> state awaiting peer lenders to fund.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {txStep === 'success' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Loan Request Published!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Loan ID <code className="text-amber-400 font-mono font-bold">{createdLoanId}</code> is now listed on the Loan Marketplace.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setTxStep('idle')}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setTxStep('idle');
                  onNavigateToMarketplace();
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20"
              >
                View in Marketplace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
