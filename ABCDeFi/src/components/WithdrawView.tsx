import React, { useState } from 'react';
import {
  ArrowUpRight,
  ShieldCheck,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { PortfolioSummary, CollateralToken } from '../types';

interface WithdrawViewProps {
  portfolio: PortfolioSummary | null;
  onWithdrawSuccess: (msg: string) => void;
}

export const WithdrawView: React.FC<WithdrawViewProps> = ({
  portfolio,
  onWithdrawSuccess,
}) => {
  const [selectedToken, setSelectedToken] = useState<'ABCD' | CollateralToken>('ABCD');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('200');
  const [destination, setDestination] = useState<string>('0x71A4...B82d');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStep, setTxStep] = useState<'idle' | 'withdrawing' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const wallet = portfolio?.wallet;
  const abcdBalance = wallet?.balances.ABCD ?? 450;

  const releasedCollateralBnb = portfolio?.availableWithdrawCollateral.BNB ?? 0;

  const activeLoans = portfolio?.loans.filter((l) => l.status === 'active') || [];
  const isLoanActive = activeLoans.length > 0;

  const maxAvailable =
    selectedToken === 'ABCD'
      ? abcdBalance
      : portfolio?.availableWithdrawCollateral[selectedToken as CollateralToken] ?? 0;

  const numAmount = parseFloat(withdrawAmount) || 0;

  const handleWithdraw = async () => {
    setErrorMsg('');
    if (!wallet?.connected) {
      setErrorMsg('Wallet not connected.');
      return;
    }

    if (numAmount <= 0) {
      setErrorMsg('Please enter a valid amount to withdraw.');
      return;
    }

    if (numAmount > maxAvailable) {
      if (selectedToken !== 'ABCD' && isLoanActive) {
        setErrorMsg(`Cannot withdraw ${selectedToken}. Collateral is currently locked in active Loan #${activeLoans[0]?.loanId}. Repay the loan first.`);
      } else {
        setErrorMsg(`Insufficient available ${selectedToken}. Available: ${maxAvailable}`);
      }
      return;
    }

    setIsSubmitting(true);
    setTxStep('withdrawing');

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          token: selectedToken,
          destination,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      setTxHash(data.withdrawal?.txHash || '0x55d1...a210');
      setTxStep('success');
      onWithdrawSuccess(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction failed');
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
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Step 5 of ABCDeFi Flow</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Withdraw Funds</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Withdraw unlocked ABCD tokens or released collateral via <code className="text-amber-400 font-mono text-xs">Treasury.sol</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Main Withdraw Card matching prompt */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-amber-400" />
              <span>Withdrawal Request</span>
            </h2>
            <span className="text-xs text-amber-400 font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              Treasury.sol
            </span>
          </div>

          {/* Token Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Select Asset to Withdraw</label>
            <div className="grid grid-cols-4 gap-2">
              {(['ABCD', 'BNB', 'ETH', 'USDT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  id={`withdraw-token-${t}`}
                  onClick={() => setSelectedToken(t)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    selectedToken === t
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs">{t}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Balances Box matching prompt */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-850 text-xs">
            <div>
              <div className="text-slate-400">Wallet Balance</div>
              <div className="text-base font-extrabold text-white">
                {selectedToken === 'ABCD' ? abcdBalance : wallet?.balances[selectedToken as CollateralToken] ?? 0} {selectedToken}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Available Unlocked</div>
              <div className="text-base font-extrabold text-emerald-400">
                {maxAvailable} {selectedToken}
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Withdraw Amount</label>
            <div className="relative">
              <input
                type="number"
                id="withdraw-amount-input"
                step="1"
                min="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="200"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setWithdrawAmount(maxAvailable.toString())}
                className="absolute right-4 top-3.5 text-xs font-bold text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg"
              >
                Max
              </button>
            </div>
          </div>

          {/* Destination Address */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Destination Address</label>
            <input
              type="text"
              id="withdraw-dest-input"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="0x71A4..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 font-mono text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            id="withdraw-submit-btn"
            disabled={isSubmitting}
            onClick={handleWithdraw}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Withdrawal...</span>
              </>
            ) : (
              <span>[ Withdraw ]</span>
            )}
          </button>
        </div>

        {/* Right Info Card */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" /> Treasury Verification
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
              <div className="font-bold text-amber-400">Check Active Loan?</div>
              <div className="text-slate-300 text-[11px] font-mono">
                {isLoanActive ? 'Active Loan Detected -> Collateral Locked' : 'No Active Loan -> All Collateral Unlocked'}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
              <div className="font-bold text-amber-400">Treasury.sol Execution</div>
              <p className="text-slate-400 text-[11px]">
                Transfers tokens directly to destination address with zero withdrawal tax.
              </p>
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
              <h3 className="text-lg font-bold text-white">Withdrawal Successful!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Transferred {withdrawAmount} {selectedToken} to <code className="text-amber-400 font-mono">{destination}</code>
              </p>
              <div className="mt-3 p-2 bg-slate-950 rounded-xl font-mono text-[11px] text-amber-400">
                Tx: {txHash}
              </div>
            </div>

            <button
              onClick={() => setTxStep('idle')}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
