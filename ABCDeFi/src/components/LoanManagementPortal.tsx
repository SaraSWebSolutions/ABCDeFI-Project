import React, { useState, useMemo } from 'react';
import {
  FileText,
  Activity,
  AlertTriangle,
  Flame,
  BarChart3,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Download,
  Zap,
  Info,
  DollarSign,
  Coins,
  ChevronRight,
  Users,
  Layers,
  Sparkles,
  Sliders,
  ExternalLink,
  RefreshCw,
  BellRing,
} from 'lucide-react';
import {
  MarketplaceLoan,
  DefaultedLoanRecord,
  LiquidationRecord,
  MOCK_DEFAULTED_LOANS,
  MOCK_LIQUIDATION_HISTORY,
  generateLoanReportData,
  downloadLoanReportCSV,
  evaluateMarginCallRisk,
  executeLiquidation,
} from '../Services/lending';

export type LoanPortalTab = 'viewAll' | 'monitoring' | 'defaulted' | 'liquidation' | 'reports';

interface LoanManagementPortalProps {
  initialTab?: LoanPortalTab;
  userAddress?: string;
}

const INITIAL_ALL_LOANS: MarketplaceLoan[] = [
  {
    id: 'LOAN-1001',
    borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    lender: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    borrowAmount: '5,000',
    collateralEth: '2.50',
    interestApyBps: 1000,
    durationDays: 30,
    status: 'Active',
    createdAt: 'Jul 15, 2026',
    expiresAt: 'Aug 14, 2026',
    dueDate: 'Aug 14, 2026',
    remainingBalance: '5,123.28 ABCD',
    monthlyEmi: '5,123.28 ABCD',
    nextPaymentDate: 'Aug 14, 2026',
    paidEmis: 0,
    totalEmis: 1,
    remainingEmis: 1,
    accruedInterest: '123.28 ABCD',
    healthFactor: 1.85,
    liquidationPrice: 1800,
    ltvRatio: 64,
  },
  {
    id: 'LOAN-1002',
    borrower: '0x3C44CdD46a9380a46014605930064d7879e96f13',
    lender: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    borrowAmount: '12,500',
    collateralEth: '6.00',
    interestApyBps: 1200,
    durationDays: 60,
    status: 'Active',
    createdAt: 'Jul 01, 2026',
    expiresAt: 'Aug 30, 2026',
    dueDate: 'Aug 30, 2026',
    remainingBalance: '12,746.57 ABCD',
    monthlyEmi: '6,373.28 ABCD',
    nextPaymentDate: 'Aug 01, 2026',
    paidEmis: 0,
    totalEmis: 2,
    remainingEmis: 2,
    accruedInterest: '246.57 ABCD',
    healthFactor: 1.62,
    liquidationPrice: 1950,
    ltvRatio: 72,
  },
  {
    id: 'LOAN-1003',
    borrower: '0x15d34AA54267DB7D7c367839AAf71A00a2C6A65E',
    lender: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    borrowAmount: '2,000',
    collateralEth: '1.00',
    interestApyBps: 800,
    durationDays: 14,
    status: 'Closed',
    createdAt: 'Jun 10, 2026',
    expiresAt: 'Jun 24, 2026',
    dueDate: 'Jun 24, 2026',
    remainingBalance: '0.00 ABCD',
    monthlyEmi: '2,006.13 ABCD',
    nextPaymentDate: 'Closed',
    paidEmis: 1,
    totalEmis: 1,
    remainingEmis: 0,
    accruedInterest: '6.13 ABCD',
    healthFactor: 2.40,
    liquidationPrice: 1500,
    ltvRatio: 52,
  },
  {
    id: 'LOAN-1004',
    borrower: '0x8b32145A7b11c9d4E781290A981C65421aB9c123',
    lender: '0x3C44CdD46a9380a46014605930064d7879e96f13',
    borrowAmount: '4,500',
    collateralEth: '1.80',
    interestApyBps: 1500,
    durationDays: 30,
    status: 'Defaulted',
    createdAt: 'Jun 12, 2026',
    expiresAt: 'Jul 12, 2026',
    dueDate: 'Jul 12, 2026',
    remainingBalance: '4,635.00 ABCD',
    monthlyEmi: '4,635.00 ABCD',
    nextPaymentDate: 'Overdue (18d)',
    paidEmis: 0,
    totalEmis: 1,
    remainingEmis: 1,
    accruedInterest: '135.00 ABCD',
    healthFactor: 0.92,
    liquidationPrice: 2400,
    daysPastDue: 18,
    penaltyAmount: '135.00 ABCD',
    defaultReason: '3 Consecutive Missed EMI Payments',
    ltvRatio: 91,
  },
  {
    id: 'LOAN-1005',
    borrower: '0x3A21990412812dc3A010C7d01b50e0d17dc781B',
    lender: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    borrowAmount: '10,000',
    collateralEth: '4.20',
    interestApyBps: 1400,
    durationDays: 45,
    status: 'Liquidated',
    createdAt: 'May 01, 2026',
    expiresAt: 'Jun 15, 2026',
    dueDate: 'Jun 15, 2026',
    remainingBalance: '0.00 ABCD',
    monthlyEmi: '0.00 ABCD',
    nextPaymentDate: 'Liquidated',
    paidEmis: 0,
    totalEmis: 1,
    remainingEmis: 0,
    accruedInterest: '0.00 ABCD',
    healthFactor: 0.84,
    liquidationPrice: 2200,
    ltvRatio: 95,
  },
  {
    id: 'LOAN-1006',
    borrower: '0x99281a17957790a12C5930064d7879e96f99119A',
    borrowAmount: '8,500',
    collateralEth: '4.00',
    interestApyBps: 1100,
    durationDays: 30,
    status: 'Requested',
    createdAt: 'Jul 30, 2026',
    expiresAt: 'In 30 days',
    dueDate: 'Aug 29, 2026',
    remainingBalance: '8,500.00 ABCD',
    monthlyEmi: '0.00 ABCD',
    nextPaymentDate: 'N/A',
    paidEmis: 0,
    totalEmis: 1,
    remainingEmis: 1,
    accruedInterest: '0.00 ABCD',
    healthFactor: 2.10,
    liquidationPrice: 1700,
    ltvRatio: 58,
  },
];

