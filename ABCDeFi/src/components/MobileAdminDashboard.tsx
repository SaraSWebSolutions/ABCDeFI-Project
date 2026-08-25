import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Users,
  DollarSign,
  Activity,
  Bell,
  Search,
  RefreshCw,
  Home,
  BarChart3,
  FileText,
  Settings,
  Lock,
  AlertTriangle,
  CheckCircle2,
  X,
  Building2
} from 'lucide-react';
import mockApiStore, { TransactionRecord } from '../Services/mockApiStore';
import ToastContainer, { ToastMessage } from './ToastContainer';
import Web3ActionModal from './Web3ActionModal';
import AdminSecurityConfirmationModal from './AdminSecurityConfirmationModal';

export interface AdminUserRole {
  role: 'Super Admin' | 'Admin' | 'KYC Officer' | 'Support' | 'Finance';
  email: string;
  name: string;
}

export const MobileAdminDashboard: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentRole, setCurrentRole] = useState<AdminUserRole>({
    role: 'Super Admin',
    email: 'admin@abcdefi.com',
    name: 'Chief Security Officer',
  });

  // Active Route State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeSubTab, setActiveSubTab] = useState<string>('overview');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // REST API Auto-Polling State
  const [apiData, setApiData] = useState(mockApiStore.getAdminDashboardApi());
  const [healthData, setHealthData] = useState(mockApiStore.getSystemHealthApi());

  // Interactive Modals & Drawers State
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [selectedKycDetail, setSelectedKycDetail] = useState<any | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  // Security Override Modal State
  const [secModalState, setSecModalState] = useState<{
    isOpen: boolean;
    actionTitle: string;
    targetDescription: string;
    onConfirm: (reason: string) => void;
  }>({
    isOpen: false,
    actionTitle: '',
    targetDescription: '',
    onConfirm: () => {},
  });

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
    icon: '🛡️',
    onExecute: () => {},
    onSuccessMutation: () => {},
  });

  // Stateful Admin Data Sets
  const [usersList, setUsersList] = useState([
    { id: 'USR-9001', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', email: 'dinesh@gmail.com', kyc: 'Approved', status: 'Active', deposits: '$48,200', borrowed: '$8,400', riskScore: 'Low (12/100)', country: 'India 🇮🇳' },
    { id: 'USR-9005', address: '0x8f3C70997970C51812dc3A010C7d01b50e0d17dc', email: 'vikram.reddy@gmail.com', kyc: 'Approved', status: 'Active', deposits: '$65,000', borrowed: '$0', riskScore: 'Low (8/100)', country: 'India 🇮🇳' },
    { id: 'USR-9002', address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', email: 'sarah.jenkins@gmail.com', kyc: 'Pending Review', status: 'Active', deposits: '$12,500', borrowed: '$0', riskScore: 'Low (18/100)', country: 'USA 🇺🇸' },
  ]);

  const [kycQueueList, setKycQueueList] = useState([
    { id: 'KYC-701', user: 'Sarah Jenkins', email: 'sarah@abcdefi.com', docType: 'Aadhaar Card + Selfie', risk: 'Low', status: 'Pending Review' },
    { id: 'KYC-702', user: 'Rajesh Sharma', email: 'rajesh@abcdefi.com', docType: 'Passport', risk: 'High', status: 'Rejected' },
  ]);

  // Auto-poll API data every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setApiData(mockApiStore.getAdminDashboardApi());
      setHealthData(mockApiStore.getSystemHealthApi());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const newToast: ToastMessage = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 5000);
  };

  // Main bottom navigation tabs
  const MAIN_TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'kyc', label: 'KYC', icon: ShieldCheck },
    { id: 'finance', label: 'Finance', icon: DollarSign },
    // { id: 'franchise', label: 'Franchise', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Sub-tabs for each main section
  const SUB_TABS = {
    dashboard: [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'transactions', label: 'Transactions', icon: FileText },
    ],
    users: [
      { id: 'all-users', label: 'All Users', icon: Users },
      { id: 'active', label: 'Active', icon: CheckCircle2 },
      { id: 'suspended', label: 'Suspended', icon: X },
    ],
    kyc: [
      { id: 'pending', label: 'Pending', icon: Bell },
      { id: 'approved', label: 'Approved', icon: CheckCircle2 },
      { id: 'rejected', label: 'Rejected', icon: X },
    ],
    finance: [
      { id: 'overview', label: 'Overview', icon: DollarSign },
      { id: 'loans', label: 'Loans', icon: DollarSign },
      { id: 'lending', label: 'Lending', icon: DollarSign },
      { id: 'revenue', label: 'Revenue', icon: BarChart3 },
    ],
    // franchise: [
    //   { id: 'overview', label: 'Overview', icon: Building2 },
    //   { id: 'operators', label: 'Operators', icon: Users },
    //   { id: 'revenue', label: 'Revenue Share', icon: DollarSign },
    //   { id: 'audit', label: 'Audit', icon: FileText },
    // ],
    settings: [
      { id: 'platform', label: 'Platform', icon: Settings },
      { id: 'security', label: 'Security', icon: Lock },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  };

  const currentSubTabs = SUB_TABS[activeTab as keyof typeof SUB_TABS] || [];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        switch (activeSubTab) {
          case 'overview':
            return (
              <div className="space-y-4 pb-20">
                {/* Header Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-4 shadow-xl">
                    <DollarSign className="w-6 h-6 text-indigo-200 mb-2" />
                    <p className="text-indigo-200 text-xs font-medium">Total TVL</p>
                    <h3 className="text-xl font-bold text-white">${apiData.tvl.toLocaleString()}</h3>
                    <p className="text-emerald-300 text-xs font-semibold">+12.4%</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 shadow-xl">
                    <Users className="w-6 h-6 text-emerald-200 mb-2" />
                    <p className="text-emerald-200 text-xs font-medium">Total Users</p>
                    <h3 className="text-xl font-bold text-white">{apiData.totalUsers.toLocaleString()}</h3>
                    <p className="text-emerald-300 text-xs font-semibold">+8.2%</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl p-4 shadow-xl">
                    <Activity className="w-6 h-6 text-amber-200 mb-2" />
                    <p className="text-amber-200 text-xs font-medium">24h Volume</p>
                    <h3 className="text-xl font-bold text-white">${apiData.volume24h.toLocaleString()}</h3>
                    <p className="text-emerald-300 text-xs font-semibold">+15.8%</p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-600 to-pink-700 rounded-2xl p-4 shadow-xl">
                    <ShieldCheck className="w-6 h-6 text-rose-200 mb-2" />
                    <p className="text-rose-200 text-xs font-medium">System Health</p>
                    <h3 className="text-xl font-bold text-white">{healthData.healthScore}%</h3>
                    <p className="text-emerald-300 text-xs font-semibold">Excellent</p>
                  </div>
                </div>

                {/* System Status */}
                <div className="bg-slate-800/50 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm">System Status</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'API Server', status: 'Operational', color: 'bg-emerald-500' },
                      { label: 'Blockchain Node', status: 'Synced', color: 'bg-emerald-500' },
                      { label: 'Database', status: 'Healthy', color: 'bg-emerald-500' },
                      { label: 'Smart Contracts', status: 'Deployed', color: 'bg-emerald-500' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-slate-300 text-xs">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.color} animate-pulse`}></span>
                          <span className="text-emerald-400 text-xs font-medium">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Alerts */}
                <div className="bg-slate-800/50 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm">Recent Alerts</h3>
                  <div className="space-y-3">
                    {[
                      { type: 'warning', msg: 'High gas prices detected on Ethereum', time: '5m ago' },
                      { type: 'info', msg: 'New user registration spike detected', time: '15m ago' },
                      { type: 'success', msg: 'System backup completed successfully', time: '1h ago' },
                    ].map((alert, idx) => (
                      <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl ${
                        alert.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                        alert.type === 'info' ? 'bg-blue-500/10 border border-blue-500/20' :
                        'bg-emerald-500/10 border border-emerald-500/20'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                          alert.type === 'warning' ? 'text-amber-400' :
                          alert.type === 'info' ? 'text-blue-400' :
                          'text-emerald-400'
                        }`} />
                        <div className="flex-1">
                          <p className="text-white text-xs font-medium">{alert.msg}</p>
                          <p className="text-slate-400 text-[10px] mt-1">{alert.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          case 'analytics':
            return <div className="p-4 pb-20 text-slate-400">Analytics dashboard coming soon...</div>;
          case 'transactions':
            return <div className="p-4 pb-20 text-slate-400">Transaction history coming soon...</div>;
          default:
            return <div className="p-4 pb-20 text-slate-400">Coming soon...</div>;
        }

      case 'users':
        return (
          <div className="space-y-4 pb-20">
            <div className="bg-slate-800/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-white text-sm flex-1 outline-none placeholder-slate-500"
                />
              </div>
              <div className="space-y-3">
                {usersList.map((user) => (
                  <div key={user.id} className="bg-slate-700/50 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-white font-medium text-sm">{user.email}</p>
                        <p className="text-slate-400 text-[10px]">{user.address}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                        user.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {user.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Deposits: {user.deposits}</span>
                      <span>KYC: {user.kyc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'kyc':
        return (
          <div className="space-y-4 pb-20">
            <div className="bg-slate-800/50 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-3 text-sm">KYC Queue</h3>
              <div className="space-y-3">
                {kycQueueList.map((kyc) => (
                  <div key={kyc.id} className="bg-slate-700/50 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-white font-medium text-sm">{kyc.user}</p>
                        <p className="text-slate-400 text-[10px]">{kyc.email}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                        kyc.status === 'Pending Review' ? 'bg-amber-500/20 text-amber-400' :
                        kyc.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {kyc.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Doc: {kyc.docType}</span>
                      <span>Risk: {kyc.risk}</span>
                    </div>
                    {kyc.status === 'Pending Review' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => addToast(`KYC Approved for ${kyc.user}`, 'success')}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => addToast(`KYC Rejected for ${kyc.user}`, 'error')}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'finance':
        return (
          <div className="space-y-4 pb-20">
            <div className="bg-slate-800/50 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-3 text-sm">Financial Overview</h3>
              <div className="space-y-3">
                <div className="bg-slate-700/50 rounded-xl p-3">
                  <p className="text-slate-400 text-xs">Total Revenue</p>
                  <p className="text-white font-bold text-lg">$1,245,000</p>
                  <p className="text-emerald-400 text-xs">+18.2% this month</p>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-3">
                  <p className="text-slate-400 text-xs">Active Loans</p>
                  <p className="text-white font-bold text-lg">234</p>
                  <p className="text-emerald-400 text-xs">12 pending approval</p>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-3">
                  <p className="text-slate-400 text-xs">Default Rate</p>
                  <p className="text-white font-bold text-lg">2.4%</p>
                  <p className="text-emerald-400 text-xs">Below industry average</p>
                </div>
              </div>
            </div>
          </div>
        );

      // case 'franchise':
      //   return (
      //     <div className="space-y-4 pb-20">
      //       <div className="bg-slate-800/50 rounded-2xl p-4">
      //         <h3 className="text-white font-semibold mb-3 text-sm">Franchise Overview</h3>
      //         <div className="space-y-3">
      //           <div className="bg-slate-700/50 rounded-xl p-3">
      //             <p className="text-slate-400 text-xs">Total Franchises</p>
      //             <p className="text-white font-bold text-lg">156</p>
      //             <p className="text-emerald-400 text-xs">+12 new this month</p>
      //           </div>
      //           <div className="bg-slate-700/50 rounded-xl p-3">
      //             <p className="text-slate-400 text-xs">Active Operators</p>
      //             <p className="text-white font-bold text-lg">89</p>
      //             <p className="text-emerald-400 text-xs">95% compliance rate</p>
      //           </div>
      //           <div className="bg-slate-700/50 rounded-xl p-3">
      //             <p className="text-slate-400 text-xs">Revenue Share</p>
      //             <p className="text-white font-bold text-lg">$342,000</p>
      //             <p className="text-emerald-400 text-xs">+8.5% this quarter</p>
      //           </div>
      //         </div>
      //       </div>
      //       <div className="bg-slate-800/50 rounded-2xl p-4">
      //         <h3 className="text-white font-semibold mb-3 text-sm">Recent Franchise Applications</h3>
      //         <div className="space-y-3">
      //           {[
      //             { name: 'Cyberabad Node #1', location: 'Hyderabad, India', status: 'Approved' },
      //             { name: 'Mumbai Regional Hub', location: 'Mumbai, India', status: 'Pending' },
      //             { name: 'Dubai Financial Center', location: 'Dubai, UAE', status: 'Under Review' },
      //           ].map((franchise, idx) => (
      //             <div key={idx} className="bg-slate-700/50 rounded-xl p-3">
      //               <div className="flex justify-between items-start mb-2">
      //                 <div>
      //                   <p className="text-white font-medium text-sm">{franchise.name}</p>
      //                   <p className="text-slate-400 text-[10px]">{franchise.location}</p>
      //                 </div>
      //                 <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
      //                   franchise.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' :
      //                   franchise.status === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
      //                   'bg-blue-500/20 text-blue-400'
      //                 }`}>
      //                   {franchise.status}
      //                 </span>
      //               </div>
      //             </div>
      //           ))}
      //         </div>
      //       </div>
      //     </div>
      //   );

      case 'settings':
        return (
          <div className="space-y-4 pb-20">
            <div className="bg-slate-800/50 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-3 text-sm">Platform Settings</h3>
              <div className="space-y-3">
                {[
                  { label: 'Platform Fee', value: '0.25%' },
                  { label: 'Lending Interest', value: '4.50%' },
                  { label: 'Borrow Interest', value: '8.50%' },
                  { label: 'Max Withdrawal', value: '$50,000' },
                ].map((setting, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-700/50 rounded-xl p-3">
                    <span className="text-slate-300 text-xs">{setting.label}</span>
                    <span className="text-white font-medium text-sm">{setting.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-3 text-sm">Security Settings</h3>
              <button
                onClick={() => addToast('Security settings updated', 'success')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition"
              >
                Update Security Protocols
              </button>
            </div>
          </div>
        );

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
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Admin Portal</h1>
              <p className="text-slate-400 text-[10px]">{currentRole.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-slate-800 rounded-lg">
              <Bell className="w-4 h-4 text-slate-300" />
            </button>
            <button className="p-2 bg-slate-800 rounded-lg">
              <RefreshCw className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </div>

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
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition ${
                  isSelected
                    ? 'text-indigo-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <IconComp className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : ''}`} />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

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

      {/* Security Confirmation Modal */}
      {secModalState.isOpen && (
        <AdminSecurityConfirmationModal
          isOpen={secModalState.isOpen}
          onClose={() => setSecModalState({ ...secModalState, isOpen: false })}
          actionTitle={secModalState.actionTitle}
          targetDescription={secModalState.targetDescription}
          onConfirm={secModalState.onConfirm}
        />
      )}
    </div>
  );
};