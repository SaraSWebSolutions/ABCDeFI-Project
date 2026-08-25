import React, { useState, useEffect } from 'react';
import { useWallet } from '../Context/WalletContext';
import {
  PieChart,
  BarChart2,
  FileText,
  ShieldCheck,
  TrendingUp,
  Activity,
  DollarSign,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const PortfolioReports: React.FC = () => {
  const { shortAddress, balances } = useWallet();
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data) => data.success && setReports(data.reports))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const abcdBalance = balances?.ABCD ? parseFloat(String(balances.ABCD)) : 10000;
  const ethBalance = balances?.ETH ? parseFloat(String(balances.ETH)) : 2.5;
  const bnbBalance = balances?.BNB ? parseFloat(String(balances.BNB)) : 12.0;

  // Pie chart data
  const pieData = [
    { name: 'ABCD Tokens', value: Math.round(abcdBalance * 0.05), color: '#10b981' },
    { name: 'ETH Collateral', value: Math.round(ethBalance * 3200), color: '#06b6d4' },
    { name: 'BNB Balance', value: Math.round(bnbBalance * 600), color: '#f59e0b' },
    { name: 'Staking Yield Vaults', value: 3000, color: '#8b5cf6' },
  ];

  // Bar chart data
  const barData = [
    { month: 'Jan', borrowed: 4000, repaid: 3800 },
    { month: 'Feb', borrowed: 8000, repaid: 7500 },
    { month: 'Mar', borrowed: 12000, repaid: 11000 },
    { month: 'Apr', borrowed: 18000, repaid: 16500 },
    { month: 'May', borrowed: 25000, repaid: 23000 },
  ];

  const defaultLogs = [
    { loanId: 'LOAN-2024-001', status: 'ACTIVE', borrowerWallet: shortAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', createdAt: new Date().toISOString() },
    { loanId: 'LOAN-2024-002', status: 'REPAID', borrowerWallet: '0x3333333333333333333333333333333333333333', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { loanId: 'LOAN-2024-003', status: 'REPAID', borrowerWallet: '0x4444444444444444444444444444444444444444', createdAt: new Date(Date.now() - 172800000).toISOString() },
  ];

  const auditLogs = reports?.auditTrail && reports.auditTrail.length > 0 ? reports.auditTrail : defaultLogs;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
              <PieChart className="w-3.5 h-3.5" />
              <span>Portfolio Analytics & Protocol Audit Reports</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Portfolio Breakdown & On-Chain Audit
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
              Inspect total portfolio asset distribution, track loan repayment history, and review smart contract audit trails.
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Visualizers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 6 Cols: Asset Pie Chart */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 bg-slate-900/90">
          <h3 className="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
            <PieChart className="w-4 h-4 text-emerald-400" />
            Your Asset Allocation Breakdown
          </h3>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: number) => `$${val.toLocaleString()}`}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400">{item.name}:</span>
                <span className="font-bold text-white">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right 6 Cols: Monthly Borrowing Bar Chart */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 bg-slate-900/90">
          <h3 className="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            Protocol Borrowed vs Repaid Volume ($)
          </h3>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="borrowed" fill="#10b981" radius={[4, 4, 0, 0]} name="Borrowed USD" />
                <Bar dataKey="repaid" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Repaid USD" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded" />
              Borrowed Capital
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-cyan-500 rounded" />
              Repaid Capital
            </span>
          </div>
        </div>
      </div>

      {/* Protocol Audit Trail */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 bg-slate-900/90">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            On-Chain Contract Audit Logs & Transactions
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Total Protocol Originated: ${reports?.totalBorrowedUSD?.toLocaleString() || '18,450,000'} USD
          </span>
        </div>

        {loading ? (
          <div className="text-xs text-slate-400 py-4">Loading audit logs...</div>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log: any, index: number) => (
              <div
                key={index}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 font-mono"
              >
                <div>
                  <span className="text-emerald-400 font-bold mr-2">{log.loanId}</span>
                  <span className="text-slate-300">Status: {log.status}</span>
                </div>

                <div className="text-slate-400 text-[11px]">
                  Borrower: <span className="text-slate-200">{log.borrowerWallet ? log.borrowerWallet.slice(0, 10) : '0x70997970C'}...</span>
                </div>

                <div className="text-slate-500 text-[10px]">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioReports;
