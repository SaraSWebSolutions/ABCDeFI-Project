import React from 'react';
import { User, PlatformAccessStatus } from '../types';
import { 
  Check, 
  ArrowRight, 
  UserPlus, 
  Mail, 
  Key, 
  Wallet, 
  FileSignature, 
  Shield, 
  UserCheck, 
  Webhook, 
  Cpu, 
  Unlock, 
  Lock,
  Sparkles
} from 'lucide-react';

interface MilestoneStepperProps {
  user: User | null;
  accessStatus: PlatformAccessStatus;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MilestoneStepper: React.FC<MilestoneStepperProps> = ({
  user,
  accessStatus,
  activeTab,
  setActiveTab
}) => {
  const steps = [
    {
      stepNum: 1,
      title: "User Register",
      desc: "POST /api/user/register",
      done: !!user,
      targetTab: "auth",
      icon: UserPlus
    },
    {
      stepNum: 2,
      title: "Email Verify (OTP)",
      desc: "POST /api/user/verify-otp",
      done: !!user?.isEmailVerified,
      targetTab: "auth",
      icon: Mail
    },
    {
      stepNum: 3,
      title: "JWT Token Login",
      desc: "POST /api/user/login",
      done: !!user,
      targetTab: "auth",
      icon: Key
    },
    {
      stepNum: 4,
      title: "Connect Wallet",
      desc: "Web3 Provider Connect",
      done: !!user?.walletAddress,
      targetTab: "wallet",
      icon: Wallet
    },
    {
      stepNum: 5,
      title: "Sign Nonce",
      desc: "Cryptographic signature",
      done: !!user?.walletAddress,
      targetTab: "wallet",
      icon: FileSignature
    },
    {
      stepNum: 6,
      title: "Sumsub SDK Init",
      desc: "POST /api/kyc/start",
      done: !!user?.isKycVerified || accessStatus.isKycApproved,
      targetTab: "kyc",
      icon: Shield
    },
    {
      stepNum: 7,
      title: "3D Liveness Selfie",
      desc: "Biometric proof check",
      done: !!user?.isKycVerified || accessStatus.isKycApproved,
      targetTab: "kyc",
      icon: UserCheck
    },
    {
      stepNum: 8,
      title: "Sumsub Webhook",
      desc: "GREEN approval callback",
      done: !!user?.isKycVerified,
      targetTab: "kyc",
      icon: Webhook
    },
    {
      stepNum: 9,
      title: "BSC Smart Contract",
      desc: "approveKYC(wallet)",
      done: accessStatus.isOnChainKycVerified,
      targetTab: "contract",
      icon: Cpu
    },
    {
      stepNum: 10,
      title: "Platform Unlock",
      desc: "DeFi modules activated",
      done: accessStatus.isPlatformUnlocked,
      targetTab: "defi",
      icon: Unlock
    }
  ];

  const completedCount = steps.filter(s => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Find the first step that is NOT completed to highlight as active
  const activeStepIndex = steps.findIndex(s => !s.done);
  const activeStepNum = activeStepIndex !== -1 ? activeStepIndex + 1 : 10;

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/85 rounded-3xl p-6 mb-8 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
      {/* Decorative ambient glowing backdrops */}
      <div className="absolute -top-16 -left-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-[10px] font-black text-emerald-400 uppercase tracking-wider font-mono">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Milestone 1 Pipeline
            </span>
            <span className="text-xs font-mono text-slate-400">
              Active Step: {activeStepNum} of 10
            </span>
          </div>
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            Milestone 1 Architecture Flow
          </h2>
          <p className="text-xs text-slate-400">
            End-to-End Authentication, Signature Nonce, Sumsub KYC Webhook & Smart Contract Integration
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Glowing Progress Indicator */}
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800/80 px-4 py-2 rounded-2xl">
            <div className="relative flex items-center justify-center w-10 h-10">
              {/* Circular track */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" className="text-slate-800" fill="transparent" />
                <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" className="text-emerald-500" fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 16}`}
                  strokeDashoffset={`${2 * Math.PI * 16 * (1 - completedCount / 10)}`}
                />
              </svg>
              <span className="absolute text-xs font-bold font-mono text-slate-200">{progressPercent}%</span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Progress</div>
              <div className="text-xs font-black text-white font-mono">{completedCount}/10 Tasks Complete</div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab(accessStatus.isPlatformUnlocked ? 'defi' : 'auth')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition duration-300"
          >
            <span>{accessStatus.isPlatformUnlocked ? 'Launch DeFi' : 'Verify Now'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Track line */}
      <div className="w-full bg-slate-950 rounded-full h-1.5 mb-6 overflow-hidden border border-slate-900">
        <div
          className="bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-400 h-1.5 transition-all duration-700 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          style={{ width: `${Math.max(3, progressPercent)}%` }}
        />
      </div>

      {/* Steps Pipeline Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3 relative z-10">
        {steps.map((s, index) => {
          const StepIcon = s.icon;
          const isCurrent = s.stepNum === activeStepNum;
          const isDone = s.done;

          return (
            <button
              key={s.stepNum}
              onClick={() => setActiveTab(s.targetTab)}
              className={`group p-3 rounded-2xl border text-left transition-all duration-300 relative flex flex-col justify-between h-[115px] hover:-translate-y-1 shadow-md hover:shadow-xl ${
                isDone
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-100 hover:border-emerald-500/60 shadow-emerald-950/20'
                  : isCurrent
                  ? 'bg-amber-950/20 border-amber-500/60 text-slate-100 ring-2 ring-amber-500/20 animate-pulse'
                  : 'bg-slate-950/50 border-slate-900 text-slate-400 hover:border-slate-800 hover:bg-slate-900/50'
              }`}
            >
              {/* Top Row: Icon & Status Badge */}
              <div className="flex items-center justify-between w-full">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isDone 
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' 
                    : isCurrent
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                    : 'bg-slate-900 border border-slate-800 text-slate-500 group-hover:text-slate-400'
                }`}>
                  {isDone ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[9px] font-mono font-bold text-slate-500 group-hover:text-slate-400">
                  #{s.stepNum}
                </span>
              </div>

              {/* Step Title & Details */}
              <div className="mt-3">
                <h4 className={`text-[11px] font-black tracking-tight line-clamp-1 ${
                  isDone ? 'text-emerald-300' : isCurrent ? 'text-amber-300' : 'text-slate-200'
                }`}>
                  {s.title}
                </h4>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate group-hover:text-slate-300 transition-colors">
                  {s.desc}
                </p>
              </div>

              {/* Visual Node Connectors (Horizontal on Desktop) */}
              {index < 9 && (
                <div className="hidden lg:block absolute top-[25px] -right-[10px] w-[18px] h-[2px] z-20">
                  <div className={`w-full h-full rounded ${
                    isDone ? 'bg-emerald-500/30' : 'bg-slate-900'
                  }`} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
