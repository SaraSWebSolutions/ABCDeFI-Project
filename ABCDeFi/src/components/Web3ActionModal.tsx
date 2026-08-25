import React, { useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  ExternalLink,
  Lock,
  Coins,
  ArrowRight,
  Flame,
  Gift,
  Award,
  FileText,
} from 'lucide-react';

export interface Web3ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  contractName: string;
  methodName: string;
  amountLabel?: string;
  amountValue?: string;
  params?: { label: string; value: string }[];
  icon?: string;
  onExecute: () => Promise<void> | void;
  onSuccessMutation?: () => void;
}

export const Web3ActionModal: React.FC<Web3ActionModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  contractName,
  methodName,
  amountLabel = 'Transaction Value',
  amountValue = '0.00',
  params = [],
  icon = '⚡',
  onExecute,
  onSuccessMutation,
}) => {
  const [step, setStep] = useState<'confirm' | 'metamask' | 'pending' | 'success' | 'error'>('confirm');
  const [selectedWallet, setSelectedWallet] = useState<string>('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const [subStep, setSubStep] = useState<number>(1);
  const [txHash, setTxHash] = useState<string>('');
  const [blockNum, setBlockNum] = useState<number>(8546222);
  const [nonce, setNonce] = useState<number>(14);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const WALLETS = [
    { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', label: 'Account 1 (Alex)', balance: '42.50 ETH' },
    { address: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC', label: 'Account 2 (Elena)', balance: '18.20 ETH' },
    { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', label: 'Account 3 (Liam)', balance: '5.00 ETH' },
  ];

  const SUB_STEPS = [
    { num: 1, title: 'Preparing Tx & Gas Estimation', desc: 'Calculating Sepolia gas limits & EIP-1559 fees...' },
    { num: 2, title: 'Requesting Wallet Signature', desc: 'Awaiting secp256k1 cryptographic signature...' },
    { num: 3, title: 'Broadcasting to Sepolia Mempool', desc: 'Propagating raw signed transaction payload...' },
    { num: 4, title: 'Block Mining & Confirmation', desc: 'EVM state transition & receipt verification...' },
  ];

  const handleStartTransaction = async () => {
    setStep('pending');
    setSubStep(1);
    const generatedHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    setTxHash(generatedHash);
    const currentBlock = 8546220 + Math.floor(Math.random() * 50);
    setBlockNum(currentBlock);
    setNonce(Math.floor(Math.random() * 80) + 12);

    try {
      // Step 1: Preparing
      await new Promise((r) => setTimeout(r, 400));
      setSubStep(2);

      // Step 2: Signing
      await new Promise((r) => setTimeout(r, 500));
      setSubStep(3);

      // Execute custom action handler
      await onExecute();

      // Step 3: Broadcasting
      await new Promise((r) => setTimeout(r, 600));
      setSubStep(4);

      // Step 4: Mining
      await new Promise((r) => setTimeout(r, 600));

      if (onSuccessMutation) {
        onSuccessMutation();
      }

      setStep('success');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Transaction execution failed on Ethereum Sepolia EVM.');
      setStep('error');
    }
  };

  const handleCloseModal = () => {
    setStep('confirm');
    setSubStep(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 font-mono overflow-y-auto">
      <div className="bg-slate-900/95 border border-indigo-500/40 rounded-3xl p-6 max-w-xl w-full shadow-2xl shadow-slate-950 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-2xl shadow-inner">
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200">
                {title}
              </h3>
              <p className="text-xs text-slate-400 font-sans leading-snug">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* STEP 1: CONFIRMATION STEP */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {/* Wallet Address Switcher */}
            <div className="bg-slate-950/90 border border-indigo-500/25 rounded-2xl p-3 space-y-1.5 text-xs font-mono shadow-inner">
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span>🦊</span> Select Signing Web3 Wallet:
                </span>
                <span className="text-emerald-400 text-[10px] font-bold">Sepolia Connected</span>
              </div>
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono text-xs focus:border-indigo-500 outline-none cursor-pointer"
              >
                {WALLETS.map((w) => (
                  <option key={w.address} value={w.address}>
                    {w.label} — {w.address.substring(0, 6)}...{w.address.substring(38)} ({w.balance})
                  </option>
                ))}
              </select>
            </div>

            {/* Parameters Table (Scrollable Box) */}
            <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 space-y-2 text-xs shadow-inner max-h-64 overflow-y-auto">
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Signing Address:</span>
                <span className="text-white font-bold font-mono">
                  {selectedWallet.substring(0, 8)}...{selectedWallet.substring(36)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Target Contract:</span>
                <span className="text-indigo-400 font-bold font-mono">{contractName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Method Signature:</span>
                <span className="text-amber-400 font-bold font-mono">{methodName}()</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">{amountLabel}:</span>
                <span className="text-emerald-400 font-black text-sm font-mono">{amountValue}</span>
              </div>
              {params.map((p, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-800/40 pb-1.5">
                  <span className="text-slate-400">{p.label}:</span>
                  <span className="text-white font-bold text-right ml-2">{p.value}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 text-[11px]">
                <span className="text-slate-400">Est. Max Gas Fee:</span>
                <span className="text-slate-300 font-mono font-semibold">0.0012 ETH (2.3 Gwei)</span>
              </div>
            </div>

            <div className="p-3 bg-indigo-950/50 border border-indigo-500/30 rounded-2xl text-[11px] text-indigo-200 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>Verified EVM Smart Contract on Sepolia (ChainID: 11155111). Click Sign & Submit to broadcast on-chain.</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCloseModal}
                className="flex-1 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleStartTransaction}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <span>Approve & Execute On-Chain ⚡</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* METAMASK POPUP SIGNATURE DIALOG */}
        {step === 'metamask' && (
          <div className="p-5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl space-y-4 font-sans text-xs animate-in zoom-in-95 duration-150 shadow-2xl shadow-amber-950/40">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🦊</span>
                <div>
                  <div className="font-bold text-white text-sm">MetaMask Signature Request</div>
                  <div className="text-[10px] text-amber-400 font-mono">https://abcdefi.io</div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                Sepolia
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Account:</span>
                <span className="text-white font-bold">{selectedWallet.substring(0, 10)}...{selectedWallet.substring(36)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Contract:</span>
                <span className="text-indigo-400 font-bold">{contractName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Function:</span>
                <span className="text-amber-400 font-bold">{methodName}()</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Gas Limit:</span>
                <span className="text-emerald-400 font-bold">48,210 Gas (2.3 Gwei)</span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[11px] text-amber-200 font-mono">
              ⚠️ You are signing an EVM transaction on Ethereum Sepolia. Click Sign & Confirm to broadcast to mempool.
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold rounded-xl transition cursor-pointer"
              >
                Reject
              </button>
              <button
                onClick={handleStartTransaction}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition cursor-pointer shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
              >
                <span>Confirm & Sign in MetaMask 🦊</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PENDING BLOCKCHAIN STATE WITH REALISTIC LIFECYCLE STEPPER */}
        {step === 'pending' && (
          <div className="py-6 space-y-6 text-center flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-emerald-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">Broadcasting Smart Contract Transaction...</h4>
              <p className="text-xs text-emerald-400 font-bold font-mono">
                {SUB_STEPS.find((s) => s.num === subStep)?.desc}
              </p>
            </div>

            {/* REALISTIC LIFECYCLE STEP PROGRESS BAR */}
            <div className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5 text-left text-xs font-mono">
              {SUB_STEPS.map((s) => {
                const isCurrent = subStep === s.num;
                const isDone = subStep > s.num;
                return (
                  <div key={s.num} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isDone ? 'bg-emerald-500 text-slate-950' : isCurrent ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {isDone ? '✓' : s.num}
                      </div>
                      <span className={`text-xs ${isDone ? 'text-emerald-400 font-bold' : isCurrent ? 'text-white font-bold' : 'text-slate-500'}`}>
                        {s.title}
                      </span>
                    </div>
                    {isCurrent && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1 text-left w-full font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Pending Hash:</span>
                <span className="text-indigo-400 font-bold">
                  {txHash.substring(0, 10)}...{txHash.substring(58)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Block / Nonce:</span>
                <span className="text-emerald-400 font-bold">#{blockNum} (Nonce: {nonce})</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS STATE */}
        {step === 'success' && (
          <div className="py-6 space-y-5 text-center flex flex-col items-center justify-center">
            <div className="w-18 h-18 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-11 h-11 text-emerald-400 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-black text-white">On-Chain Transaction Confirmed! ✅</h4>
              <p className="text-xs text-emerald-400 font-bold">{amountValue} successfully executed on Sepolia.</p>
            </div>

            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl text-xs space-y-2 text-left w-full font-mono shadow-inner">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-bold">Confirmed (1 Block Receipt)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tx Hash:</span>
                <span className="text-indigo-400 font-bold text-[11px]">
                  {txHash.substring(0, 14)}...{txHash.substring(54)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Block Height:</span>
                <span className="text-white font-bold">#{blockNum}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gas Used:</span>
                <span className="text-slate-300">48,210 Gas (100% success)</span>
              </div>
            </div>

            <button
              onClick={handleCloseModal}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-500/30"
            >
              Done & Auto-Refresh Protocol State
            </button>
          </div>
        )}

        {/* STEP 4: ERROR STATE */}
        {step === 'error' && (
          <div className="py-6 space-y-5 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/50">
              <XCircle className="w-10 h-10 text-rose-400" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-bold text-white">Transaction Execution Error</h4>
              <p className="text-xs text-rose-400 font-sans max-w-xs">{errorMsg}</p>
            </div>

            <button
              onClick={() => setStep('confirm')}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Retry Transaction
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Web3ActionModal;
