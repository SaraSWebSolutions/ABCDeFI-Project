import React, { useState } from 'react';
import {
  Home,
  Wallet,
  PieChart,
  TrendingUp,
  Layers,
  User,
  Settings,
  Bell,
  Activity,
  ArrowUpRight,
  ChevronRight,
  Rocket,
  Lock,
  AlertTriangle,
  Coins,
  RefreshCcw,
  CalendarClock,
  History,
  Gift,
  Image as ImageIcon,
  ShoppingCart,
  Tag,
  Download,
  ShieldCheck
} from 'lucide-react';

import { PortfolioDashboard } from './PortfolioDashboard';
import { CeFiDashboard } from './CeFiDashboard';
import { TransactionHistory } from './TransactionHistory';
import { NFTEcosystem } from './NFTEcosystem';
import { GuruNFTSystem } from './GuruNFTSystem';
import LegionApp from '../Legion/LegionApp';
import { ICOLaunchpad } from './ICOLaunchpad';
import { ClaimPortal } from './ClaimPortal';
import { ReferralSystem } from './ReferralSystem';
import { AIFinancialAssistant } from './AIFinancialAssistant';
import { FinancialEducation } from './FinancialEducation';
import { ReputationSystem } from './ReputationSystem';
import { ProtocolDashboard } from './ProtocolDashboard';
import { ContractInteractDashboard } from './ContractInteractDashboard';
import { MasterProtocolManager } from './MasterProtocolManager';
import { NFTSubModuleManager } from './NFTSubModuleManager';
import { FranchiseSubModuleManager } from './FranchiseSubModuleManager';
import P2PLendingDashboard from './P2PLendingDashboard';
import LoanManagementPortal from './LoanManagementPortal';
import NextGenProtocolDashboard from './NextGenProtocolDashboard';
import Web3ActionModal from './Web3ActionModal';
import { useWallet } from '../Context/WalletContext';
import { Web3WalletConnectModal } from './Web3WalletConnectModal';

export interface MobileUserDashboardProps {
  schedules: any[];
  selectedAccount: any;
  currentTimestamp: number;
  computeVestedAmount: (sch: any, ts: number) => bigint;
  computeReleasableAmount: (sch: any, ts: number) => bigint;
  onClaim: (scheduleId: string) => void;
  formatUnits: (amt: bigint) => string;
  formatDuration: (sec: number) => string;
  paused: boolean;
}

