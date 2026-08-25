import React from 'react';
import { User, PlatformAccessStatus } from '../types';
import { Shield, ShieldCheck, Wallet, Lock, Unlock, RefreshCw, Cpu } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  accessStatus: PlatformAccessStatus;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRefresh: () => void;
  devMode: boolean;
  setDevMode: (devMode: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  accessStatus,
  activeTab,
  setActiveTab,
  onRefresh,
  devMode,
  setDevMode
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand Logo & Milestone Title */}
        <div className="flex items-center space-x-3">
          <img
            src="/images/login_logo.svg"
            alt="ABCDeFi Logo"
            className="w-10 h-10 object-contain drop-shadow"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/abcdefi-logo.svg';
            }}
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                ABCDeFi
              </h1>
            </div>
          </div>
        </div>

        {/* Network Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
          <Cpu className="w-3.5 h-3.5 text-yellow-400" />
          <span>BNB Smart Chain (Chain 56)</span>
        </div>

        {/* Access Status & User Profile Info */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Refresh State"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {accessStatus.isPlatformUnlocked ? (
            <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-lg shadow-emerald-950/50">
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span>PLATFORM UNLOCKED</span>
            </div>
          ) : (
            <div className="flex items-center p-2 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-semibold" title="Read Only Mode">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </div>
          )}

          {user ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-slate-950 text-[10px]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium max-w-[100px] truncate">{user.name}</span>
              {user.isKycVerified ? (
                <span title="KYC Verified"><ShieldCheck className="w-4 h-4 text-emerald-400" /></span>
              ) : (
                <span title="KYC Pending"><Shield className="w-4 h-4 text-amber-400" /></span>
              )}
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('auth')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-900/40 transition"
            >
              Sign In / Register
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === 'admin') {
                setActiveTab('dashboard');
                window.history.pushState({}, '', '/');
              } else {
                setActiveTab('admin');
                window.history.pushState({}, '', '/admin');
              }
            }}
            className={`px-3.5 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/50'
                : 'bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40'
            }`}
          >
            <span>🛡️ {activeTab === 'admin' ? 'Exit Admin Portal' : 'Admin Portal'}</span>
          </button>

          <button
            onClick={() => setDevMode(!devMode)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              devMode
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Developer & Technical Pipeline View"
          >
            <span>🛠️</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      {devMode && (
        <div className="border-t border-slate-800/80 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-4 overflow-x-auto text-xs font-medium py-2">
          <button
            onClick={() => setActiveTab('auth')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'auth'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>1. Auth & Verification</span>
            {user?.isEmailVerified && <span className="text-emerald-400">✓</span>}
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'wallet'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>2. Connect Wallet & Sign</span>
            {user?.walletAddress && <span className="text-emerald-400">✓</span>}
          </button>

          <button
            onClick={() => setActiveTab('kyc')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'kyc'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Sumsub KYC SDK</span>
            {user?.isKycVerified && <span className="text-emerald-400">✓</span>}
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'contract'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>4. BSC Smart Contract State</span>
          </button>

          <button
            onClick={() => setActiveTab('defi')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'defi'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>5. DeFi Platform (ICO/Lend)</span>
            {accessStatus.isPlatformUnlocked ? (
              <Unlock className="w-3 h-3 text-emerald-400" />
            ) : (
              <Lock className="w-3 h-3 text-amber-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'inspector'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>PostgreSQL & Webhook Inspector</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('admin');
              if (!window.location.pathname.startsWith('/admin')) {
                window.history.pushState({}, '', '/admin');
              }
            }}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'admin'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>🛡️ Admin Portal Engine</span>
          </button>
        </div>
      </div>
      )}
    </header>
  );
};
