import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Lock, CheckCircle2 } from 'lucide-react';

export interface AssetQuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: { symbol: string; name: string; balance: string; value: string; color: string } | null;
  onActionComplete: (action: string, amount: string, symbol: string) => void;
}

export const AssetQuickActionModal: React.FC<AssetQuickActionModalProps> = ({
  isOpen,
  onClose,
  asset,
  onActionComplete,
}) => {
  const [tab, setTab] = useState<'deposit' | 'stake' | 'swap' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !asset) return null;

  const handleExecute = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setSuccessMsg(`Successfully executed ${tab.toUpperCase()} of ${amount} ${asset.symbol}`);
      onActionComplete(tab, amount, asset.symbol);
      setTimeout(() => {
        setSuccessMsg(null);
        setAmount('');
        onClose();
      }, 1200);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${asset.color} flex items-center justify-center font-bold text-slate-950 shadow-md`}>
              {asset.symbol.slice(0, 3)}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{asset.name}</h3>
              <p className="text-xs text-slate-400">Balance: {asset.balance} ({asset.value})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer">
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs">
          {(['deposit', 'stake', 'swap', 'withdraw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSuccessMsg(null); }}
              className={`py-2 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer ${
                tab === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Action Form */}
        {!successMsg ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Enter Amount</span>
                <span className="text-indigo-400 cursor-pointer" onClick={() => setAmount('100')}>Max: {asset.balance}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-base font-bold focus:outline-none focus:border-indigo-500 transition"
                />
                <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">{asset.symbol}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Estimated APY Yield:</span>
                <span className="text-emerald-400 font-bold">12.5% APY</span>
              </div>
              <div className="flex justify-between">
                <span>Gas Fee Estimate:</span>
                <span className="text-slate-300 font-bold">~0.0012 ETH ($2.10)</span>
              </div>
            </div>

            <button
              disabled={isProcessing || !amount}
              onClick={handleExecute}
              className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                isProcessing ? 'bg-indigo-900 text-indigo-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Confirming On-Chain...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute {tab.toUpperCase()} {asset.symbol}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce mx-auto" />
            <p className="text-xs font-bold text-emerald-300">{successMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetQuickActionModal;
