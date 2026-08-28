import React, { useState } from 'react';
import {
  Wallet,
  PieChart,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  RefreshCcw,
  CalendarClock,
  History,
  TrendingUp,
  Gift,
  Image as ImageIcon,
  ShoppingCart,
  Tag,
  Repeat,
  Layers,
  Rocket,
  Download,
  Users,
  Bot,
  GraduationCap,
  Award,
  ShieldCheck,
  Bell,
  Settings,
  User,
  Activity,
  Building2,
  MapPinned
} from 'lucide-react';

// Import existing components that will be embedded in this dashboard
import { PortfolioDashboard } from './PortfolioDashboard';
import { TransactionHistory } from './TransactionHistory';
import { NFTEcosystem } from './NFTEcosystem';
import { LegionNFT } from './LegionNFT';
import { FranchiseNFT } from './FranchiseNFT';
import { PresaleICO } from './PresaleICO';
import { ClaimPortal } from './ClaimPortal';
import { ReferralSystem } from './ReferralSystem';
import { AIFinancialAssistant } from './AIFinancialAssistant';
import { FinancialEducation } from './FinancialEducation';
import { AIGamesDashboard } from './AIGamesDashboard';
import { ProtocolDashboard } from './ProtocolDashboard';
import { ContractInteractDashboard } from './ContractInteractDashboard';
import { MasterProtocolManager } from './MasterProtocolManager';
import { NFTSubModuleManager } from './NFTSubModuleManager';
import P2PLendingDashboard from './P2PLendingDashboard';

import NextGenProtocolDashboard from './NextGenProtocolDashboard';

export interface UserDashboardProps {
  // Pass down necessary props for ClaimPortal
  schedules: any[];
  selectedAccount: any;
  currentTimestamp: number;
  computeVestedAmount: (sch: any, ts: number) => bigint;
  computeReleasableAmount: (sch: any, ts: number) => bigint;
  onClaim: (scheduleId: string) => void;
  formatUnits: (amt: bigint) => string;
  formatDuration: (sec: number) => string;
  paused: boolean;
  canAccessAdmin?: boolean;
  onOpenAdminDashboard?: () => void;
}

import { useWallet } from '../Context/WalletContext';
import { useAuth } from '../Context/AuthContext';
import { CollateralDepositForm } from './CollateralDepositForm';
import { WalletSection } from './WalletSection';

