import React, { useState } from 'react';
import {
  Lock,
  ChevronDown,
  Info,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { PortfolioSummary, CollateralToken, TOKEN_PRICES } from '../types';

interface DepositCollateralViewProps {
  portfolio: PortfolioSummary | null;
  onDepositSuccess: (msg: string) => void;
  onNavigateToBorrow: () => void;
}

export const DepositCollateralView: React.FC<DepositCollateralViewProps> = ({
  portfolio,
  onDepositSuccess,
  onNavigateToBorrow,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<CollateralToken>('BNB');
  const [depositAmount, setDepositAmount] = useState<string>('1.50');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStep, setTxStep] = useState<'idle' | 'approving' | 'calling_contract' | 'success'>('idle');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const wallet = portfolio?.wallet;
  const currentBalance = wallet?.balances[selectedAsset] ?? 2.85;

  const numAmount = parseFloat(depositAmount) || 0;
  const estimatedValue = numAmount * TOKEN_PRICES[selectedAsset];
  const maxBorrowValue = estimatedValue * 0.5; // 50% LTV

  const handleDeposit = async () => {
    setErrorMsg('');
    if (!wallet?.connected) {
      setErrorMsg('Please connect your MetaMask wallet first.');
      return;
    }

    if (numAmount <= 0) {
      setErrorMsg('Please enter a valid deposit amount greater than 0.');
      return;
    }

    if (numAmount > currentBalance) {
      setErrorMsg(`Insufficient ${selectedAsset} balance in wallet. Available: ${currentBalance}`);
      return;
    }

    setIsSubmitting(true);
    setTxStep('approving');

    try {
      // Step 1: Simulate MetaMask Approval
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTxStep('calling_contract');

      // Step 2: Call Express Backend API (POST /api/deposit)
      const res = await fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: selectedAsset,
          amount: numAmount,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Deposit failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setTxHash(data.deposit?.txHash || '0x8f3a...d91c');
      setTxStep('success');
      onDepositSuccess(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction rejected');
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
          <Lock className="w-3.5 h-3.5" />
          <span>Step 1 of ABCDeFi Flow</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Deposit Collateral</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          In ABCDeFi, assets are locked in <code className="text-amber-400 font-mono text-xs">CollateralVault.sol</code>{' '}
          to enable credit loans up to 50% LTV.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Form Box Matching Exact UI Blueprint */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <span>Deposit Collateral</span>
            </h2>
            <span className="text-xs text-amber-400 font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              Max LTV: 50%
            </span>
          </div>

          {/* Collateral Asset Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Collateral Asset</label>
            <div className="grid grid-cols-3 gap-2">
              {(['BNB', 'ETH', 'USDT'] as CollateralToken[]).map((asset) => (
                <button
                  key={asset}
                  type="button"
                  id={`select-asset-${asset}`}
                  onClick={() => setSelectedAsset(asset)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedAsset === asset
                      ? 'bg-amber-500/10 border-amber-500 text-white font-bold shadow-md shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs text-slate-400">Token</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">{asset}</div>
                  <div className="text-[10px] text-amber-400">${TOKEN_PRICES[asset]}/ea</div>
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Balance Display */}
          <div className="flex justify-between items-center text-xs bg-slate-950 p-3 rounded-xl border border-slate-850">
            <span className="text-slate-400">Wallet Balance</span>
            <div className="font-mono font-bold text-amber-400">
              {currentBalance} {selectedAsset}
              <button
                type="button"
                onClick={() => setDepositAmount(currentBalance.toString())}
                className="ml-2 px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-sans"
              >
                Max
              </button>
            </div>
          </div>

          {/* Deposit Amount Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Deposit Amount</label>
            <div className="relative">
              <input
                type="number"
                id="deposit-amount-input"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
              <div className="absolute right-4 top-3.5 text-xs font-bold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg">
                {selectedAsset}
              </div>
            </div>
          </div>

          {/* Calculation Box */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Estimated Value</span>
              <span className="font-bold text-white text-sm">${estimatedValue.toLocaleString()} USD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Current Max Loan Capacity (50% LTV)</span>
              <span className="font-bold text-amber-400">${maxBorrowValue.toLocaleString()} ABCD</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-850 text-slate-400">
              <span>Target Smart Contract</span>
              <span className="font-mono text-slate-300">CollateralVault.sol</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            id="deposit-lock-btn"
            disabled={isSubmitting}
            onClick={handleDeposit}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Web3 Tx...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>[ Deposit & Lock ]</span>
              </>
            )}
          </button>
        </div>

        {/* Right Flow Explanation & Contract Visualizer */}
        <div className="md:col-span-5 space-y-6">
          {/* Active Deposit Lock Summary */}
          {portfolio?.deposits && portfolio.deposits.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Locked Collateral Vaults
              </h3>
              <div className="space-y-2">
                {portfolio.deposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {dep.amount} {dep.token}
                      </div>
                      <div className="text-[10px] text-slate-400">${dep.usdValue.toLocaleString()} USD</div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">
                        {dep.status}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{dep.txHash.slice(0, 10)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Whitepaper Protocol Flow Map */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Collateral Architecture Flow</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                <div className="font-semibold text-amber-400">1. User Connects Wallet & Selects Asset</div>
                <p className="text-slate-400 text-[11px]">Validates BNB/ETH balance on chain.</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                <div className="font-semibold text-amber-400">2. lockCollateral() Contract Call</div>
                <p className="text-slate-400 text-[11px]">
                  Executes on <code className="text-slate-300">CollateralVault.sol</code>.
                </p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                <div className="font-semibold text-amber-400">3. On-Chain Event & Borrowing Enabled</div>
                <p className="text-slate-400 text-[11px]">
                  Emits <code className="text-slate-300">CollateralLocked</code> event and unlocks loan creation up to 50% LTV.
                </p>
              </div>
            </div>

            {portfolio?.deposits.some((d) => d.status === 'locked') && (
              <button
                onClick={onNavigateToBorrow}
                className="w-full py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <span>Proceed to Step 2: Borrow Loan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Modal Simulation */}
      {txStep !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
            {txStep === 'approving' && (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirming in MetaMask</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Approving {numAmount} {selectedAsset} transfer to CollateralVault...
                  </p>
                </div>
              </>
            )}

            {txStep === 'calling_contract' && (
              <>
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                  <Lock className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Executing Smart Contract</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Calling <code className="text-amber-400">CollateralVault.sol -&gt; lockCollateral()</code>
                  </p>
                </div>
              </>
            )}

            {txStep === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Collateral Locked Successfully!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {numAmount} {selectedAsset} ($${estimatedValue.toLocaleString()}) secured in CollateralVault.
                  </p>
                  <div className="mt-3 p-2 bg-slate-950 rounded-xl font-mono text-[11px] text-amber-400">
                    Tx: {txHash}
                  </div>
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
                      onNavigateToBorrow();
                    }}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20"
                  >
                    Go to Borrow
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
