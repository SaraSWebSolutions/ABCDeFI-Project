import React, { useState } from 'react';
import { PlatformAccessStatus, User } from '../types';
import { Lock, Unlock, ShieldCheck, Coins, Landmark, DollarSign, Award, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import LoanCreationFlow from './LoanCreationFlow';

interface DeFiPlatformViewProps {
  user: User | null;
  accessStatus: PlatformAccessStatus;
  onGoToAuth: () => void;
  onGoToWallet: () => void;
  onGoToKyc: () => void;
}

export const DeFiPlatformView: React.FC<DeFiPlatformViewProps> = ({
  user,
  accessStatus,
  onGoToAuth,
  onGoToWallet,
  onGoToKyc
}) => {
  const [borrowAmount, setBorrowAmount] = useState('10000');
  const [collateralAmount, setCollateralAmount] = useState('15');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isUnlocked = accessStatus.isPlatformUnlocked;

  const handleExecuteTrade = (featureName: string) => {
    if (!isUnlocked) return;
    setActionSuccess(`Action Executed! ${featureName} transaction signed and broadcasted to BNB Smart Chain.`);
  };

  return (
    <div className="space-y-8">
      
      {/* Platform Status Banner */}
      <div className={`p-6 rounded-2xl border relative overflow-hidden transition-all ${
        isUnlocked
          ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-cyan-950/80 border-emerald-500/50 shadow-2xl shadow-emerald-950/40'
          : 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/40'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {isUnlocked ? (
                <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center space-x-1.5">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>STEP 10 COMPLETE: FULL PLATFORM UNLOCKED</span>
                </div>
              ) : (
                <div className="p-1.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40 flex items-center" title="Read Only Mode">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                </div>
              )}
            </div>

            <h2 className="text-xl font-extrabold text-slate-100">
              ABCDeFi Production Financial Protocol
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isUnlocked
                ? 'Welcome Alex! Your email, signature-verified wallet, and Sumsub KYC approval are confirmed on BNB Smart Chain. You have unrestricted access to ICO allocations, lending pools, borrowing, and node NFTs.'
                : 'Complete verification requirements (Email Verification + Signature Wallet Connect + Sumsub KYC GREEN Webhook) to unlock trading, borrowing, and minting.'}
            </p>
          </div>

          {/* Checklist Pills */}
          <div className="flex flex-wrap md:flex-col gap-2 text-xs font-mono">
            <button
              onClick={onGoToAuth}
              className={`px-3 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-left transition ${
                accessStatus.isEmailVerified
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-500'
              }`}
            >
              <span>1. Email Verified</span>
              <span>{accessStatus.isEmailVerified ? '✓' : 'Pending'}</span>
            </button>

            <button
              onClick={onGoToWallet}
              className={`px-3 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-left transition ${
                accessStatus.isWalletConnected
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-500'
              }`}
            >
              <span>2. Wallet Connected & Signed</span>
              <span>{accessStatus.isWalletConnected ? '✓' : 'Pending'}</span>
            </button>

            <button
              onClick={onGoToKyc}
              className={`px-3 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-left transition ${
                accessStatus.isKycApproved
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-500'
              }`}
            >
              <span>3. Sumsub KYC Approved</span>
              <span>{accessStatus.isKycApproved ? '✓' : 'Pending'}</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center space-x-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Grid of Unlocked DeFi Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Module 1: ICO Launchpad */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          {!isUnlocked && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
              <Lock className="w-8 h-8 text-amber-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-100">ICO Launchpad Locked</h4>
              <p className="text-[11px] text-slate-400 mt-1 mb-3">KYC & Wallet verification required to participate in $ABC token presale.</p>
              <button onClick={onGoToKyc} className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
                Complete KYC Step
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
                Guaranteed Whitelist Tier
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-100 mb-1">$ABC Token Presale ICO</h3>
            <p className="text-xs text-slate-400 mb-4">Initial Coin Offering for ABCDeFi governance and yield staking token.</p>

            <div className="space-y-2 text-xs font-mono bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Token Price:</span>
                <span className="text-slate-200">$0.05 USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Max Allocation:</span>
                <span className="text-emerald-400 font-bold">50,000 $ABC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vesting:</span>
                <span className="text-slate-200">20% TGE, 6mo linear</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleExecuteTrade('ICO Token Purchase')}
            disabled={!isUnlocked}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition disabled:opacity-40"
          >
            Buy $ABC Allocation
          </button>
        </div>

        {/* Module 2: Borrowing Protocol */}
        <LoanCreationFlow />

        {/* Module 3: Franchise NFTs */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          {!isUnlocked && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
              <Lock className="w-8 h-8 text-amber-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-100">Franchise NFTs Locked</h4>
              <p className="text-[11px] text-slate-400 mt-1 mb-3">Node franchise NFT minting restricted to verified accounts.</p>
              <button onClick={onGoToKyc} className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
                Complete KYC Step
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg">
                <Award className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-purple-300 bg-purple-950 px-2.5 py-1 rounded-full border border-purple-800">
                Node Revenue Share
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-100 mb-1">Regional Franchise Node NFT</h3>
            <p className="text-xs text-slate-400 mb-4">Mint exclusive regional franchise NFTs earning 2.5% protocol revenue share.</p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Mint Price:</span>
                <span className="text-amber-400 font-bold">2.5 BNB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Monthly Yield:</span>
                <span className="text-emerald-400 font-bold">~$1,250 USDT</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleExecuteTrade('Franchise NFT Mint')}
            disabled={!isUnlocked}
            className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs shadow-lg transition disabled:opacity-40"
          >
            Mint Franchise Node NFT
          </button>
        </div>

      </div>
    </div>
  );
};
