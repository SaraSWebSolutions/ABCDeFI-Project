import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Award,
  Sparkles,
  Lock,
  Loader2,
  AlertCircle,
  Coins,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { PortfolioSummary, Loan } from '../types';

interface EmiRepaymentViewProps {
  portfolio: PortfolioSummary | null;
  onEmiPaidSuccess: (msg: string) => void;
  onNavigateToWithdraw: () => void;
}

export const EmiRepaymentView: React.FC<EmiRepaymentViewProps> = ({
  portfolio,
  onEmiPaidSuccess,
  onNavigateToWithdraw,
}) => {
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullPayoff, setFullPayoff] = useState(false);
  const [txStep, setTxStep] = useState<'idle' | 'paying' | 'completed_celebration'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [completionData, setCompletionData] = useState<any>(null);

  const activeLoans = portfolio?.loans.filter((l) => l.status === 'active') || [];
  const completedLoans = portfolio?.loans.filter((l) => l.status === 'completed') || [];

  const currentLoan = activeLoans.find((l) => l.loanId === selectedLoanId) || activeLoans[0];

  const handlePayEmi = async (loan: Loan, isFull: boolean) => {
    setErrorMsg('');
    setIsSubmitting(true);
    setTxStep('paying');

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const res = await fetch(`/api/loans/${loan.loanId}/pay-emi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullPayoff: isFull }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'EMI payment failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (data.loanCompleted) {
        setCompletionData(data);
        setTxStep('completed_celebration');
      } else {
        setTxStep('idle');
      }

      onEmiPaidSuccess(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment failed');
      setTxStep('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5" />
          <span>Step 4 of ABCDeFi Flow</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Monthly EMI & Loan Completion</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Process installments via <code className="text-amber-400 font-mono text-xs">EMIManager.sol</code>. Completing all EMIs releases locked collateral & mints a Credit NFT.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Active Loan Installment Cards */}
      {activeLoans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Active Loan #{currentLoan.loanId}</h2>
                <p className="text-xs text-slate-400">Borrower: {currentLoan.borrower}</p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold">
                Active Loan
              </span>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-850 text-xs">
              <div>
                <div className="text-slate-400">Loan Amount</div>
                <div className="text-lg font-bold text-white">{currentLoan.loanAmount} ABCD</div>
              </div>
              <div>
                <div className="text-slate-400">Monthly EMI</div>
                <div className="text-lg font-bold text-amber-400">${currentLoan.monthlyEmi} ABCD</div>
              </div>
              <div>
                <div className="text-slate-400">Paid Progress</div>
                <div className="text-lg font-bold text-emerald-400">
                  {currentLoan.paidEmis} / {currentLoan.durationMonths} Mos
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Repayment Completion</span>
                <span className="font-bold text-amber-400">
                  {Math.round((currentLoan.paidEmis / currentLoan.durationMonths) * 100)}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.max(5, (currentLoan.paidEmis / currentLoan.durationMonths) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Actions: Pay Monthly EMI or Payoff Loan */}
            <div className="pt-2 space-y-3">
              <button
                id={`pay-single-emi-btn-${currentLoan.loanId}`}
                disabled={isSubmitting}
                onClick={() => handlePayEmi(currentLoan, false)}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing EMI Payment...</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    <span>[ Pay Monthly EMI: {currentLoan.monthlyEmi} ABCD ]</span>
                  </>
                )}
              </button>

              <button
                id={`payoff-full-loan-btn-${currentLoan.loanId}`}
                disabled={isSubmitting}
                onClick={() => handlePayEmi(currentLoan, true)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 font-bold text-xs rounded-2xl border border-amber-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  Pay Full Loan & Release Collateral (
                  {Math.round(currentLoan.monthlyEmi * (currentLoan.durationMonths - currentLoan.paidEmis))} ABCD)
                </span>
              </button>
            </div>
          </div>

          {/* Right Protocol Release Rules */}
          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> After Final EMI Completion
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                <div className="font-bold text-amber-400">1. CollateralVault.sol -&gt; releaseCollateral()</div>
                <p className="text-slate-400 text-[11px]">
                  Unlocks {currentLoan.collateralAmount} {currentLoan.collateralToken} back into available withdrawal balance.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                <div className="font-bold text-amber-400">2. LoanNFT.sol -&gt; mintNFT()</div>
                <p className="text-slate-400 text-[11px]">
                  Mints a soulbound Credit Reputation Badge NFT directly into borrower wallet.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                <div className="font-bold text-emerald-400">3. Credit Score Boost (+25 pts)</div>
                <p className="text-slate-400 text-[11px]">
                  Increases overall protocol borrowing score to lower future interest rates.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No Active Loan Debt</h3>
            <p className="text-xs text-slate-400 mt-1">All loans are fully repaid or no loans have been created yet.</p>
          </div>
        </div>
      )}

      {/* Minted Credit NFTs Gallery */}
      {portfolio?.nfts && portfolio.nfts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" /> Minted Credit Reputation NFTs ({portfolio.nfts.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {portfolio.nfts.map((nft) => (
              <div
                key={nft.id}
                className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400">{nft.id}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                    {nft.tier} Tier
                  </span>
                </div>

                <div>
                  <div className="text-sm font-bold text-white">{nft.badgeTitle}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Loan #{nft.loanId} Repaid</div>
                </div>

                <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[11px]">
                  <span className="text-emerald-400 font-semibold">+{nft.creditScoreBoost} Credit Score</span>
                  <span className="font-mono text-slate-500">{nft.mintTxHash.slice(0, 10)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Celebration Modal */}
      {txStep === 'completed_celebration' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center mx-auto text-slate-950 shadow-xl shadow-amber-500/30">
              <Sparkles className="w-10 h-10 animate-spin" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Loan 100% Completed!</h3>
              <p className="text-xs text-amber-300/90 mt-1 font-medium">
                Collateral Released • Credit NFT Minted • Credit Score +25
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Collateral Released:</span>
                <span className="font-bold text-emerald-400">1.5 BNB (Vault Unlocked)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">NFT Badge Minted:</span>
                <span className="font-mono text-amber-400">LoanNFT.sol</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">New Credit Score:</span>
                <span className="font-bold text-emerald-400">837 (+25 pts)</span>
              </div>
            </div>

            <button
              onClick={() => {
                setTxStep('idle');
                onNavigateToWithdraw();
              }}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
            >
              <span>Proceed to Withdraw Released Funds</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
