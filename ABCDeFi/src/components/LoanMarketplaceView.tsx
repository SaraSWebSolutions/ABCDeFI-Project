import React, { useState } from 'react';
import {
  Building2,
  Award,
  Lock,
  Coins,
  CheckCircle2,
  Clock,
  UserCheck,
  TrendingUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PortfolioSummary, Loan } from '../types';

interface LoanMarketplaceViewProps {
  portfolio: PortfolioSummary | null;
  onFundSuccess: (msg: string) => void;
  onNavigateToRepayments: () => void;
}

export const LoanMarketplaceView: React.FC<LoanMarketplaceViewProps> = ({
  portfolio,
  onFundSuccess,
  onNavigateToRepayments,
}) => {
  const [fundingLoanId, setFundingLoanId] = useState<string | null>(null);
  const [fundingStep, setFundingStep] = useState<'idle' | 'approving' | 'funding' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my_loans'>('marketplace');

  const loans = portfolio?.loans || [];
  const pendingLoans = loans.filter((l) => l.status === 'pending_funding');
  const activeLoans = loans.filter((l) => l.status === 'active');
  const completedLoans = loans.filter((l) => l.status === 'completed');

  const handleFundLoan = async (loanId: string) => {
    setErrorMsg('');
    setFundingLoanId(loanId);
    setFundingStep('approving');

    try {
      // Step 1: Simulate MetaMask token approval
      await new Promise((resolve) => setTimeout(resolve, 800));
      setFundingStep('funding');

      // Step 2: Call Express Backend API (POST /api/loans/:loanId/fund)
      const res = await fetch(`/api/loans/${loanId}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Funding failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      setFundingStep('success');
      onFundSuccess(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction failed');
      setFundingStep('idle');
      setFundingLoanId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Step 3 of ABCDeFi Flow</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Loan Marketplace</h1>
          <p className="text-sm text-slate-400">
            Peer-to-Peer lending orderbook backed by locked BNB/ETH collateral & Credit Scores.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'marketplace'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Lender View ({pendingLoans.length})
          </button>
          <button
            onClick={() => setActiveTab('my_loans')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'my_loans'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Loans ({activeLoans.length + completedLoans.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Lender View: Pending Loans to Fund */}
      {activeTab === 'marketplace' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Available Loan Requests Seeking Peer Liquidity</span>
            <span>Sorted by Credit Score & Collateral Quality</span>
          </div>

          {pendingLoans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingLoans.map((loan) => (
                <div
                  key={loan.loanId}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-6 transition-all space-y-5 shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-extrabold text-white">Loan #{loan.loanId}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        Pending
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                      <Award className="w-3.5 h-3.5" />
                      <span>Score: {loan.borrowerScore}</span>
                    </div>
                  </div>

                  {/* Metrics Box matching blueprint */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-850 text-xs">
                    <div>
                      <div className="text-slate-400">Loan Amount</div>
                      <div className="text-base font-extrabold text-amber-400">{loan.loanAmount} ABCD</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Collateral</div>
                      <div className="text-base font-extrabold text-white">
                        {loan.collateralAmount} {loan.collateralToken}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Interest Yield</div>
                      <div className="text-sm font-bold text-emerald-400">{loan.interestRate}% APR</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Duration</div>
                      <div className="text-sm font-bold text-slate-200">{loan.durationMonths} Months</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Purpose:</span>
                      <span className="text-slate-200 font-medium">{loan.purpose}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Borrower:</span>
                      <span className="font-mono text-slate-400">{loan.borrower.slice(0, 10)}...</span>
                    </div>
                  </div>

                  {/* Fund Button */}
                  <button
                    id={`fund-loan-btn-${loan.loanId}`}
                    disabled={fundingStep !== 'idle'}
                    onClick={() => handleFundLoan(loan.loanId)}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
                  >
                    {fundingLoanId === loan.loanId && fundingStep !== 'idle' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Funding via MetaMask...</span>
                      </>
                    ) : (
                      <>
                        <Coins className="w-4 h-4" />
                        <span>[ Fund Loan ]</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">All Marketplace Loans Funded!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                There are currently no pending borrowing requests. Create a new loan request in Step 2 to list it here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active & Completed Loans View */}
      {activeTab === 'my_loans' && (
        <div className="space-y-6">
          <h3 className="text-base font-bold text-white">Active & Completed Loans Overview</h3>

          {loans.filter((l) => l.status !== 'pending_funding').length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loans
                .filter((l) => l.status !== 'pending_funding')
                .map((loan) => (
                  <div
                    key={loan.loanId}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-white">Loan #{loan.loanId}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            loan.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {loan.status}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-amber-400 font-bold">${loan.loanAmount} ABCD</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-850 text-xs">
                      <div>
                        <div className="text-slate-400">EMI Paid</div>
                        <div className="font-bold text-white">
                          {loan.paidEmis} / {loan.durationMonths}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Monthly EMI</div>
                        <div className="font-bold text-amber-400">${loan.monthlyEmi} ABCD</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Collateral</div>
                        <div className="font-bold text-slate-200">
                          {loan.collateralAmount} {loan.collateralToken}
                        </div>
                      </div>
                    </div>

                    {loan.status === 'active' && (
                      <button
                        onClick={onNavigateToRepayments}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
                      >
                        Manage Monthly EMI Repayments
                      </button>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">No active or completed loans yet.</div>
          )}
        </div>
      )}

      {/* Funding Modal Simulation */}
      {fundingStep === 'success' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Loan Funded & Active!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Loan <code className="text-amber-400 font-mono font-bold">#{fundingLoanId}</code> is now active. ABCD tokens have been disbursed to the borrower.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFundingStep('idle');
                  setFundingLoanId(null);
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setFundingStep('idle');
                  setFundingLoanId(null);
                  onNavigateToRepayments();
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20"
              >
                Go to EMI Payments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