export const LoanManagementPortal: React.FC<LoanManagementPortalProps> = ({
  initialTab = 'viewAll',
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}) => {
  const [activeTab, setActiveTab] = useState<LoanPortalTab>(initialTab);

  // --- View All Loans States ---
  const [loansList, setLoansList] = useState<MarketplaceLoan[]>(INITIAL_ALL_LOANS);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectLoan, setInspectLoan] = useState<MarketplaceLoan | null>(null);

  // --- Loan Monitoring States ---
  const [simulatedEthPrice, setSimulatedEthPrice] = useState<number>(2500);

  // --- Liquidation Engine States ---
  const [liquidationHistory, setLiquidationHistory] = useState<LiquidationRecord[]>(MOCK_LIQUIDATION_HISTORY);
  const [executingLiqId, setExecutingLiqId] = useState<string | null>(null);
  const [liqFeedbackMsg, setLiqFeedbackMsg] = useState<string>('');

  // --- Reports State ---
  const reportData = useMemo(() => generateLoanReportData(loansList), [loansList]);

  // Filtered Loans for View All
  const filteredLoans = useMemo(() => {
    return loansList.filter((loan) => {
      const matchesSearch =
        loan.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.borrower.toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === 'All') return matchesSearch;
      return matchesSearch && loan.status.toLowerCase() === statusFilter.toLowerCase();
    });
  }, [loansList, statusFilter, searchQuery]);

  // Compute live Monitoring stats based on simulated ETH price
  const monitoredPositions = useMemo(() => {
    return loansList
      .filter((l) => l.status === 'Active' || l.status === 'Defaulted')
      .map((loan) => {
        const ethVal = parseFloat(loan.collateralEth) * simulatedEthPrice;
        const debtVal = parseFloat(loan.borrowAmount.replace(/,/g, ''));
        const ltv = ethVal > 0 ? (debtVal / ethVal) * 100 : 100;
        const healthFactor = ltv > 0 ? 100 / ltv : 0;

        let riskLevel: 'Healthy' | 'Warning' | 'Critical' | 'Liquidatable' = 'Healthy';
        if (ltv >= 90) riskLevel = 'Liquidatable';
        else if (ltv >= 85) riskLevel = 'Critical';
        else if (ltv >= 75) riskLevel = 'Warning';

        return {
          ...loan,
          liveLtv: ltv.toFixed(1),
          liveHf: healthFactor.toFixed(2),
          riskLevel,
          collateralUsd: ethVal.toFixed(2),
        };
      });
  }, [loansList, simulatedEthPrice]);

  // Execute Liquidation Handler
  const handleExecuteLiquidation = async (loanId: string, borrower: string, debtAmount: string) => {
    setExecutingLiqId(loanId);
    setLiqFeedbackMsg(`Initiating smart contract liquidation for loan ${loanId}...`);
    try {
      const receipt = await executeLiquidation(borrower, debtAmount);
      setLiqFeedbackMsg(`Liquidation successful! 5% liquidator bonus claimed.`);

      // Update state locally
      setLoansList((prev) =>
        prev.map((l) => (l.id === loanId ? { ...l, status: 'Liquidated', remainingBalance: '0.00 ABCD' } : l))
      );

      setLiquidationHistory((prev) => [
        {
          id: `LIQ-${Date.now().toString().slice(-4)}`,
          loanId,
          borrower: `${borrower.slice(0, 6)}...${borrower.slice(-4)}`,
          liquidator: `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
          debtCovered: `${debtAmount} ABCD`,
          debtSettledAbcd: `${debtAmount} ABCD`,
          collateralSeizedEth: 'Settled on-chain',
          surplusToTreasuryEth: '0 ETH',
          liquidatorRewardEth: 'Not applicable',
          timestamp: new Date().toLocaleTimeString(),
          txHash: receipt.hash,
          status: 'Completed',
        },
        ...prev,
      ]);
    } catch (err) {
      console.error(err);
      setLiqFeedbackMsg('Liquidation failed. No local settlement was recorded.');
    } finally {
      setExecutingLiqId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & MAIN TAB NAVIGATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Decentralized Loan Governance & Risk Portal</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-3">
              ABCDeFi Loan Ecosystem Center
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Comprehensive loan tracking, live collateral health monitoring, defaulted debt management, liquidation triggers, and exportable protocol reporting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadLoanReportCSV(loansList)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs transition flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download Loan Report (CSV)
            </button>
          </div>
        </div>

        {/* TOP TAB SWITCHER (5 REQUESTED SECTIONS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('viewAll')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'viewAll'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" /> View All Loans
          </button>

          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" /> Loan Monitoring
          </button>

{/* Defaulted Loans tab hidden */}

          <button
            onClick={() => setActiveTab('liquidation')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'liquidation'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Flame className="w-4 h-4" /> Liquidation
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Loan Reports
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: VIEW ALL LOANS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'viewAll' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search Loan ID or Borrower..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {['All', 'Requested', 'Active', 'Closed', 'Defaulted', 'Liquidated'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* All Loans Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <h3 className="font-bold text-white uppercase text-xs tracking-wider flex items-center gap-2 font-mono">
                <FileText className="w-4 h-4 text-indigo-400" /> Protocol Loan Directory ({filteredLoans.length} Loans)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Loan ID</th>
                    <th className="p-4">Borrower</th>
                    <th className="p-4">Amount (ABCD)</th>
                    <th className="p-4">Collateral</th>
                    <th className="p-4">APY %</th>
                    <th className="p-4">LTV / Health</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-900/80 transition">
                      <td className="p-4 font-bold text-indigo-400">{loan.id}</td>
                      <td className="p-4 font-mono text-slate-400">
                        {loan.borrower.slice(0, 6)}...{loan.borrower.slice(-4)}
                      </td>
                      <td className="p-4 font-bold text-white">{loan.borrowAmount}</td>
                      <td className="p-4 text-emerald-400 font-bold">{loan.collateralEth} ETH</td>
                      <td className="p-4 text-amber-400 font-bold">{(loan.interestApyBps / 100).toFixed(1)}%</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-bold">{loan.ltvRatio || 65}%</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              (loan.healthFactor || 1.8) >= 1.5
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : (loan.healthFactor || 1.8) >= 1.0
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            HF: {loan.healthFactor || 1.8}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">{loan.dueDate}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            loan.status === 'Active'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : loan.status === 'Requested'
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : loan.status === 'Closed'
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : loan.status === 'Defaulted'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setInspectLoan(loan)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: LOAN MONITORING & RISK MONITOR                                 */}
      {/* ========================================================================= */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* ETH Stress Tester Widget */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" /> Real-Time Risk & Collateral Stress Tester
                </h3>
                <p className="text-xs text-slate-400">
                  Simulate ETH market price drops to analyze LTV shifts, Health Factors, and Margin Call triggers across active loans.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl flex items-center gap-3">
                <span className="text-xs text-slate-400">Simulated ETH Price:</span>
                <span className="text-lg font-black text-emerald-400 font-mono">${simulatedEthPrice} USD</span>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Extreme Crash ($1,000 ETH)</span>
                <span>Current Market ($2,500 ETH)</span>
                <span>Bull Market ($4,000 ETH)</span>
              </div>
              <input
                type="range"
                min="1000"
                max="4000"
                step="50"
                value={simulatedEthPrice}
                onChange={(e) => setSimulatedEthPrice(Number(e.target.value))}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Monitored Active Positions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitoredPositions.map((pos) => (
              <div
                key={pos.id}
                className={`bg-slate-950 border rounded-3xl p-5 space-y-4 transition ${
                  pos.riskLevel === 'Liquidatable'
                    ? 'border-rose-500/80 shadow-rose-950/50 shadow-xl'
                    : pos.riskLevel === 'Critical'
                    ? 'border-red-500/60 shadow-red-950/40 shadow-lg'
                    : pos.riskLevel === 'Warning'
                    ? 'border-amber-500/50'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">{pos.id}</span>
                    <h4 className="text-sm font-bold text-white">{pos.borrower.slice(0, 8)}...</h4>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      pos.riskLevel === 'Liquidatable'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse'
                        : pos.riskLevel === 'Critical'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/50 animate-pulse'
                        : pos.riskLevel === 'Warning'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    }`}
                  >
                    {pos.riskLevel}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Borrowed Debt:</span>
                    <span className="text-white font-bold">{pos.borrowAmount} ABCD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Collateral Locked:</span>
                    <span className="text-emerald-400 font-bold">
                      {pos.collateralEth} ETH (${pos.collateralUsd})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Live LTV Ratio:</span>
                    <span
                      className={`font-bold ${
                        parseFloat(pos.liveLtv) >= 90
                          ? 'text-rose-400'
                          : parseFloat(pos.liveLtv) >= 75
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {pos.liveLtv}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Health Factor:</span>
                    <span className="text-white font-bold">{pos.liveHf}</span>
                  </div>
                </div>

                {/* Risk Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        parseFloat(pos.liveLtv) >= 90
                          ? 'bg-rose-500'
                          : parseFloat(pos.liveLtv) >= 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, parseFloat(pos.liveLtv))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Safe (0%)</span>
                    <span>Warning (75%)</span>
                    <span>Liquidation (90%)</span>
                  </div>
                </div>

                {pos.riskLevel === 'Liquidatable' && (
                  <button
                    onClick={() => handleExecuteLiquidation(pos.id, pos.borrower, pos.borrowAmount)}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2"
                  >
                    <Flame className="w-4 h-4" /> Liquidate Position (5% Bonus)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: DEFAULTED LOANS MANAGEMENT                                    */}
      {/* ========================================================================= */}
      {activeTab === 'defaulted' && (
        MOCK_DEFAULTED_LOANS.length === 0 ? null : (
          <div className="space-y-6">
            {/* Summary KPIs for Defaults */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
                <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                  Total Defaulted Debt
                </div>
                <div className="text-3xl font-black text-amber-400 font-mono">27,500 ABCD</div>
                <div className="text-[11px] text-slate-400 mt-1">3 Active Defaulted Accounts</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
                <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                  Non-Performing Loan (NPL) Ratio
                </div>
                <div className="text-3xl font-black text-rose-400 font-mono">2.11%</div>
                <div className="text-[11px] text-slate-400 mt-1">Well below 5% safety benchmark</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
                <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                  Impounded Collateral
                </div>
                <div className="text-3xl font-black text-emerald-400 font-mono">10.40 ETH</div>
                <div className="text-[11px] text-slate-400 mt-1">Valued at ~$26,000 USD</div>
              </div>
            </div>

            {/* Defaulted Loans Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-white uppercase text-xs tracking-wider flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Defaulted &amp; Overdue Loans
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Loan ID</th>
                      <th className="p-4">Borrower</th>
                      <th className="p-4">Overdue Amount</th>
                      <th className="p-4">Collateral</th>
                      <th className="p-4">Days Past Due</th>
                      <th className="p-4">Penalty Fee</th>
                      <th className="p-4">Score Impact</th>
                      <th className="p-4">Grace Period</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {MOCK_DEFAULTED_LOANS.map((d) => (
                      <tr key={d.loanId} className="hover:bg-slate-900/80 transition">
                        <td className="p-4 font-bold text-amber-400">{d.loanId}</td>
                        <td className="p-4 font-bold text-white">
                          {d.borrowerName}
                          <div className="text-[10px] text-slate-500 font-normal">{d.borrower.slice(0, 10)}...</div>
                        </td>
                        <td className="p-4 font-bold text-rose-400">{d.overduePrincipal}</td>
                        <td className="p-4 text-emerald-400 font-bold">{d.collateralEth}</td>
                        <td className="p-4 text-white font-bold">{d.daysPastDue} Days</td>
                        <td className="p-4 text-amber-300">{d.penaltyFees}</td>
                        <td className="p-4 text-rose-400 font-bold">{d.scoreImpact} pts</td>
                        <td className="p-4 text-slate-400">{d.gracePeriodEnds}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: LIQUIDATION ENGINE & HISTORICAL LOGS                           */}
      {/* ========================================================================= */}
      {activeTab === 'liquidation' && (
        <div className="space-y-6">
          {/* Feedback Message Banner */}
          {liqFeedbackMsg && (
            <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono">
                <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>{liqFeedbackMsg}</span>
              </div>
              <button onClick={() => setLiqFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* Liquidation Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                Total Liquidations Executed
              </div>
              <div className="text-3xl font-black text-white font-mono">5 Loans</div>
              <div className="text-[11px] text-slate-400 mt-1">100% Solvency Preserved</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                Collateral Seized (ETH)
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono">18.65 ETH</div>
              <div className="text-[11px] text-slate-400 mt-1">Disposed via Dutch Auction</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                Liquidator Bonus Reward Rate
              </div>
              <div className="text-3xl font-black text-rose-400 font-mono">5.0% Bonus</div>
              <div className="text-[11px] text-slate-400 mt-1">Paid directly to liquidators</div>
            </div>
          </div>

          {/* Liquidation History Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-bold text-white uppercase text-xs tracking-wider flex items-center gap-2 font-mono">
                <Flame className="w-4 h-4 text-rose-400" /> Historical Liquidation Transactions Log
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Event ID</th>
                    <th className="p-4">Loan ID</th>
                    <th className="p-4">Borrower</th>
                    <th className="p-4">Liquidator</th>
                    <th className="p-4">Debt Settled</th>
                    <th className="p-4">Collateral Seized</th>
                    <th className="p-4">Liquidator Bonus</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {liquidationHistory.map((liq) => (
                    <tr key={liq.id} className="hover:bg-slate-900/80 transition">
                      <td className="p-4 font-bold text-rose-400">{liq.id}</td>
                      <td className="p-4 text-slate-300 font-bold">{liq.loanId}</td>
                      <td className="p-4 text-slate-400">{liq.borrower}</td>
                      <td className="p-4 text-emerald-400 font-bold">{liq.liquidator}</td>
                      <td className="p-4 text-white font-bold">{liq.debtSettledAbcd}</td>
                      <td className="p-4 text-amber-400 font-bold">{liq.collateralSeizedEth}</td>
                      <td className="p-4 text-emerald-300 font-bold">{liq.liquidatorRewardEth}</td>
                      <td className="p-4 text-slate-500 text-[11px]">{liq.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: LOAN REPORTS & ANALYTICS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Total Origination</div>
              <div className="text-2xl font-black text-white font-mono">
                ${reportData.totalOriginationVolumeUsd.toLocaleString()} USD
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Active Debt</div>
              <div className="text-2xl font-black text-indigo-400 font-mono">
                ${reportData.activeOutstandingDebtUsd.toLocaleString()} USD
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Weighted Avg APY</div>
              <div className="text-2xl font-black text-amber-400 font-mono">{reportData.averageInterestApyPct}%</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Protocol Reserve</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ${reportData.protocolReserveFundUsd.toLocaleString()} USD
              </div>
            </div>
          </div>

          {/* Visual Category Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                <BarChart3 className="w-4 h-4 text-cyan-400" /> Loan Status Distribution
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Repaid & Settled:</span>
                  <span className="text-emerald-400 font-bold">
                    {reportData.repaidLoansCount} Loans ({((reportData.repaidLoansCount / reportData.totalLoansCreated) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Debt:</span>
                  <span className="text-indigo-400 font-bold">
                    {reportData.activeLoansCount} Loans ({((reportData.activeLoansCount / reportData.totalLoansCreated) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Defaulted:</span>
                  <span className="text-amber-400 font-bold">
                    {reportData.defaultedLoansCount} Loans ({((reportData.defaultedLoansCount / reportData.totalLoansCreated) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Liquidated:</span>
                  <span className="text-rose-400 font-bold">
                    {reportData.liquidatedLoansCount} Loans ({((reportData.liquidatedLoansCount / reportData.totalLoansCreated) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Risk & Yield Parameters
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Average System LTV:</span>
                  <span className="text-white font-bold">{reportData.averageLtvPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Collateral Locked:</span>
                  <span className="text-emerald-400 font-bold">{reportData.totalCollateralLockedEth} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Yield Paid to Lenders:</span>
                  <span className="text-emerald-400 font-bold">
                    ${reportData.totalInterestPaidToLendersUsd.toLocaleString()} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Report Generated:</span>
                  <span className="text-slate-400">{new Date(reportData.generatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT LOAN MODAL */}
      {inspectLoan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">
                  Inspecting Loan Details
                </span>
                <h3 className="text-xl font-bold text-white font-mono">{inspectLoan.id}</h3>
              </div>
              <button
                onClick={() => setInspectLoan(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Borrower Address:</span>
                <span className="text-white font-bold">{inspectLoan.borrower}</span>
              </div>
              {inspectLoan.lender && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Lender Address:</span>
                  <span className="text-emerald-400 font-bold">{inspectLoan.lender}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Borrow Amount:</span>
                <span className="text-white font-bold">{inspectLoan.borrowAmount} ABCD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Collateral Locked:</span>
                <span className="text-emerald-400 font-bold">{inspectLoan.collateralEth} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Interest APY:</span>
                <span className="text-amber-400 font-bold">{(inspectLoan.interestApyBps / 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Due Date:</span>
                <span className="text-white">{inspectLoan.dueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-indigo-400">{inspectLoan.status}</span>
              </div>
            </div>

            <button
              onClick={() => setInspectLoan(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanManagementPortal;