export const UserDashboard: React.FC<UserDashboardProps> = ({ canAccessAdmin = false, onOpenAdminDashboard, ...props }) => {
  const wallet = useWallet();
  const { user } = useAuth();

  console.log("[UserDashboard] user:", user);
  console.log(
    "[UserDashboard] KYC:",
    user?.kycStatus,
    user?.isKycVerified
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [depositSubTab, setDepositSubTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [walletConnectError, setWalletConnectError] = useState('');

  const connectMetaMask = async () => {
    setWalletConnectError('');
    try {
      await wallet.connectWallet('metamask');
    } catch (error) {
      setWalletConnectError(error instanceof Error ? error.message : 'Unable to connect MetaMask.');
    }
  };

  const hasKycSubmission = Boolean(user?.kycSubmittedAt || user?.kycProviderReference);
  const rawKycStatus = String(user?.kycStatus || '').toLowerCase();
  const kycStatus =
    user?.isKycVerified || wallet.isKycApproved || rawKycStatus === 'approved'
      ? 'approved'
      : rawKycStatus === 'rejected'
        ? 'rejected'
        : hasKycSubmission
          ? 'pending'
          : 'unverified';
  const kycStatusLabel = kycStatus === 'unverified'
    ? 'Verification not started'
    : kycStatus === 'pending'
      ? 'Verification pending'
      : kycStatus === 'approved'
        ? 'Verified'
        : 'Verification rejected';

  console.log(
    "[UserDashboard] activeTab:",
    activeTab,
    "kycStatus:",
    kycStatus
  );
  const USER_MODULES = [
    { id: 'overview', label: '🚀 Operating System Hub', icon: Activity },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'deposit', label: 'Deposit / Withdraw', icon: ArrowDownToLine },
    { id: 'borrow', label: 'Borrow', icon: Coins },
    // { id: 'repay', label: 'Repay Loan', icon: RefreshCcw },
    { id: 'emi', label: 'EMI Payments', icon: CalendarClock },
    { id: 'view-all-loans', label: 'View All Loans', icon: Coins },
    // { id: 'loan-monitoring', label: 'Loan Monitoring', icon: Activity },
    // { id: 'defaulted-loans', label: 'Defaulted Loans', icon: AlertTriangle }, // hidden
    { id: 'liquidation', label: 'Liquidation', icon: Coins },
    // { id: 'loan-reports', label: 'Loan Reports', icon: PieChart },
    { id: 'history', label: 'Transaction History', icon: History },
    // { id: 'staking', label: 'Staking', icon: TrendingUp },
    // { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'nft-ecosystem', label: 'NFT Ecosystem', icon: Layers },
    { id: 'legion', label: 'Legion NFTs', icon: MapPinned },
    { id: 'franchise', label: 'Franchise NFTs', icon: Building2 },
    // { id: 'ai-59c', label: '🤖 59C AI Games & Learning', icon: Bot },
    { id: 'ico', label: 'ICO Participation', icon: Rocket },
    { id: 'referral', label: 'Referrals', icon: Users },
    // { id: 'vesting', label: 'Claim Vesting', icon: Download },
    { id: 'credit', label: 'Credit Score', icon: ShieldCheck },
    // { id: 'notifications', label: 'Notifications', icon: Bell },
    // { id: 'settings', label: 'Settings', icon: Settings },
    // { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="space-y-6">
      {/* LIVE WEB3 WALLET & BALANCES BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                Financial Protocol Hub
              </span>

              {wallet.isConnected && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Wallet Connected
                </span>
              )}

              {(user?.kycStatus === 'approved' || user?.isKycVerified) && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  KYC Verified
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Hello, {(() => {
                const displayName = user?.name || (user?.email ? user.email.split('@')[0] : '');
                if (!displayName) return 'User';
                return displayName.charAt(0).toUpperCase() + displayName.slice(1);
              })()} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Wallet state and lending metrics are shown from configured local services when available.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canAccessAdmin && onOpenAdminDashboard && (
              <button
                onClick={onOpenAdminDashboard}
                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xs transition cursor-pointer"
              >
                Open Admin Dashboard
              </button>
            )}
            {/* Live Balances Display */}
            <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800/80 px-4 py-2 rounded-2xl text-xs font-mono">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">ETH Balance</div>
                <div className="text-xs font-black text-amber-300">{wallet.balanceBNB === null ? 'Unavailable' : `${wallet.balanceBNB} ETH`}</div>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">ABCD Tokens</div>
                <div className="text-xs font-black text-emerald-300">
                  {wallet.balanceABCD === null ? 'Unavailable' : `${wallet.balanceABCD} ABCD`}
                </div>
              </div>
            </div>

            {!wallet.isConnected ? (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => void connectMetaMask()}
                  disabled={wallet.isConnecting}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wallet className="w-4 h-4" /> {wallet.isConnecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
                {walletConnectError && <span className="max-w-48 text-right text-[10px] text-rose-300">{walletConnectError}</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {!wallet.isCorrectNetwork && (
                  <button
                    onClick={() => void wallet.switchChain('Hardhat Local').catch((error) => setWalletConnectError(error instanceof Error ? error.message : 'Unable to switch MetaMask to Hardhat Local.'))}
                    className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 font-black rounded-xl text-xs transition cursor-pointer"
                  >
                    Switch to Hardhat Local
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('wallet')}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  Manage Wallet
                </button>
                <button
                  onClick={() => wallet.disconnectWallet()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Disconnect
                </button>
                {walletConnectError && <span className="max-w-48 text-right text-[10px] text-rose-300">{walletConnectError}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MASTER USER NAVIGATION MENU BAR */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-2.5 shadow-xl shadow-slate-950/40">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
          {USER_MODULES.map((tab) => {
            const IconComp = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  console.log(
                    '[UserDashboard] clicked tab:',
                    tab.id,
                    tab.label
                  );
                  setActiveTab(tab.id);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${isSelected
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 scale-[1.03] border border-emerald-200'
                  : 'bg-slate-950/90 text-slate-400 hover:text-white hover:bg-slate-800/90 border border-slate-800/80'
                  }`}
              >
                <IconComp className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-emerald-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DYNAMIC CONTENT RENDERING BASED ON ACTIVE TAB */}

      {activeTab === 'overview' && (
        <NextGenProtocolDashboard
          userAddress={wallet.address || undefined}
          userEmail={user?.email}
          kycStatus={kycStatus}
          onNavigateTab={(t) => setActiveTab(t)}
        />
      )}
      {activeTab === 'wallet' && (
        <WalletSection
          user={user}
          onWalletConnected={() => { void wallet.refreshBalances(); }}
          onSiweLogin={wallet.loginWithSignature}
        />
      )}
      {activeTab === 'portfolio' && <PortfolioDashboard />}
      {activeTab === 'ico' && <PresaleICO />}
      {(activeTab === 'deposit' || activeTab === 'withdraw') && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 max-w-3xl mx-auto font-mono">
          {/* Sub-Tab Navigation Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
            <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2">
              <Repeat className="w-5 h-5 text-emerald-400" /> Deposit & Withdraw Funds
            </h2>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setDepositSubTab('deposit')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${depositSubTab === 'deposit'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" /> Deposit
              </button>
              <button
                onClick={() => setDepositSubTab('withdraw')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${depositSubTab === 'withdraw'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" /> Withdraw
              </button>
            </div>
          </div>

          {/* Deposit Content Panel */}
          {depositSubTab === 'deposit' && <CollateralDepositForm mode="deposit" />}

          {/* Withdraw Content Panel */}
          {depositSubTab === 'withdraw' && <CollateralDepositForm mode="withdraw" />}
        </div>
      )}
      {['borrow', 'repay', 'emi', 'view-all-loans', 'loan-monitoring', 'defaulted-loans', 'liquidation', 'loan-reports'].includes(activeTab) && (
        <P2PLendingDashboard activeTab={activeTab} />
      )}

      {activeTab === 'history' && <TransactionHistory />}
      {activeTab === 'ai-59c' && <AIGamesDashboard />}

      {activeTab === 'staking' && (
        <div className="space-y-6">
          <ProtocolDashboard />
          <ContractInteractDashboard />
        </div>
      )}

      {/* {activeTab === 'rewards' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
            <Gift className="w-5 h-5 text-pink-400" /> Protocol Rewards
          </h2>
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-4 font-mono">
            <div className="text-slate-400 text-sm">Total Claimable ABCD Yield</div>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-400">
              {claimableYield > 0 ? `${claimableYield.toLocaleString()} ABCD` : '0.00 ABCD'}
            </div>
            <p className="text-xs text-slate-500">
              {claimableYield > 0 ? `Value: ~$${(claimableYield * 1.25).toFixed(2)} USDC` : 'Yield Claimed ✓'}
            </p>

            {cooldownSeconds > 0 ? (
              <div className="p-3 bg-slate-900 border border-pink-500/30 rounded-xl text-xs text-pink-300 font-bold flex flex-col items-center gap-1 animate-pulse">
                <span>🎁 Yield Claimed Successfully!</span>
                <span>Accumulating new on-chain yield... Re-enabling in {cooldownSeconds}s</span>
              </div>
            ) : (
              <button
                onClick={handleClaimRewardsSubmit}
                disabled={claimableYield === 0}
                className="px-8 py-3 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg shadow-pink-500/20 disabled:opacity-50"
              >
                Claim All Rewards
              </button>
            )}
          </div>
        </div>
      )} */}

      {/* 12 Operational Sub-Tabs Routed to MasterProtocolManager - HIDDEN */}
      {/* {['view-all-loans', 'loan-monitoring', 'defaulted-loans', 'liquidation', 'loan-reports', 'token-management', 'nft-management', 'franchise-management', 'ai-management', 'education-management', 'platform-settings'].includes(activeTab) && (
        <MasterProtocolManager initialTab={activeTab} userAddress={selectedAccount?.address} />
      )} */}

      {/* NFT Ecosystem — Unified Legion / Franchise / Loan NFT Portal */}
      {activeTab === 'nft-ecosystem' && (
        <NFTEcosystem connectedWallet={wallet.address || undefined} />
      )}

      {activeTab === 'legion' && <LegionNFT />}

      {activeTab === 'franchise' && <FranchiseNFT />}

      {/* {activeTab === 'vesting' && (
        <ClaimPortal
          schedules={props.schedules}
          selectedAccount={props.selectedAccount}
          currentTimestamp={props.currentTimestamp}
          computeVestedAmount={props.computeVestedAmount}
          computeReleasableAmount={props.computeReleasableAmount}
          onClaim={props.onClaim}
          formatUnits={props.formatUnits}
          formatDuration={props.formatDuration}
          paused={props.paused}
        />
      )} */}

      {activeTab === 'referral' && <ReferralSystem />}

      {activeTab === 'credit' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400" /> Credit Score
          </h2>
          <p className="text-sm text-slate-400">Credit scoring is not available on the current local deployment. The deployed ReputationNFT can be viewed from NFT Ecosystem when one exists for the connected wallet.</p>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
            <Bell className="w-5 h-5 text-amber-400" /> Notifications
          </h2>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-400">
            Notifications are not available on the current local deployment.
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
            <Settings className="w-5 h-5 text-slate-400" /> Preferences
          </h2>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-400">
            Preferences are not available on the current local deployment.
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
            <User className="w-5 h-5 text-indigo-400" /> Identity & Profile
          </h2>
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-indigo-500 flex items-center justify-center">
              <User className="w-10 h-10 text-slate-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{wallet.address || "Wallet not connected"}</div>
              <div className="text-sm text-emerald-400 font-bold mt-1">KYC Status: {kycStatusLabel}</div>
            </div>
            <button
              onClick={() => window.location.assign('/profile')}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
            >
              Edit Profile
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
