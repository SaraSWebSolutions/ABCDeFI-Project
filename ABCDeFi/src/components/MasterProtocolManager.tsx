import React, { useState } from 'react';
import {
  FileText, Activity, AlertTriangle, Flame, BarChart3, Coins,
  Award, Users, Bot, BookOpen, Vote, PieChart as PieIcon, Download,
  Sliders, ShieldCheck, CheckCircle2, Search, Filter, RefreshCw, ArrowUpRight, Lock, Clock, User
} from 'lucide-react';
import Web3ActionModal from './Web3ActionModal';
import { FranchiseSubModuleManager } from './FranchiseSubModuleManager';

interface MasterProtocolManagerProps {
  initialTab?: string;
  userAddress?: string;
}

export const MasterProtocolManager: React.FC<MasterProtocolManagerProps> = ({
  initialTab = 'view-all-loans',
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [franchiseSubTab, setFranchiseSubTab] = useState<'franchise-licensing' | 'operator-kyc' | 'revenue-share' | 'audit-franchisees'>('franchise-licensing');

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Web3 Action Modal State
  const [modalState, setModalState] = useState<{
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

  // MOCK LOANS DATA (Default loans hidden)
  const mockLoans: any[] = [];

  const filteredLoans = mockLoans.filter((l) => {
    const matchesSearch = l.borrower.toLowerCase().includes(searchTerm.toLowerCase()) || l.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || l.status.toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const triggerAction = (title: string, contract: string, method: string, amount: string, icon: string = '🛡️') => {
    setModalState({
      isOpen: true,
      title: `Execute ${title}`,
      subtitle: `Protocol Smart Contract Trigger for ${title}`,
      contractName: contract,
      methodName: method,
      amountLabel: 'Target Amount / Fee',
      amountValue: amount,
      params: [
        { label: 'Executor Address', value: userAddress },
        { label: 'Module Action', value: title },
        { label: 'Execution Network', value: 'Ethereum Sepolia Mainnet' },
      ],
      icon,
      onExecute: async () => {
        await new Promise((r) => setTimeout(r, 1000));
      },
      onSuccessMutation: () => {
        setActionMsg(`Successfully executed "${title}" on-chain!`);
        setTimeout(() => setActionMsg(null), 4000);
      },
    });
  };

  const navTabs = [
    { id: 'view-all-loans', label: 'View All Loans', icon: FileText, category: 'Loan Management' },
    // { id: 'loan-monitoring', label: 'Loan Monitoring', icon: Activity, category: 'Loan Management' },
    // { id: 'defaulted-loans', label: 'Defaulted Loans', icon: AlertTriangle, category: 'Loan Management' }, // hidden
    { id: 'liquidation', label: 'Liquidation', icon: Flame, category: 'Loan Management' },
    // { id: 'loan-reports', label: 'Loan Reports', icon: BarChart3, category: 'Loan Management' },
    { id: 'token-management', label: 'Token Management', icon: Coins, category: 'Protocol Modules' },
    { id: 'nft-management', label: 'NFT Management', icon: Award, category: 'Protocol Modules' },
    { id: 'franchise-management', label: 'Franchise Hub', icon: Users, category: 'Protocol Modules' },
    // { id: 'education-management', label: 'Education Academy', icon: BookOpen, category: 'Protocol Modules' },
    // { id: 'governance', label: 'DAO Governance', icon: Vote, category: 'Governance & Analytics' },
    // { id: 'analytics', label: 'Analytics', icon: PieIcon, category: 'Governance & Analytics' },
    // { id: 'reports', label: 'Audit Reports', icon: Download, category: 'Governance & Analytics' },
    { id: 'platform-settings', label: 'Platform Settings', icon: Sliders, category: 'Governance & Analytics' },
    { id: 'user-account', label: 'User Account', icon: User, category: 'Governance & Analytics' },
  ];

  return (
    <div className="space-y-6 text-slate-100 font-mono">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
              Master Protocol Manager
            </span>
            <span className="text-xs text-slate-400">12 Integrated Operational Modules</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            {navTabs.find((t) => t.id === activeTab)?.label || 'Protocol Management'}
          </h1>
        </div>

        {/* Global Action Feedback Alert */}
        {actionMsg && (
          <div className="px-4 py-2 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMsg}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {navTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/50'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: VIEW ALL LOANS */}
      {activeTab === 'view-all-loans' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/40">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">All Protocol Loans Ledger</h3>
                <p className="text-xs text-slate-400">Comprehensive searchable index of all P2P loan requests.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search borrower or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-48 font-mono"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DEFAULTED">Defaulted</option>
                <option value="LIQUIDATION">Liquidation</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-500 uppercase tracking-widest text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Loan ID</th>
                  <th className="p-3">Borrower</th>
                  <th className="p-3">Principal Amount</th>
                  <th className="p-3">Interest Rate</th>
                  <th className="p-3">Collateral Locked</th>
                  <th className="p-3">LTV Ratio</th>
                  <th className="p-3">Health Factor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLoans.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-bold text-white">{l.id}</td>
                    <td className="p-3 text-slate-300">{l.borrower}</td>
                    <td className="p-3 font-bold text-emerald-400">{l.amount}</td>
                    <td className="p-3 text-slate-300">{l.interest}</td>
                    <td className="p-3 font-bold text-amber-400">{l.collateral}</td>
                    <td className="p-3 text-slate-300">{l.ltv}</td>
                    <td className="p-3 font-bold text-cyan-400">{l.health}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          l.status === 'Defaulted' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => triggerAction(`Manage Loan ${l.id}`, 'LendingPool', 'manageLoan', l.amount, '📄')}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition cursor-pointer"
                      >
                        Details ➔
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: LOAN MONITORING */}
      {activeTab === 'loan-monitoring' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Real-Time Loan Health & LTV Monitor</h3>
                <p className="text-xs text-slate-400">Live monitoring of borrower health factors and upcoming EMI obligations.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Refresh Oracle Prices', 'PriceFeedOracle', 'updatePrices', '0.00 ETH', '🔄')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Refresh Oracles</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Monitored Debt</div>
              <div className="text-2xl font-black text-emerald-400">$26,500 USD</div>
              <div className="text-[10px] text-slate-400">Average LTV: 68.5%</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Health Factor Range</div>
              <div className="text-2xl font-black text-cyan-400">1.42 – 2.10</div>
              <div className="text-[10px] text-slate-400">0 Loans near liquidation threshold</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Next EMI Cycle</div>
              <div className="text-2xl font-black text-amber-400">3 Days</div>
              <div className="text-[10px] text-slate-400">$1,450 EMI Due across active loans</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DEFAULTED LOANS */}
      {activeTab === 'defaulted-loans' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 animate-bounce" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Defaulted Loans & Grace Period Tracking</h3>
                <p className="text-xs text-slate-400">Loans exceeding grace period limits requiring intervention or liquidation.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <div className="font-bold text-amber-300">LOAN-1004 — Borrower: Rajesh Sharma</div>
              <div className="text-[11px] text-slate-400">Principal: $8,000 USD • Overdue: 14 Days • Grace Period Expired</div>
            </div>
            <button
              onClick={() => triggerAction('Seize Collateral & Initiate Liquidation', 'LendingPool', 'triggerDefaultLiquidation', '$8,000 USD', '⚡')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl transition cursor-pointer shadow-lg shadow-amber-600/20"
            >
              Seize Collateral ⚡
            </button>
          </div>
        </div>
      )}

      {/* SECTION 4: LIQUIDATION */}
      {activeTab === 'liquidation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 text-rose-500 animate-pulse" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Under-Collateralized Loan Liquidation Auction</h3>
                <p className="text-xs text-slate-400">Participate in liquidation auctions to purchase collateral at a 15% discount.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-rose-500/40 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-rose-400 text-sm">Auction #AUCT-4091 — Collateral: 1.5 WBTC</span>
              <span className="bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded border border-rose-500/40 font-bold text-[10px]">
                Active Bidding
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-300 font-mono">
              <div>Debt to Liquidate: <strong>$20,000 USD</strong></div>
              <div>Discounted Bid Price: <strong>$17,000 USD</strong></div>
              <div>Estimated Profit: <strong className="text-emerald-400">+$3,000 USD</strong></div>
            </div>
            <button
              onClick={() => triggerAction('Bid on Liquidation Auction', 'CollateralVault', 'liquidateAuction', '$17,000 USD', '🔥')}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-600/30"
            >
              Submit Liquidation Bid ($17,000 USD) 🔥
            </button>
          </div>
        </div>
      )}

      {/* SECTION 5: LOAN REPORTS */}
      {activeTab === 'loan-reports' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-cyan-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Protocol Loan Performance Analytics & Reports</h3>
                <p className="text-xs text-slate-400">Detailed origination volume, interest yield breakdown, and default metrics.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Export PDF Loan Report', 'AnalyticsEngine', 'exportPDF', '0.00 ETH', '📄')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF Report</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="text-slate-500 text-[10px]">TOTAL ORIGINATION</div>
              <div className="text-xl font-bold text-emerald-400">$24,500,000</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="text-slate-500 text-[10px]">HISTORICAL DEFAULT RATE</div>
              <div className="text-xl font-bold text-amber-400">0.82%</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="text-slate-500 text-[10px]">NET INTEREST YIELD GENERATED</div>
              <div className="text-xl font-bold text-indigo-400">$1,840,000</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: TOKEN MANAGEMENT */}
      {activeTab === 'token-management' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Coins className="w-6 h-6 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">ABCD Token Supply & Deflationary Burn Control</h3>
                <p className="text-xs text-slate-400">Manage ABCD ERC-20 token supply, burn pool execution, and staking vault parameters.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="font-bold text-amber-300">Deflationary Token Burn Pool</div>
              <div className="text-2xl font-black text-white">12,500 ABCD</div>
              <p className="text-[10px] text-slate-400">Accumulated protocol fees queued to be burned on-chain.</p>
              <button
                onClick={() => triggerAction('Execute Token Burn', 'ABCDToken', 'burnTokens', '12,500 ABCD', '🔥')}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl transition cursor-pointer"
              >
                Execute On-Chain Burn 🔥
              </button>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="font-bold text-indigo-300">Staking Vault APY Pool</div>
              <div className="text-2xl font-black text-emerald-400">14.2% APY</div>
              <p className="text-[10px] text-slate-400">Lock ABCD tokens to earn high-yield protocol revenue share.</p>
              <button
                onClick={() => triggerAction('Deposit Staking Vault', 'StakingPool', 'stakeABCD', '1,000 ABCD', '🥩')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer"
              >
                Deposit to Staking Vault 🥩
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: NFT MANAGEMENT */}
      {activeTab === 'nft-management' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Award className="w-6 h-6 text-pink-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">4-Tier Legion Territory NFTs & Guru Reputation System</h3>
                <p className="text-xs text-slate-400">Manage World, Asia, India, Telangana, and Hyderabad NFT minting and IPFS metadata.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => triggerAction('Upload IPFS Metadata', 'IPFSUploader', 'pinMetadata', '0.00 ETH', '🌐')}
              className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-pink-600/20"
            >
              Upload IPFS Metadata 🌐
            </button>
            <button
              onClick={() => triggerAction('Mint Territory Legion NFT', 'LegionNFT', 'mintNFT', '0.05 ETH', '🎨')}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              Mint Territory NFT 🎨
            </button>
          </div>
        </div>
      )}

      {/* SECTION 8: FRANCHISE HUB */}
      {activeTab === 'franchise-management' && (
        <div className="space-y-4 font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">Franchise Territory Master Nodes & Guild Governance</h3>
                  <p className="text-xs text-slate-400">Select a sub-module below to manage licensing, corporate KYB, revenue share, or franchisee audits.</p>
                </div>
              </div>

              {/* Franchise Sub-Tab Switcher */}
              <div className="flex flex-wrap items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 gap-1 text-xs font-mono">
                <button
                  onClick={() => setFranchiseSubTab('franchise-licensing')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${franchiseSubTab === 'franchise-licensing' ? 'bg-cyan-600 text-slate-950 shadow-md shadow-cyan-600/30' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Franchise Licensing
                </button>
                <button
                  onClick={() => setFranchiseSubTab('operator-kyc')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${franchiseSubTab === 'operator-kyc' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Operator KYC / KYB
                </button>
                <button
                  onClick={() => setFranchiseSubTab('revenue-share')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${franchiseSubTab === 'revenue-share' ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-600/30' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Revenue Share Pool
                </button>
                <button
                  onClick={() => setFranchiseSubTab('audit-franchisees')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${franchiseSubTab === 'audit-franchisees' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Audit Franchisees
                </button>
              </div>
            </div>

            <FranchiseSubModuleManager tab={franchiseSubTab} userAddress={userAddress} />
          </div>
        </div>
      )}

      {/* SECTION 9: AI MANAGEMENT */}
      {activeTab === 'ai-management' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-pink-400 animate-pulse" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">AI Portfolio Risk Engine & Credit Score Assistant</h3>
                <p className="text-xs text-slate-400">Automated machine learning risk scoring and yield optimization advisor.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-pink-500/30 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <div className="font-bold text-pink-300">AI Recommendation #102: Portfolio Rebalance</div>
              <div className="text-[11px] text-slate-400">Rebalance 15% ABCD to Staking Pool for +2.4% net APY increase.</div>
            </div>
            <button
              onClick={() => triggerAction('Apply AI Portfolio Recommendation', 'AIOptimizer', 'rebalance', '0.00 ETH', '🤖')}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition cursor-pointer"
            >
              Apply AI Recommendation 🤖
            </button>
          </div>
        </div>
      )}

      {/* SECTION 10: EDUCATION ACADEMY */}
      {/* {activeTab === 'education-management' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Learn-to-Earn Financial Education Academy</h3>
                <p className="text-xs text-slate-400">Complete Web3 DeFi literacy modules to earn bonus ABCD tokens and reputation badges.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <div className="font-bold text-emerald-300">Module 4: Collateral Ratios & Liquidation Risks</div>
              <div className="text-[11px] text-slate-400">Score: 100% Passed • Reward: 50 ABCD Tokens</div>
            </div>
            <button
              onClick={() => triggerAction('Claim 50 ABCD Education Reward', 'EducationAcademy', 'claimReward', '50 ABCD', '🎓')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              Claim 50 ABCD Reward 🎓
            </button>
          </div>
        </div>
      )} */}

      {/* SECTION 11: DAO GOVERNANCE */}
      {/* {activeTab === 'governance' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Vote className="w-6 h-6 text-indigo-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">DAO Governance Proposals & Timelock Parameter Control</h3>
                <p className="text-xs text-slate-400">Vote on protocol parameter upgrades, interest rate curves, and collateral thresholds.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/40 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <div className="font-bold text-indigo-300">Proposal #106: Lower Minimum Collateral Ratio to 135%</div>
              <div className="text-[11px] text-slate-400">Voting Ends in: 48 Hours • Votes FOR: 84.2%</div>
            </div>
            <button
              onClick={() => triggerAction('Cast DAO Governance Vote (FOR)', 'DAOGovernance', 'castVote', '0.00 ETH', '🗳️')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              Cast Vote (FOR) 🗳️
            </button>
          </div>
        </div>
      )} */}

      {/* SECTION 12: ANALYTICS */}
      {/* {activeTab === 'analytics' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <PieIcon className="w-6 h-6 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Protocol TVL & Revenue Stream Analytics</h3>
                <p className="text-xs text-slate-400">Real-time breakdown of locked value, borrowing volumes, and protocol income.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Refresh Protocol Analytics', 'AnalyticsEngine', 'refreshStats', '0.00 ETH', '📈')}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Refresh Analytics 📈
            </button>
          </div>
        </div>
      )}

      {/* SECTION 13: REPORTS */}
      {/* {activeTab === 'reports' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-cyan-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">PDF Audit Exporter & On-Chain Ledger Reports</h3>
                <p className="text-xs text-slate-400">Export downloadable financial reports, historical transaction logs, and audit logs.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Export Transaction Ledger CSV', 'LedgerExport', 'exportCSV', '0.00 ETH', '📄')}
              className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Export CSV Ledger 📄
            </button>
          </div>
        </div>
      )} */}

      {/* SECTION 14: PLATFORM SETTINGS */}
      {activeTab === 'platform-settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Sliders className="w-6 h-6 text-purple-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Platform Security, Roles & Emergency Controls</h3>
                <p className="text-xs text-slate-400">Emergency Vault Pause toggle, access control roles, and Sumsub Webhook URLs.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span>Sumsub Webhook Target URL:</span>
              <span className="text-indigo-400 font-bold font-mono">http://localhost:5000/api/webhooks/sumsub</span>
            </div>
            <button
              onClick={() => triggerAction('Save Platform Settings', 'SystemConfig', 'updateSettings', '0.00 ETH', '⚙️')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-purple-600/20"
            >
              Save Platform Settings ⚙️
            </button>
          </div>
        </div>
      )}

      {/* SECTION 15: USER ACCOUNT CONTROLS */}
      {activeTab === 'user-account' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">User Account & Compliance Profile</h3>
                <p className="text-xs text-slate-400">Connected MetaMask wallet profile and Sumsub KYC compliance status.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span>Connected Address:</span>
              <span className="text-white font-bold font-mono">{userAddress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>KYC Compliance Badge:</span>
              <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                KYC Status ✅ Verified (Sumsub)
              </span>
            </div>
            <button
              onClick={() => triggerAction('Update Profile Settings', 'AccountRegistry', 'updateUser', '0.00 ETH', '👤')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              Update Account Profile 👤
            </button>
          </div>
        </div>
      )}

      {/* UNIVERSAL WEB3 ACTION MODAL */}
      <Web3ActionModal
        {...modalState}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default MasterProtocolManager;
