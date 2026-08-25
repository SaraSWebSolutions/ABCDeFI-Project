import React, { useState } from 'react';
import {
  PieChart,
  Send,
  Coins,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Info
} from 'lucide-react';

interface AllocationWallet {
  id: string;
  name: string;
  percentage: number;
  bps: number;
  amount: number;
  address: string;
  color: string;
  role: string;
}

const INITIAL_WALLETS: AllocationWallet[] = [
  {
    id: 'founder',
    name: 'Founder Wallet',
    percentage: 55,
    bps: 5500,
    amount: 550, // 550 Million
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    color: 'bg-indigo-500 text-indigo-400 border-indigo-500/30',
    role: 'Founder & Protocol Lead (550,000,000 ABCD)',
  },
  {
    id: 'ico',
    name: 'ICO / Sale Pool Wallet',
    percentage: 20,
    bps: 2000,
    amount: 200, // 200 Million
    address: '0x3C44CdD05aB506C37364311022137D2883494C6c',
    color: 'bg-cyan-500 text-cyan-400 border-cyan-500/30',
    role: 'Public/Private Token Sale Reserve (200,000,000 ABCD)',
  },
  {
    id: 'marketing',
    name: 'Marketing & Ecosystem',
    percentage: 10,
    bps: 1000,
    amount: 100, // 100 Million
    address: '0x90F79bf6EB2c4f808065364a7372990d11516e81',
    color: 'bg-blue-500 text-blue-400 border-blue-500/30',
    role: 'Ecosystem Growth & Strategic Marketing (100,000,000 ABCD)',
  },
  {
    id: 'finance',
    name: 'Finance & Treasury',
    percentage: 9,
    bps: 900,
    amount: 90, // 90 Million
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    color: 'bg-emerald-500 text-emerald-400 border-emerald-500/30',
    role: 'Default Treasury Wallet (90,000,000 ABCD)',
  },
  {
    id: 'advisor',
    name: 'Advisors & Partners',
    percentage: 2,
    bps: 200,
    amount: 20, // 20 Million
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    color: 'bg-purple-500 text-purple-400 border-purple-500/30',
    role: 'Strategic Advisory Council (20,000,000 ABCD)',
  },
  {
    id: 'reserve',
    name: 'Protocol Reserve',
    percentage: 2,
    bps: 200,
    amount: 20, // 20 Million
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    color: 'bg-amber-500 text-amber-400 border-amber-500/30',
    role: 'Liquidity & Emergency Reserve (20,000,000 ABCD)',
  },
  {
    id: 'contingency',
    name: 'Contingency Fund',
    percentage: 2,
    bps: 200,
    amount: 20, // 20 Million
    address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    color: 'bg-rose-500 text-rose-400 border-rose-500/30',
    role: 'Unforeseen Operational Risks (20,000,000 ABCD)',
  },
];

interface AllocationDashboardProps {
  isPaused: boolean;
  onTransferSimulated: (fromId: string, toId: string, amountM: number) => void;
}

