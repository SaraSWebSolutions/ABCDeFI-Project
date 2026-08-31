import React, { useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { useAuth } from '../Context/AuthContext';
import { DashboardMode } from '../Utils/dashboardMode';
import {
  Coins,
  ShieldCheck,
  Bot,
  PieChart,
  Repeat,
  Sparkles,
  Wallet,
  Globe,
  ChevronDown,
  Layers,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  User,
  LogOut,
  Key,
  Shield,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenKyc?: () => void;
  onOpenAuth?: () => void;
  dashboardMode: DashboardMode;
  canAccessAdmin: boolean;
  onSwitchDashboard: (mode: DashboardMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenKyc, onOpenAuth, dashboardMode, canAccessAdmin, onSwitchDashboard }) => {
  const { isConnected, shortAddress, chain, balances, profile, connectWallet, disconnectWallet, switchChain } = useWallet();
  const { user, logout } = useAuth();
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'lending', label: 'P2P Loans', icon: Repeat },
    { id: 'lending-v2', label: 'Lending V2', icon: Repeat },
    { id: 'presale', label: 'ICO Presale', icon: Sparkles },
    { id: 'staking', label: 'Staking Pools', icon: Coins },
    { id: 'nfts', label: 'NFT Ecosystem', icon: ShieldCheck },
    { id: 'security', label: 'Security 2FA', icon: Key },
    { id: 'ai-copilot', label: 'AI Copilot', icon: Bot },
    { id: 'portfolio', label: 'Portfolio & Audit', icon: PieChart },
  ];

  const networks = ['Hardhat Local'];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <img
              src="/images/login_logo.svg"
              alt="ABCDeFi Logo"
              className="w-10 h-10 object-contain drop-shadow"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/images/abcdefi-logo.svg';
              }}
            />
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                ABCDeFi
              </span>
            </div>
          </div>



          {/* Right Actions: Network & Wallet */}
          <div className="hidden sm:flex items-center gap-3">

            {/* Network Selector */}
            <div className="relative">
              <button
                onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-slate-700 transition"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>{chain.split(' ')[0]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {showNetworkMenu && (
                <div className="absolute right-0 mt-2 w-48 glass-panel rounded-xl shadow-xl border border-slate-800 py-1 z-50">
                  {networks.map((net) => (
                    <button
                      key={net}
                      onClick={() => {
                        switchChain(net);
                        setShowNetworkMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-800/70 transition ${
                        chain === net ? 'text-emerald-400 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Wallet Button */}
            {isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowWalletDetails(!showWalletDetails)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition shadow-lg shadow-emerald-500/5"
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{shortAddress}</span>
                  <span className="text-[10px] bg-slate-900/80 px-1.5 py-0.5 rounded text-emerald-400 font-mono">
                    {balances.ABCD === null ? 'Unavailable' : `${balances.ABCD.toLocaleString()} ABCD`}
                  </span>
                </button>

                {showWalletDetails && (
                  <div className="absolute right-0 mt-2 w-64 glass-panel rounded-2xl shadow-2xl border border-slate-800 p-4 z-50 text-xs">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                      <span className="text-slate-400 font-medium">Connected Wallet</span>
                      <span className="text-emerald-400 font-mono text-[11px]">{chain}</span>
                    </div>

                    <div className="space-y-2 font-mono mb-4">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400 font-sans">ABCD Token:</span>
                        <span className="text-emerald-400 font-bold">
                          {balances.ABCD === null ? 'Unavailable' : balances.ABCD.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400 font-sans">ETH:</span>
                        <span>{balances.BNB ?? 'Unavailable'} ETH</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400 font-sans">ETH Collateral:</span>
                        <span>{balances.ETH ?? 'Unavailable'} ETH</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400 font-sans">USDT / USDC:</span>
                        <span>{balances.USDT === null || balances.USDC === null ? 'Unavailable' : `$${(balances.USDT + balances.USDC).toLocaleString()}`}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        disconnectWallet();
                        setShowWalletDetails(false);
                      }}
                      className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition border border-red-500/20"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => connectWallet('metamask')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition border border-slate-700"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Wallet</span>
              </button>
            )}

            {/* User Profile & Logout */}
            {user ? (
              <div className="relative flex items-center gap-2 pl-2 border-l border-slate-800">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 text-slate-200 border border-slate-700 hover:border-slate-600 transition"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="max-w-[100px] truncate">{user.name || user.email}</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 glass-panel rounded-2xl shadow-2xl border border-slate-800 p-3 z-50 text-xs">
                    <div className="pb-2 mb-2 border-b border-slate-800 space-y-1">
                      <p className="font-bold text-white truncate">{user.name || 'User'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      {user.country && (
                        <p className="text-[10px] text-emerald-400 font-mono">Country: {user.country}</p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {
                        setActiveTab('security');
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-medium cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Security & 2FA Settings</span>
                    </button>

                    {canAccessAdmin && (
                      <button
                        onClick={() => {
                          onSwitchDashboard(dashboardMode === 'admin' ? 'user' : 'admin');
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-medium cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{dashboardMode === 'admin' ? 'Open User Dashboard' : 'Open Admin Dashboard'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition border border-red-500/20 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition border border-slate-700/80 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                title={item.label}
                className={`w-full flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={onOpenKyc}
              title={profile?.kycStatus === 'approved' ? 'KYC Verified' : 'Verify KYC'}
              className="p-2 rounded bg-emerald-500/20 text-emerald-400 text-xs font-semibold"
            >
              {profile?.kycStatus === 'approved' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
              )}
            </button>
            {isConnected ? (
              <span className="text-xs font-mono text-emerald-400">{shortAddress}</span>
            ) : (
              <button
                onClick={() => connectWallet('metamask')}
                className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
