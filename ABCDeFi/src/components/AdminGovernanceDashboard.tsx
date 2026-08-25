import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Landmark,
  Coins,
  Activity,
  DollarSign,
  Layers,
  Globe,
  Bot,
  GraduationCap,
  Vote,
  BarChart3,
  FileSpreadsheet,
  Sliders,
  Search,
  Sparkles,
  Loader2,
  Lock,
  Percent,
  Calendar
} from 'lucide-react';
import { INITIAL_AUDIT_TRAIL, AuditRecord } from '../Services/auditTrail';
import { COMMUNITY_PROPOSALS, DAOProposal } from '../Services/governance';
import AdminICODashboard from './AdminICODashboard';
import { AdminPanel } from './AdminPanel';
import Web3ActionModal from './Web3ActionModal';
import { ContractState, UserAccount, VestingSchedule } from '../types';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  kycStatus: 'Approved' | 'Pending' | 'Rejected';
  isFrozen: boolean;
  role: 'User' | 'Admin' | 'VIP';
}

const INITIAL_ADMIN_USERS: AdminUserRecord[] = [
  { id: 'usr-1', name: 'Alex Rivers', email: 'alex.trader@abcdefi.io', walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', kycStatus: 'Approved', isFrozen: false, role: 'VIP' },
  { id: 'usr-2', name: 'Elena Rostova', email: 'elena@abcdefi.io', walletAddress: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC', kycStatus: 'Approved', isFrozen: false, role: 'Admin' },
  { id: 'usr-3', name: 'Liam Vance', email: 'liam.dev@abcdefi.io', walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', kycStatus: 'Pending', isFrozen: false, role: 'User' },
  { id: 'usr-4', name: 'Master Satoshi', email: 'satoshi@abcdefi.io', walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', kycStatus: 'Approved', isFrozen: false, role: 'User' },
];

export interface AdminGovernanceDashboardProps {
  // AdminPanel Vesting Props
  state: ContractState;
  accounts: UserAccount[];
  selectedAccount: UserAccount;
  currentTimestamp: number;
  onCreateSchedule: (beneficiary: string, start: number, cliff: number, duration: number, slicePeriodSeconds: number, revocable: boolean, amount: bigint) => { success: boolean; message: string };
  onDepositTokens: (amount: bigint) => { success: boolean; message: string };
  onRevokeSchedule: (scheduleId: string) => { success: boolean; message: string };
  onTogglePause: () => { success: boolean; message: string };
  computeVestedAmount: (schedule: VestingSchedule, timestamp: number) => bigint;
  computeReleasableAmount: (schedule: VestingSchedule, timestamp?: number) => bigint;
  formatUnits: (amt: bigint) => string;
  formatDuration: (sec: number) => string;
  unallocatedBalance: bigint;
}

export const AdminGovernanceDashboard: React.FC<AdminGovernanceDashboardProps> = (props) => {
  const [activeTab, setActiveTab] = useState<string>('users');
  const [activeSubTab, setActiveSubTab] = useState<string>('View Users');
  const [usersList, setUsersList] = useState<AdminUserRecord[]>(INITIAL_ADMIN_USERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [actionMsg, setActionMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  // KYC Approval Decision Notice State
  const [lastKycActionNotice, setLastKycActionNotice] = useState<{
    type: 'Approved' | 'Rejected';
    userName: string;
    userEmail: string;
    wallet: string;
    txHash: string;
    timestamp: string;
  } | null>(null);

  // System Settings State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [tokenBurnPct, setTokenBurnPct] = useState(2.0);
  const [reservePct, setReservePct] = useState(25.0);

  const ADMIN_MODULES = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'treasury', label: 'Treasury Management', icon: Landmark },
    { id: 'loans', label: 'Loan Management', icon: Activity },
    { id: 'tokens', label: 'Token Management', icon: Coins },
    { id: 'nfts', label: 'NFT Management', icon: Layers },
    // { id: 'franchise', label: 'Franchise Management', icon: Globe },
    // { id: 'ai', label: 'AI Management', icon: Bot },
    // { id: 'education', label: 'Education Management', icon: GraduationCap },
    // { id: 'governance', label: 'Governance', icon: Vote },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'settings', label: 'Platform Settings', icon: Sliders },
  ];

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
    onExecute: () => {},
    onSuccessMutation: () => {},
  });

  const triggerAdminAction = (actionName: string, contract: string, method: string, amount: string = '0.00 ETH', icon: string = '🛡️', mutation?: () => void, customParams: { label: string; value: string }[] = []) => {
    setWeb3ModalState({
      isOpen: true,
      title: `Execute ${actionName}`,
      subtitle: `Protocol Smart Contract Governance Invocation for ${actionName}`,
      contractName: contract,
      methodName: method,
      amountLabel: 'Governance Stake / Fee',
      amountValue: amount,
      params: [
        { label: 'Executor Role', value: 'Admin / Franchise Master' },
        { label: 'Target Action', value: actionName },
        ...customParams,
        { label: 'Execution Network', value: 'Ethereum Sepolia Mainnet' },
      ],
      icon,
      onExecute: async () => {
        await new Promise((r) => setTimeout(r, 600));
      },
      onSuccessMutation: () => {
        if (mutation) mutation();
        setActionMsg(`✓ Successfully executed governance command "${actionName}" on-chain!`);
      },
    });
  };

  const handleFreezeToggle = (userId: string) => {
    const user = usersList.find(u => u.id === userId);
    const actionName = user?.isFrozen ? `Unfreeze Account (${userId})` : `Freeze Account (${userId})`;
    triggerAdminAction(actionName, 'AdminGovernanceHub', 'toggleAccountFreeze', '0.00 ETH', '🔒', () => {
      setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, isFrozen: !u.isFrozen } : u)));
    });
  };

  const handleKycApproval = (userId: string) => {
    const targetUser = usersList.find((u) => u.id === userId);
    if (!targetUser) return;

    triggerAdminAction(
      `Approve KYC Verification for ${targetUser.name}`,
      'UserRegistryVault',
      'approveUserKYC',
      '0.00 ETH',
      '✅',
      () => {
        setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, kycStatus: 'Approved' } : u)));
        localStorage.setItem(`kyc_${targetUser.walletAddress}`, 'approved');
        localStorage.setItem(`kyc_${targetUser.email}`, 'approved');
        const hash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        setLastKycActionNotice({
          type: 'Approved',
          userName: targetUser.name,
          userEmail: targetUser.email,
          wallet: targetUser.walletAddress,
          txHash: hash,
          timestamp: new Date().toLocaleTimeString(),
        });
      },
      [
        { label: 'Applicant Name', value: targetUser.name },
        { label: 'Applicant Email', value: targetUser.email },
        { label: 'Wallet Address', value: targetUser.walletAddress },
        { label: 'Verification Standard', value: 'Sumsub Level-3 Certified Identity' },
        { label: 'Unlocked Access', value: 'Withdrawals, P2P Lending, Borrowing & Banking Bridge' },
      ]
    );
  };

  const handleKycReject = (userId: string) => {
    const targetUser = usersList.find((u) => u.id === userId);
    if (!targetUser) return;

    triggerAdminAction(
      `Reject KYC Application for ${targetUser.name}`,
      'UserRegistryVault',
      'rejectUserKYC',
      '0.00 ETH',
      '✕',
      () => {
        setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, kycStatus: 'Rejected' } : u)));
        const hash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        setLastKycActionNotice({
          type: 'Rejected',
          userName: targetUser.name,
          userEmail: targetUser.email,
          wallet: targetUser.walletAddress,
          txHash: hash,
          timestamp: new Date().toLocaleTimeString(),
        });
      },
      [
        { label: 'Applicant Name', value: targetUser.name },
        { label: 'Applicant Email', value: targetUser.email },
        { label: 'Wallet Address', value: targetUser.walletAddress },
        { label: 'Rejection Reason', value: 'Document Legibility / Verification Resubmission Required' },
      ]
    );
  };

  const filteredUsers = usersList.filter((u) => {
    if (searchTerm && !u.email.toLowerCase().includes(searchTerm.toLowerCase()) && !u.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'All' && u.kycStatus !== statusFilter) return false;
    if (activeSubTab === 'Approve / Reject KYC' && u.kycStatus !== 'Pending') return false;
    return true;
  });

  return (
    <div id="admin-governance-dashboard" className="bg-slate-900/90 backdrop-blur-xl border border-amber-500/25 rounded-3xl p-6 shadow-2xl shadow-amber-950/30 space-y-6 font-mono text-white">
      
      {/* HEADER WITH OFFICIAL ABCDEFI LOGO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <img
            src="/images/abcdefi-logo.svg"
            alt="ABCDeFi Logo"
            className="w-12 h-12 rounded-full shadow-xl shadow-purple-900/50 border-2 border-amber-400/80 shrink-0 object-cover"
          />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 font-mono">
              <span>Protocol Governance</span>
              <span className="text-slate-600">→</span>
              <span>Master Admin Command Portal</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5 mt-0.5 bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-white to-amber-400">
              ABCDeFi Master Protocol Admin Panel
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Institutional-Grade 12-Module Command Center for Protocol Management & Governance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            SUPER_ADMIN (Full Access)
          </span>
        </div>
      </div>

      {/* INSTITUTIONAL ADMIN TELEMETRY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-amber-500/30 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Global Treasury Reserve</div>
          <div className="text-base font-black text-amber-400">$5,320,000 USDC</div>
        </div>
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-orange-500/30 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Deflationary Burn Pool</div>
          <div className="text-base font-black text-orange-400">12,500 ABCD</div>
        </div>
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-indigo-500/30 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Total Platform Users</div>
          <div className="text-base font-black text-indigo-300">4,210 Accounts</div>
        </div>
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-emerald-500/30 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Circuit Breaker</div>
          <div className="text-base font-black text-emerald-400">OPERATIONAL ✅</div>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {actionMsg && (
        <div className="p-4 bg-amber-950/60 backdrop-blur-md border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5 font-semibold">
            {processing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" />}
            <span>{actionMsg}</span>
          </div>
          <button onClick={() => setActionMsg('')} className="text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 rounded-lg hover:bg-amber-900/40">✕</button>
        </div>
      )}

      {/* 12-SECTION MASTER ADMIN NAVIGATION MENU BAR */}
      <div className="bg-slate-950/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-2.5 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
          {ADMIN_MODULES.map((tab) => {
            const IconComp = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'users') setActiveSubTab('View Users');
                  else if (tab.id === 'treasury') setActiveSubTab('Treasury Balance');
                  else if (tab.id === 'loans') setActiveSubTab('View All Loans');
                  else if (tab.id === 'tokens') setActiveSubTab('ICO Management');
                  else if (tab.id === 'settings') setActiveSubTab('Contract Settings');
                  else setActiveSubTab('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 scale-[1.03] border border-amber-200'
                    : 'bg-slate-950/90 text-slate-400 hover:text-white hover:bg-slate-800/90 border border-slate-800/80'
                }`}
              >
                <IconComp className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. USER MANAGEMENT                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Sub-menu mapping */}
          <div className="flex flex-wrap gap-2">
            {['View Users', 'Approve / Reject KYC', 'Freeze / Unfreeze', 'Verify Identity', 'User Activity'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {activeSubTab === 'View Users' && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <span className="text-xs text-slate-400">{filteredUsers.length} Users Found</span>
              </div>
              <div className="space-y-3 text-xs">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{u.name}</span>
                        <span className="text-[10px] text-slate-500">({u.email})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Wallet: {u.walletAddress}</div>
                      <div className="text-[10px] mt-1 flex items-center gap-2">
                        <span className="text-slate-500">KYC Status:</span>
                        <span className={u.kycStatus === 'Approved' ? 'text-emerald-400' : 'text-amber-400 font-bold'}>{u.kycStatus}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSubTab === 'Approve / Reject KYC' && (
            <div className="space-y-4 text-xs font-mono">
              <h3 className="text-sm font-bold text-white uppercase border-b border-slate-800 pb-2 mb-3">Pending KYC Applications Matrix</h3>

              {/* KYC DECISION RESPONSE NOTICE BOX */}
              {lastKycActionNotice && (
                <div
                  className={`p-5 rounded-2xl border ${
                    lastKycActionNotice.type === 'Approved'
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  } space-y-2 animate-in fade-in duration-300 shadow-xl`}
                >
                  <div className="flex items-center justify-between font-bold border-b border-slate-800/80 pb-2">
                    <span className="flex items-center gap-2 text-sm">
                      {lastKycActionNotice.type === 'Approved' ? '✅ KYC Verification Approved & Unlocked' : '✕ KYC Verification Application Rejected'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Tx Time: {lastKycActionNotice.timestamp}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-400">User Account:</span> <strong className="text-white">{lastKycActionNotice.userName}</strong> ({lastKycActionNotice.userEmail})
                    </div>
                    <div>
                      <span className="text-slate-400">Wallet Address:</span> <span className="font-mono text-slate-300">{lastKycActionNotice.wallet}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Status Update:</span>{' '}
                      <strong className={lastKycActionNotice.type === 'Approved' ? 'text-emerald-400' : 'text-rose-400'}>
                        {lastKycActionNotice.type === 'Approved' ? 'KYC Status: Approved ✅' : 'KYC Status: Rejected ✕'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">On-Chain Tx Hash:</span> <span className="font-mono text-indigo-400 text-[10px]">{lastKycActionNotice.txHash}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 pt-2 border-t border-slate-800/60">
                    {lastKycActionNotice.type === 'Approved'
                      ? `✓ Successfully approved identity for ${lastKycActionNotice.userName}. All platform withdrawal limits, P2P lending, borrowing, and fiat banking features are now unlocked for wallet ${lastKycActionNotice.wallet}.`
                      : `✕ KYC application rejected for ${lastKycActionNotice.userName}. User notified to re-submit identity verification documents.`}
                  </p>
                </div>
              )}

              {filteredUsers.filter(u => u.kycStatus === 'Pending').length === 0 ? (
                <div className="text-center text-slate-500 py-8 bg-slate-950 rounded-2xl border border-slate-800">
                  <ShieldCheck className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                  <div className="font-bold text-white text-xs">All KYC Applications Processed</div>
                  <div className="text-[10px] text-slate-500 mt-1">There are no pending identity verification reviews in queue.</div>
                </div>
              ) : (
                filteredUsers.filter(u => u.kycStatus === 'Pending').map((u) => (
                  <div key={u.id} className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl flex items-center justify-between transition">
                    <div>
                      <div className="font-bold text-white">{u.name} <span className="text-slate-500 font-normal">({u.email})</span></div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Wallet: {u.walletAddress}</div>
                      <div className="text-[10px] mt-1 text-amber-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        KYC Documents Submitted (Sumsub Level-3 Pending Review)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleKycApproval(u.id)} disabled={processing} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center gap-1">
                        <span>Approve KYC ✓</span>
                      </button>
                      <button onClick={() => handleKycReject(u.id)} disabled={processing} className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center gap-1">
                        <span>Reject ✕</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSubTab === 'Freeze / Unfreeze' && (
            <div className="space-y-3 text-xs">
              <h3 className="text-sm font-bold text-white uppercase border-b border-slate-800 pb-2 mb-3">Account Status Control</h3>
              {filteredUsers.map((u) => (
                <div key={u.id} className={`p-4 bg-slate-950 border ${u.isFrozen ? 'border-rose-500/30 bg-rose-950/20' : 'border-slate-800'} rounded-2xl flex items-center justify-between`}>
                  <div>
                    <div className="font-bold text-white">{u.name} <span className="text-slate-500 font-normal">({u.email})</span></div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Wallet: {u.walletAddress}</div>
                    {u.isFrozen && <div className="text-[10px] mt-1 font-bold text-rose-400">⚠️ Account Frozen</div>}
                  </div>
                  <button onClick={() => handleFreezeToggle(u.id)} disabled={processing} className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${u.isFrozen ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}>
                    {u.isFrozen ? 'Unfreeze Account' : 'Freeze Account'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'Verify Identity' && (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
              <ShieldCheck className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">Identity Verification</h2>
              <p>Manual third-party identity verification module integration goes here.</p>
            </div>
          )}

          {activeSubTab === 'User Activity' && (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
              <Activity className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">User Activity Logs</h2>
              <p>Search and review detailed on-chain and off-chain user actions.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TREASURY MANAGEMENT                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'treasury' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['Treasury Balance', 'Reserve Balance', 'Interest Pool', 'Burn Pool', 'Treasury Reports'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {activeSubTab === 'Treasury Balance' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4 font-mono">
              <div className="text-slate-400 font-bold uppercase text-xs border-b border-slate-800 pb-2">Main Treasury (Stablecoins & ETH)</div>
              <div className="text-3xl font-black text-white">$5,100,000.00 <span className="text-lg text-slate-500">USDC</span></div>
              <div className="text-sm text-emerald-400">↑ $120,450 (2.4%) this month</div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-4">
                <button
                  onClick={() =>
                    triggerAdminAction(
                      'Deposit to Treasury',
                      'TreasuryVault',
                      'depositTreasuryFunds',
                      '50,000 USDC',
                      '🏦',
                      () => setActionMsg('✓ Deposited 50,000 USDC into Protocol Main Treasury Vault!')
                    )
                  }
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                  <span>Deposit to Treasury 🏦</span>
                </button>
                <button
                  onClick={() =>
                    triggerAdminAction(
                      'Emergency Treasury Withdraw',
                      'TreasuryVault',
                      'emergencyWithdrawal',
                      '10,000 USDC',
                      '🚨',
                      () => setActionMsg('✓ Emergency Withdrawal Executed from Main Treasury!')
                    )
                  }
                  className="px-4 py-2.5 bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 border border-rose-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2"
                >
                  <span>Emergency Withdraw 🚨</span>
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'Reserve Balance' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4 font-mono">
              <div className="text-slate-400 font-bold uppercase text-xs border-b border-slate-800 pb-2">Protocol Insurance Reserve</div>
              <div className="text-3xl font-black text-emerald-400">$2,800,000.00 <span className="text-lg text-emerald-700">USDC</span></div>
              <p className="text-sm text-slate-400 max-w-md">Reserves are held in yield-bearing stablecoins to cover potential protocol bad debt and extreme liquidation events.</p>
              <button
                onClick={() =>
                  triggerAdminAction(
                    'Reallocate Insurance Reserves',
                    'TreasuryVault',
                    'reallocateReserves',
                    '100,000 USDC',
                    '🛡️',
                    () => setActionMsg('✓ Insurance Reserves reallocated on-chain!')
                  )
                }
                className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Reallocate Reserves 🛡️
              </button>
            </div>
          )}

          {activeSubTab === 'Interest Pool' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4 font-mono">
              <div className="text-slate-400 font-bold uppercase text-xs border-b border-slate-800 pb-2">Accrued Interest Pool</div>
              <div className="text-3xl font-black text-amber-400">$392,500.00 <span className="text-lg text-amber-700">USDC</span></div>
              <p className="text-sm text-slate-400 max-w-md">This pool collects all borrowing interest and distributes it to lenders and the treasury automatically.</p>
              <button
                onClick={() =>
                  triggerAdminAction(
                    'Distribute Interest Pool',
                    'TreasuryVault',
                    'distributeInterestPool',
                    '$392,500 USDC',
                    '💰',
                    () => setActionMsg('✓ Distributed $392,500 USDC Interest Pool to Lenders & Treasury!')
                  )
                }
                className="px-4 py-2 bg-amber-600/20 text-amber-400 border border-amber-600/50 font-bold rounded-xl text-xs hover:bg-amber-600/30 cursor-pointer shadow-lg shadow-amber-600/10"
              >
                Trigger Distribution 💰
              </button>
            </div>
          )}

          {activeSubTab === 'Burn Pool' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4 font-mono">
              <div className="text-slate-400 font-bold uppercase text-xs border-b border-slate-800 pb-2">ABCD Token Burn Pool</div>
              <div className="text-3xl font-black text-rose-400">45,000.00 <span className="text-lg text-rose-700">ABCD</span></div>
              <p className="text-sm text-slate-400 max-w-md">Tokens accumulated from fees that are waiting to be permanently burned from the supply.</p>
              <button
                onClick={() =>
                  triggerAdminAction(
                    'Execute Deflationary Token Burn',
                    'TreasuryVault',
                    'executeBurn',
                    '45,000 ABCD',
                    '🔥',
                    () => setActionMsg('✓ Permanently burned 45,000 ABCD tokens from circulating supply!')
                  )
                }
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-500 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Execute Burn Now 🔥
              </button>
            </div>
          )}

          {activeSubTab === 'Treasury Reports' && (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-400 min-h-[220px] font-mono space-y-3">
              <FileSpreadsheet className="w-12 h-12 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white">Treasury Audit Reports</h2>
              <p className="text-xs text-center max-w-md text-slate-400">Download comprehensive PDF and CSV treasury audit reports verified on Sepolia EVM.</p>
              <button
                onClick={() =>
                  triggerAdminAction(
                    'Generate Full Treasury Audit PDF',
                    'TreasuryVault',
                    'generateTreasuryReport',
                    '0.00 ETH',
                    '📊',
                    () => setActionMsg('✓ Generated official Treasury Audit PDF Report!')
                  )
                }
                className="px-5 py-2.5 bg-amber-500 text-slate-950 font-black text-xs rounded-xl hover:bg-amber-400 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Generate Treasury Report 📊
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LOAN MANAGEMENT                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'loans' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['View All Loans', 'Loan Monitoring', 'Defaulted Loans', 'Liquidation', 'Loan Reports'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'View All Loans' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Activity className="w-5 h-5 text-amber-400" /> Active Protocol Loans
              </h3>
              <div className="space-y-3">
                {[
                  { id: 'LN-0192', user: 'Alex Rivers', collateral: '$10,000', borrowed: '$5,000', health: '1.8' },
                  { id: 'LN-0193', user: 'Elena Rostova', collateral: '$45,000', borrowed: '$20,000', health: '2.1' },
                  { id: 'LN-0194', user: '0x748...91A2', collateral: '$5,000', borrowed: '$4,200', health: '1.05' },
                ].map(l => (
                  <div key={l.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">Loan {l.id} • {l.user}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Collateral: {l.collateral} | Borrowed: {l.borrowed}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Health Factor</div>
                      <div className={`text-sm font-bold ${parseFloat(l.health) < 1.1 ? 'text-rose-400' : 'text-emerald-400'}`}>{l.health}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
              <Activity className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p>Admin panel for managing protocol debt and liquidations. This view renders {activeSubTab}.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TOKEN MANAGEMENT (ICO, Vesting, Token Allocation)                      */}
      {/* ========================================================================= */}
      {activeTab === 'tokens' && (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2 mb-6">
            {['ICO Management', 'Vesting Management', 'Token Allocation', 'Burn Management', 'Bonus Allocation'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {activeSubTab === 'ICO Management' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <DollarSign className="w-5 h-5 text-amber-400" /> ICO Launchpad Configuration
              </h3>
              <AdminICODashboard />
            </div>
          )}

          {activeSubTab === 'Bonus Allocation' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <DollarSign className="w-5 h-5 text-amber-400" /> Bonus Allocation & Vesting
              </h3>
              <AdminICODashboard />
            </div>
          )}

          {activeSubTab === 'Vesting Management' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Calendar className="w-5 h-5 text-amber-400" /> Token Vesting Schedules
              </h3>
              <AdminPanel
                state={props.state}
                accounts={props.accounts}
                selectedAccount={props.selectedAccount}
                currentTimestamp={props.currentTimestamp}
                onCreateSchedule={props.onCreateSchedule}
                onDepositTokens={props.onDepositTokens}
                onRevokeSchedule={props.onRevokeSchedule}
                onTogglePause={props.onTogglePause}
                computeVestedAmount={props.computeVestedAmount}
                computeReleasableAmount={props.computeReleasableAmount}
                formatUnits={props.formatUnits}
                formatDuration={props.formatDuration}
                unallocatedBalance={props.unallocatedBalance}
              />
            </div>
          )}

          {activeSubTab === 'Token Allocation' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Calendar className="w-5 h-5 text-amber-400" /> Token Allocation Control
              </h3>
              <AdminPanel
                state={props.state}
                accounts={props.accounts}
                selectedAccount={props.selectedAccount}
                currentTimestamp={props.currentTimestamp}
                onCreateSchedule={props.onCreateSchedule}
                onDepositTokens={props.onDepositTokens}
                onRevokeSchedule={props.onRevokeSchedule}
                onTogglePause={props.onTogglePause}
                computeVestedAmount={props.computeVestedAmount}
                computeReleasableAmount={props.computeReleasableAmount}
                formatUnits={props.formatUnits}
                formatDuration={props.formatDuration}
                unallocatedBalance={props.unallocatedBalance}
              />
            </div>
          )}
          
          {activeSubTab === 'Burn Management' && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Calendar className="w-5 h-5 text-amber-400" /> Token Burn Protocol
              </h3>
              <AdminPanel
                state={props.state}
                accounts={props.accounts}
                selectedAccount={props.selectedAccount}
                currentTimestamp={props.currentTimestamp}
                onCreateSchedule={props.onCreateSchedule}
                onDepositTokens={props.onDepositTokens}
                onRevokeSchedule={props.onRevokeSchedule}
                onTogglePause={props.onTogglePause}
                computeVestedAmount={props.computeVestedAmount}
                computeReleasableAmount={props.computeReleasableAmount}
                formatUnits={props.formatUnits}
                formatDuration={props.formatDuration}
                unallocatedBalance={props.unallocatedBalance}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. NFT MANAGEMENT                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'nfts' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['NFT Minting Controls', 'Marketplace Fees', 'NFT Airdrops', 'Gift & Barter Rules'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'NFT Minting Controls' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Layers className="w-5 h-5 text-amber-400" /> NFT Minting Overview
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 font-bold">Total NFTs Minted</div>
                  <div className="text-lg font-black text-white mt-1">12,450</div>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 font-bold">Active Listings</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">842</div>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 font-bold">24h Trading Volume</div>
                  <div className="text-lg font-black text-amber-400 mt-1">$45,200</div>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <div className="text-sm font-bold text-white mb-2">Recent Network Activity</div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">#{3490 + i}</div>
                      <div>
                        <div className="text-xs font-bold text-white">Legion Hero Tier {i}</div>
                        <div className="text-[10px] text-slate-400">Minted by 0x709...79C8</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-emerald-400">Success</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <Layers className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p className="text-center max-w-md">Detailed configuration and data for {activeSubTab} will be available here.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. FRANCHISE MANAGEMENT                                                   */}
      {/* ========================================================================= */}
      {/* {activeTab === 'franchise' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['Franchise Licensing', 'Operator KYC', 'Revenue Share', 'Audit Franchisees'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'Franchise Licensing' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Globe className="w-5 h-5 text-amber-400" /> Active Franchise Operators
              </h3>
              <div className="space-y-3">
                {[
                  { id: 'FRA-01', region: 'North America', status: 'Active', rev: '$12,400' },
                  { id: 'FRA-02', region: 'Europe', status: 'Pending Audit', rev: '$8,200' },
                  { id: 'FRA-03', region: 'Asia Pacific', status: 'Active', rev: '$24,100' }
                ].map(f => (
                  <div key={f.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{f.region} Operator</div>
                      <div className="text-xs text-slate-400 mt-0.5">ID: {f.id} | Monthly Revenue: <span className="text-emerald-400 font-bold">{f.rev}</span></div>
                    </div>
                    <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">
                      {f.status === 'Active' ? 'View Details' : 'Review Audit'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <Globe className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p className="text-center max-w-md">Detailed configuration and data for {activeSubTab} will be available here.</p>
            </div>
          )}
        </div>
      )} */}

      {/* ========================================================================= */}
      {/* 7. AI MANAGEMENT                                                          */}
      {/* ========================================================================= */}
      {/* {activeTab === 'ai' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['LLM Parameters', 'Trading Algorithms', 'Chat Logs'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'LLM Parameters' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Bot className="w-5 h-5 text-amber-400" /> AI Systems Monitor
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-slate-400 font-bold text-xs">Total AI Queries Today</div>
                    <div className="text-xl font-black text-white mt-1">14,208</div>
                  </div>
                  <Activity className="w-8 h-8 text-emerald-400/50" />
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-slate-400 font-bold text-xs">LLM Token Usage</div>
                    <div className="text-xl font-black text-white mt-1">2.4M</div>
                  </div>
                  <Bot className="w-8 h-8 text-amber-400/50" />
                </div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                 <div className="text-sm font-bold text-white mb-2">System Status</div>
                 <div className="flex items-center gap-2 text-xs text-emerald-400">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div> All AI Nodes Operational
                 </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <Bot className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p className="text-center max-w-md">Detailed configuration and data for {activeSubTab} will be available here.</p>
            </div>
          )}
        </div>
      )} */}

      {/* ========================================================================= */}
      {/* 8. EDUCATION MANAGEMENT                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'education' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['Course Management', 'Quiz Settings', 'Certificates (eLIC)', 'Instructor Tools'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'Course Management' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <GraduationCap className="w-5 h-5 text-amber-400" /> Recent Course Completions
              </h3>
              <div className="space-y-3">
                {[
                  { user: 'Alex Rivers', course: 'DeFi Fundamentals', score: '95%' },
                  { user: 'Elena Rostova', course: 'Smart Contract Security', score: '100%' },
                  { user: 'Liam Vance', course: 'Crypto Taxation', score: '88%' }
                ].map((c, i) => (
                  <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{c.user}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Completed: {c.course}</div>
                    </div>
                    <div className="text-xs font-bold text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-500/20">
                      Score: {c.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <GraduationCap className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p className="text-center max-w-md">Detailed configuration and data for {activeSubTab} will be available here.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. GOVERNANCE                                                             */}
      {/* ========================================================================= */}
      {/* {activeTab === 'governance' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['DAO Proposals', 'Voting Power', 'Quorum Settings', 'Executed Upgrades'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'DAO Proposals' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Vote className="w-5 h-5 text-amber-400" /> Active DAO Proposals
              </h3>
              <div className="space-y-4">
                {[
                  { id: 'PIP-42', title: 'Increase Stablecoin APY to 8%', yes: 75, no: 25, status: 'Active' },
                  { id: 'PIP-43', title: 'Add Chainlink Oracle Integration', yes: 95, no: 5, status: 'Passed' },
                ].map(p => (
                  <div key={p.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-white text-sm">{p.id}: {p.title}</div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-lg ${p.status === 'Active' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {p.status}
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-1 flex overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${p.yes}%` }}></div>
                      <div className="bg-rose-500 h-full" style={{ width: `${p.no}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Yes: {p.yes}%</span>
                      <span>No: {p.no}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <Vote className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p className="text-center max-w-md">Detailed configuration and data for {activeSubTab} will be available here.</p>
            </div>
          )}
        </div>
      )} */}

      {/* ========================================================================= */}
      {/* 10. ANALYTICS                                                             */}
      {/* ========================================================================= */}
      {/* {activeTab === 'analytics' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['TVL Tracking', 'User Growth', 'Volume Stats', 'Yield Metrics'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'TVL Tracking' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <BarChart3 className="w-5 h-5 text-amber-400" /> Protocol Metrics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 font-bold text-xs">Total Value Locked (TVL)</div>
                  <div className="text-2xl font-black text-white mt-1">$25.4M</div>
                  <div className="text-xs text-emerald-400 mt-1">↑ 4.2% this week</div>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 font-bold text-xs">Total Users</div>
                  <div className="text-2xl font-black text-white mt-1">12,450</div>
                  <div className="text-xs text-emerald-400 mt-1">↑ 124 today</div>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 font-bold text-xs">Daily Volume</div>
                  <div className="text-2xl font-black text-white mt-1">$1.2M</div>
                  <div className="text-xs text-rose-400 mt-1">↓ 1.1% today</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <BarChart3 className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p className="text-center max-w-md">Detailed configuration and data for {activeSubTab} will be available here.</p>
            </div>
          )}
        </div>
      )} */}

      {/* ========================================================================= */}
      {/* 11. REPORTS                                                               */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['Daily Audit', 'Tax Export', 'Compliance Log', 'System Health'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          {activeSubTab === 'Daily Audit' ? (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" /> Generated Reports
              </h3>
              <div className="space-y-3">
                {[
                  { name: 'Monthly Tax Export (Global)', date: 'Oct 1, 2023', size: '2.4 MB' },
                  { name: 'Q3 Compliance Audit', date: 'Sep 30, 2023', size: '5.1 MB' },
                  { name: 'System Health Log', date: 'Sep 29, 2023', size: '1.2 MB' }
                ].map((r, i) => (
                  <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-6 h-6 text-slate-500" />
                      <div>
                        <div className="text-sm font-bold text-white">{r.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Generated: {r.date} • {r.size}</div>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition cursor-pointer">
                      Download PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <FileSpreadsheet className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p className="text-center max-w-md">Detailed configuration and data for {activeSubTab} will be available here.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. PLATFORM SETTINGS                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="space-y-6 text-xs">
          <div className="flex flex-wrap gap-2 mb-4">
            {['Contract Settings', 'Interest Rate Settings', 'Platform Fee Settings', 'Emergency Pause', 'System Configuration'].map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubTab(sub)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeSubTab === sub 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {(activeSubTab === 'Contract Settings' || activeSubTab === 'Emergency Pause' || activeSubTab === 'System Configuration') && (
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-amber-400" /> Protocol Parameter Controls
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <div className="font-bold text-white">Emergency Pause (Global)</div>
                  <button
                    onClick={() => props.onTogglePause()}
                    className={`w-full py-2 rounded-xl font-bold transition cursor-pointer ${
                      props.state.paused ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {props.state.paused ? 'EMERGENCY PAUSE ON ⚠️' : 'System Operational ✓'}
                  </button>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <div className="font-bold text-white">Token Burn %</div>
                  <input
                    type="number"
                    step="0.1"
                    value={tokenBurnPct}
                    onChange={(e) => setTokenBurnPct(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <div className="font-bold text-white">Reserve Allocation %</div>
                  <input
                    type="number"
                    step="1.0"
                    value={reservePct}
                    onChange={(e) => setReservePct(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {(activeSubTab === 'Interest Rate Settings' || activeSubTab === 'Platform Fee Settings') && (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <Sliders className="w-12 h-12 mb-4 text-amber-400/50" />
              <h2 className="text-xl font-bold text-white mb-2">{activeSubTab}</h2>
              <p>Configure dynamic protocol rates here.</p>
            </div>
          )}
        </div>
      )}

      {/* WEB3 ACTION MODAL */}
      <Web3ActionModal
        {...web3ModalState}
        onClose={() => setWeb3ModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default AdminGovernanceDashboard;