export const AllocationDashboard: React.FC<AllocationDashboardProps> = ({
  isPaused,
  onTransferSimulated,
}) => {
  const [wallets, setWallets] = useState<AllocationWallet[]>(INITIAL_WALLETS);
  const [fromWalletId, setFromWalletId] = useState<string>('founder');
  const [toWalletId, setToWalletId] = useState<string>('ico');
  const [transferAmountM, setTransferAmountM] = useState<string>('10');
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Custom Calculator state
  const [calcBps, setCalcBps] = useState<{ [key: string]: number }>({
    founder: 5500,
    ico: 2000,
    marketing: 1000,
    finance: 900,
    advisor: 200,
    reserve: 200,
    contingency: 200,
  });

  const totalCalcBps = (Object.values(calcBps) as number[]).reduce((a, b) => a + b, 0);
  const isBpsValid = totalCalcBps === 10000;

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleExecuteTransfer = () => {
    if (isPaused) {
      setTransferStatus('❌ Transfer Reverted: Contract is currently PAUSED (EnforcedPause).');
      return;
    }

    const amount = parseFloat(transferAmountM);
    if (isNaN(amount) || amount <= 0) {
      setTransferStatus('❌ Invalid amount specified.');
      return;
    }

    const sender = wallets.find((w) => w.id === fromWalletId);
    if (!sender || sender.amount < amount) {
      setTransferStatus(`❌ Insufficient balance in ${sender?.name || 'sender'}.`);
      return;
    }

    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === fromWalletId) return { ...w, amount: w.amount - amount };
        if (w.id === toWalletId) return { ...w, amount: w.amount + amount };
        return w;
      })
    );

    onTransferSimulated(fromWalletId, toWalletId, amount);
    setTransferStatus(`✔ Successfully transferred ${amount.toLocaleString()}M ABCD tokens!`);
    setTimeout(() => setTransferStatus(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F0F6FC] flex items-center gap-2">
                100% Initial Supply Allocations & Genesis Breakdown
              </h2>
              <p className="text-xs text-[#8B949E] mt-1 max-w-3xl leading-relaxed">
                The total 1,000,000,000 ABCD supply is fully pre-minted at constructor deployment across seven dedicated ecosystem wallets according to exact basis points math (10,000 BPS = 100%).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[#0D1117] px-4 py-2 rounded-xl border border-[#30363D] font-mono text-xs text-indigo-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Sum Check: 1,000,000,000 ABCD (Exact Match)</span>
          </div>
        </div>
      </div>

      {/* Visual Percentage Allocation Bar */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#F0F6FC]">Genesis Allocation Breakdown</span>
          <span className="font-mono text-indigo-400 font-bold">10,000 BPS = 100.0%</span>
        </div>

        {/* Multi-segment bar */}
        <div className="h-6 w-full rounded-xl bg-[#0D1117] p-1 flex items-center gap-1 border border-[#30363D] overflow-hidden">
          {wallets.map((w) => (
            <div
              key={w.id}
              style={{ width: `${w.percentage}%` }}
              className={`h-full rounded-md transition-all relative group ${w.color.split(' ')[0]}`}
              title={`${w.name}: ${w.percentage}% (${w.amount}M ABCD)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
          {wallets.map((w) => (
            <div key={w.id} className="bg-[#0D1117] p-2.5 rounded-xl border border-[#30363D] space-y-1">
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#F0F6FC]">
                <span className={`w-2.5 h-2.5 rounded-full ${w.color.split(' ')[0]}`} />
                <span className="truncate">{w.name.split(' ')[0]}</span>
              </div>
              <div className="text-[10px] font-mono text-[#8B949E] flex items-center justify-between">
                <span>{w.percentage}%</span>
                <span className="text-indigo-300 font-bold">{w.amount}M</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wallet Address Table */}
        <div className="lg:col-span-2 bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
            <Coins className="w-4 h-4 text-indigo-400" />
            Configured Ecosystem Wallets & Balances
          </h3>

          <div className="space-y-3">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="bg-[#0D1117] border border-[#30363D] rounded-xl p-3.5 hover:border-indigo-500/40 transition-all space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-3 h-3 rounded-full ${wallet.color.split(' ')[0]}`} />
                    <div>
                      <span className="text-xs font-bold text-[#F0F6FC]">{wallet.name}</span>
                      <span className="text-[10px] text-[#8B949E] ml-2 font-mono">({wallet.percentage}%)</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-indigo-300">
                      {wallet.amount.toLocaleString()}M ABCD
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#30363D] text-[11px] font-mono">
                  <span className="text-[#8B949E] truncate max-w-[260px]">{wallet.role}</span>

                  <button
                    onClick={() => handleCopy(wallet.address)}
                    className="flex items-center space-x-1.5 text-[#8B949E] hover:text-indigo-300 transition-colors cursor-pointer bg-[#161B22] px-2.5 py-1 rounded-lg border border-[#30363D]"
                  >
                    <span className="truncate max-w-[140px]">{wallet.address}</span>
                    {copiedAddress === wallet.address ? (
                      <Check className="w-3 h-3 text-[#3FB950]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Transfer Simulator */}
        <div className="space-y-6">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" />
              Simulate Token Transfer
            </h3>

            {isPaused && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-amber-300 text-xs flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Contract is PAUSED. Transfers will revert!</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8B949E] text-[11px] font-medium block mb-1">From Wallet</label>
                <select
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2 text-[#F0F6FC] outline-none focus:border-indigo-500 font-mono"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.amount}M ABCD)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-medium block mb-1">To Wallet</label>
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2 text-[#F0F6FC] outline-none focus:border-indigo-500 font-mono"
                >
                  {wallets
                    .filter((w) => w.id !== fromWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-medium block mb-1">Amount (Millions ABCD)</label>
                <input
                  type="number"
                  value={transferAmountM}
                  onChange={(e) => setTransferAmountM(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2 text-[#F0F6FC] outline-none focus:border-indigo-500 font-mono"
                  placeholder="e.g. 10"
                />
              </div>

              <button
                onClick={handleExecuteTransfer}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer font-sans"
              >
                <Send className="w-4 h-4" />
                <span>Execute Transfer Hook</span>
              </button>

              {transferStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono border ${
                    transferStatus.includes('✔')
                      ? 'bg-[#23863622] border-[#238636] text-[#3FB950]'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {transferStatus}
                </div>
              )}
            </div>
          </div>

          {/* Constructor Allocation Math Verifier */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Allocation Revert Validator
            </h3>
            <p className="text-[11px] text-[#8B949E] leading-relaxed">
              If basis points sum is not exactly 10,000 (100%), constructor throws <code className="text-amber-300 bg-[#0D1117] border border-[#30363D] px-1 py-0.5 rounded font-mono">AllocationMismatch</code>.
            </p>

            <div className="bg-[#0D1117] p-3 rounded-xl border border-[#30363D] flex items-center justify-between text-xs font-mono">
              <span className="text-[#8B949E]">Total Basis Points:</span>
              <span className={`font-bold ${isBpsValid ? 'text-[#3FB950]' : 'text-red-400'}`}>
                {totalCalcBps} / 10,000 BPS
              </span>
            </div>

            <div className="text-[10px] text-[#8B949E] italic">
              * Constructor enforcement guarantees no under-minting or inflation drift on deployment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