export const MobileUserDashboard: React.FC<MobileUserDashboardProps> = (props) => {
  const { selectedAccount } = props;
  const wallet = useWallet();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [kycStatus, setKycStatus] = useState<string>('pending');
  const [claimableYield, setClaimableYield] = useState<number>(1450.25);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const addToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleClaimRewardsSubmit = () => {
    triggerUserAction(
      'Claim All Rewards',
      'StakingPoolV2',
      'claimAllRewards',
      `${claimableYield.toLocaleString()} ABCD`,
      '🎁',
      () => {
        setClaimableYield(0);
        setCooldownSeconds(20);
      }
    );
  };

  React.useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (cooldownSeconds === 0 && claimableYield === 0) {
      setClaimableYield(1450.25);
    }
  }, [cooldownSeconds, claimableYield]);

  // Web3 Action Modal State
  const [web3ModalState, setWeb3ModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    contractName: string;
    methodName: string;
    amountLabel: string;
    amountValue: string;
    params: { label: string; value: string }[];
    icon: string;
    onExecute: () => Promise<void> | void;
    onSuccessMutation: () => void;
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    contractName: '',
    methodName: '',
    amountLabel: '',
    amountValue: '',
    params: [],
    icon: '⚡',
    onExecute: () => { },
    onSuccessMutation: () => { },
  });

  const triggerUserAction = (title: string, contract: string, method: string, amount: string, icon: string = '⚡', mutation?: () => void) => {
    setWeb3ModalState({
      isOpen: true,
      title: `Execute ${title}`,
      subtitle: `Smart Contract Execution — ${title}`,
      contractName: contract,
      methodName: method,
      amountLabel: 'Amount / Value',
      amountValue: amount,
      params: [
        { label: 'Connected Wallet', value: wallet.address || selectedAccount?.address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
        { label: 'Network', value: wallet.networkName || 'BNB Smart Chain Testnet' },
      ],
      icon,
      onExecute: async () => {
        try {
          const { getSigner } = await import('../Services/wallet');
          const { CONTRACTS } = await import('../Config/contracts');
          const { parseEther, Contract } = await import('ethers');
          const signer = await getSigner();
          const amtEth = (parseFloat(amount.replace(/[^0-9.]/g, '')) / 600 || 0.005).toFixed(4);
          const tx = await signer.sendTransaction({ to: CONTRACTS.token, value: parseEther(amtEth > '0' ? amtEth : '0.005') });
          await tx.wait();
        } catch (err) {
          console.warn('On-chain tx failed or rejected:', err);
        }
      },
      onSuccessMutation: () => {
        if (mutation) mutation();
      },
    });
  };

  React.useEffect(() => {
    const fetchStatus = () => {
      try {
        const address = selectedAccount?.address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
        const status = localStorage.getItem(`kyc_${address}`) || 'approved';
        setKycStatus(status === 'rejected' ? 'rejected' : 'approved');
      } catch (err) {
        console.error("Failed to fetch KYC Status", err);
        setKycStatus('approved');
      }
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 1500);
    return () => clearInterval(intervalId);
  }, [selectedAccount]);

  // Main bottom navigation tabs
  const MAIN_TABS = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'all', label: 'All', icon: Activity },
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'finance', label: 'Finance', icon: TrendingUp },
    { id: 'nft', label: 'NFTs', icon: Layers },
    // { id: 'profile', label: 'Profile', icon: User },
  ];

  // Sub-tabs for each main section
  const SUB_TABS = {
    home: [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'wallet', label: 'Wallet', icon: Wallet },
      // { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
    all: [
      { id: 'overview', label: 'All Features', icon: Activity },
    ],
    portfolio: [
      { id: 'my-portfolio', label: 'My Portfolio', icon: PieChart },
    ],
    finance: [
      { id: 'deposit', label: 'Deposit / Withdraw', icon: ArrowUpRight },
      { id: 'borrow', label: 'Borrow', icon: Coins },
      // { id: 'repay', label: 'Repay', icon: RefreshCcw },
      { id: 'loans', label: 'Loans', icon: Coins },
      { id: 'lending', label: 'Lending', icon: Coins },
      { id: 'history', label: 'History', icon: History },
    ],
    nft: [
      { id: 'collection', label: 'Collection', icon: Layers },
      { id: 'buy', label: 'Buy', icon: ShoppingCart },
      { id: 'sell', label: 'Sell', icon: Tag },
      { id: 'legion', label: 'Legion', icon: Layers },
      { id: 'franchise', label: 'Franchise', icon: Layers },
    ],
    // profile: [
    //   { id: 'settings', label: 'Settings', icon: Settings },
    //   { id: 'kyc', label: 'KYC', icon: ShieldCheck },
    //   { id: 'support', label: 'Support', icon: Bell },
    // ],
  };

  const currentSubTabs = SUB_TABS[activeTab as keyof typeof SUB_TABS] || [];

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        switch (activeSubTab) {
          case 'overview':
            return (
              <div className="space-y-4 pb-20">
                <NextGenProtocolDashboard userAddress={selectedAccount?.address} />
              </div>
            );
          case 'wallet':
            return <div className="p-4 pb-20"><WalletPlaceholder /></div>;
          // case 'notifications':
          //   return <div className="p-4 pb-20"><Bell /></div>;
          default:
            return <div className="p-4 pb-20 text-slate-400">Coming soon...</div>;
        }

      case 'all':
        switch (activeSubTab) {
          case 'overview':
            return (
              <div className="space-y-4 pb-20">
                <h2 className="text-white font-bold text-lg">All Available Features</h2>
                
                {/* Portfolio Section */}
                <div className="bg-slate-800/50 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-400" /> Portfolio
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'my-portfolio', label: 'My Portfolio', icon: PieChart },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab('portfolio'); setActiveSubTab(item.id); }}
                        className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition"
                      >
                        <item.icon className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Finance Section */}
                <div className="bg-slate-800/50 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> Finance
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'deposit', label: 'Deposit / Withdraw', icon: ArrowUpRight },
                      { id: 'borrow', label: 'Borrow', icon: Coins },
                      { id: 'repay', label: 'Repay', icon: RefreshCcw },
                      { id: 'loans', label: 'Loans', icon: Coins },
                      { id: 'lending', label: 'Lending', icon: Coins },
                      { id: 'history', label: 'History', icon: History },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab('finance'); setActiveSubTab(item.id); }}
                        className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition"
                      >
                        <item.icon className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* NFT Section */}
                {/* <div className="bg-slate-800/50 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" /> NFTs
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'franchise', label: 'Franchise', icon: Layers },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab('nft'); setActiveSubTab(item.id); }}
                        className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition"
                      >
                        <item.icon className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ICO Section */}
                {/* <div className="bg-slate-800/50 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-amber-400" /> ICO
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'overview', label: 'ICO Overview', icon: Rocket, isIco: true },
                      { id: 'participate', label: 'Participate', icon: ArrowUpRight, isIco: true },
                      { id: 'vesting', label: 'Vesting', icon: Download, isIco: true },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.isIco) {
                            // Handle ICO specially - show ICO content inline
                            setActiveSubTab(item.id);
                          } else {
                            setActiveTab('nft'); setActiveSubTab(item.id);
                          }
                        }}
                        className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition"
                      >
                        <item.icon className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div> */}

                {/* Show inline ICO content if selected */}
                {/* {activeSubTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-4 shadow-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Rocket className="w-8 h-8 text-white" />
                        <div>
                          <h2 className="text-xl font-bold text-white">ABCDeFi ICO</h2>
                          <p className="text-indigo-200 text-xs">Token Sale Event</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="bg-white/20 rounded-xl p-3">
                          <p className="text-indigo-200 text-[10px]">Total Raised</p>
                          <p className="text-white font-bold text-sm">$2.4M</p>
                        </div>
                        <div className="bg-white/20 rounded-xl p-3">
                          <p className="text-indigo-200 text-[10px]">Progress</p>
                          <p className="text-white font-bold text-sm">68%</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveSubTab('participate')}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition cursor-pointer shadow-lg shadow-indigo-600/30"
                    >
                      Participate in ICO
                    </button>
                  </div>
                )}

                {activeSubTab === 'participate' && (
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-2xl p-4">
                      <h3 className="text-white font-semibold mb-3 text-sm">Buy ABCD Tokens</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Amount (USDC)</label>
                          <input
                            type="number"
                            placeholder="Enter amount"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                          />
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">You will receive</span>
                            <span className="text-white font-medium">0 ABCD</span>
                          </div>
                        </div>
                        <button
                          onClick={() => addToast('ICO participation successful!', 'success')}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition cursor-pointer"
                        >
                          Purchase ABCD Tokens
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === 'vesting' && (
                  <div className="pb-20"><ClaimPortal {...props} /></div>
                )} */}
              </div>
            );
          default:
            return <div className="p-4 pb-20 text-slate-400">Coming soon...</div>;
        }

      case 'portfolio':
        switch (activeSubTab) {
          case 'my-portfolio':
            return <div className="pb-20"><PortfolioDashboard {...props} /></div>;
          // case 'staking':
          //   return <div className="pb-20"><ProtocolDashboard {...props} /></div>;
          // case 'rewards':
          //   return <div className="pb-20"><ClaimPortal {...props} /></div>;
          default:
            return <div className="p-4 pb-20 text-slate-400">Coming soon...</div>;
        }

      case 'finance':
        switch (activeSubTab) {
          case 'deposit':
          case 'withdraw':
          case 'borrow':
          case 'repay':
            return <div className="pb-20"><P2PLendingDashboard activeTab={activeSubTab} /></div>;
          case 'loans':
            return <div className="pb-20"><LoanManagementPortal /></div>;
          case 'lending':
            return <div className="pb-20"><P2PLendingDashboard activeTab={activeSubTab} /></div>;
          case 'history':
            return <div className="pb-20"><TransactionHistory /></div>;
          default:
            return <div className="p-4 pb-20 text-slate-400">Coming soon...</div>;
        }

      case 'nft':
        switch (activeSubTab) {
          case 'collection':
            return <div className="pb-20"><NFTEcosystem /></div>;
          case 'buy':
          case 'sell':
            return <div className="pb-20"><GuruNFTSystem /></div>;
          case 'legion':
            return <div className="pb-20"><LegionApp /></div>;
          case 'franchise':
            return <div className="pb-20"><FranchiseSubModuleManager tab={activeSubTab} /></div>;
          default:
            return <div className="p-4 pb-20 text-slate-400">Coming soon...</div>;
        }

      // case 'profile':
      //   switch (activeSubTab) {
      //     case 'settings':
      //       return <div className="pb-20"><SettingsPlaceholder /></div>;
      //     case 'kyc':
      //       return <div className="pb-20"><ShieldCheck /></div>;
      //     case 'support':
      //       return <div className="pb-20"><Bell /></div>;
      //     default:
      //       return <div className="p-4 pb-20 text-slate-400">Coming soon...</div>;
      //   }

      default:
        return <div className="p-4 pb-20 text-slate-400">Select a tab</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-xl border-b border-indigo-500/20 sticky top-0 z-40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">ABCDeFi</h1>
              {wallet.isConnected ? (
                <p className="text-emerald-400 text-[10px] font-bold">
                  ● {wallet.address?.substring(0, 6)}...{wallet.address?.substring(wallet.address.length - 4)} • {wallet.balanceBNB === null ? 'Unavailable' : `${wallet.balanceBNB} ETH`}
                </p>
              ) : (
                <p className="text-slate-400 text-[10px]">Wallet Not Connected</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wallet.isConnected ? (
              <button
                onClick={() => wallet.loginWithSignature()}
                className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg"
              >
                🔑 Login
              </button>
            ) : (
              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="px-3 py-1.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-lg"
              >
                🦊 Connect
              </button>
            )}
            <button className="p-2 bg-slate-800 rounded-lg">
              <Bell className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </div>

      <Web3WalletConnectModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-4 right-4 z-50 animate-in fade-in slide-in-from-top-5 duration-200">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-slate-900 border-emerald-500 text-emerald-300 shadow-emerald-950/50'
              : 'bg-slate-900 border-red-500 text-red-300 shadow-red-950/50'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sub-tab Navigation */}
      {currentSubTabs.length > 0 && (
        <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {currentSubTabs.map((tab) => {
              const IconComp = tab.icon;
              const isSelected = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-4 py-4">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-1 py-2 z-50">
        <div className="flex justify-around items-center">
          {MAIN_TABS.map((tab) => {
            const IconComp = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setActiveSubTab(SUB_TABS[tab.id as keyof typeof SUB_TABS]?.[0]?.id || 'overview');
                }}
                className={`flex flex-col items-center gap-1 px-1.5 py-2 rounded-xl transition ${
                  isSelected
                    ? 'text-indigo-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <IconComp className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : ''}`} />
                <span className="text-[8px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Web3 Action Modal */}
      {web3ModalState.isOpen && (
        <Web3ActionModal
          isOpen={web3ModalState.isOpen}
          onClose={() => setWeb3ModalState({ ...web3ModalState, isOpen: false })}
          title={web3ModalState.title}
          subtitle={web3ModalState.subtitle}
          contractName={web3ModalState.contractName}
          methodName={web3ModalState.methodName}
          amountLabel={web3ModalState.amountLabel}
          amountValue={web3ModalState.amountValue}
          params={web3ModalState.params}
          icon={web3ModalState.icon}
          onExecute={web3ModalState.onExecute}
          onSuccessMutation={web3ModalState.onSuccessMutation}
        />
      )}
    </div>
  );
};

// Placeholder components for missing imports
const WalletPlaceholder = () => <div className="text-slate-400">Wallet component</div>;
const SettingsPlaceholder = () => <div className="text-slate-400">Settings component</div>;
