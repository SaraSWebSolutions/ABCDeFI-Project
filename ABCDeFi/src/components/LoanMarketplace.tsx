import React, { useState, useMemo } from 'react';
import {
  Landmark,
  PlusCircle,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Coins,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Zap,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Calendar,
  DollarSign,
  Info,
  ChevronRight,
  Copy,
} from 'lucide-react';
import {
  MarketplaceLoan,
  createMarketplaceLoan,
  fundMarketplaceLoan,
  cancelMarketplaceLoan,
  closeMarketplaceLoan,
  payLoanEmi,
} from '../Services/lending';
import EMISystem from './EMISystem';
import MarginCallSystem from './MarginCallSystem';

export type LoanMarketplaceFilter =
  | 'All'
  | 'Open / Requested'
  | 'Active / Funded'
  | 'Closed / Repaid'
  | 'My Created'
  | 'My Funded';

interface LoanMarketplaceProps {
  userAddress?: string;
  onActionSuccess?: () => void;
}

const DEFAULT_MARKETPLACE_LOANS: MarketplaceLoan[] = [
  {
    id: 'loan-101',
    borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    borrowAmount: '5,000',
    collateralEth: '2.50',
    interestApyBps: 1000, // 10.0%
    durationDays: 14,
    status: 'Requested',
    createdAt: '10 mins ago',
    expiresAt: 'In 14 days',
    dueDate: 'Aug 12, 2026',
    remainingBalance: '5,191.78 ABCD',
    monthlyEmi: '0.00 ABCD',
    nextPaymentDate: 'N/A',
    paidEmis: 0,
    totalEmis: 1,
    remainingEmis: 1,
    accruedInterest: '0.00 ABCD',
  },
  {
    id: 'loan-102',
    borrower: '0x3C44CdD46a9380a46014605930064d7879e96f13',
    lender: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    borrowAmount: '12,500',
    collateralEth: '6.00',
    interestApyBps: 1200, // 12.0%
    durationDays: 30,
    status: 'Active',
    createdAt: '2 days ago',
    expiresAt: 'In 28 days',
    dueDate: 'Aug 28, 2026',
    remainingBalance: '12,623.29 ABCD',
    monthlyEmi: '12,623.29 ABCD',
    nextPaymentDate: 'Aug 28, 2026',
    paidEmis: 0,
    totalEmis: 1,
    remainingEmis: 1,
    accruedInterest: '123.29 ABCD',
  },
  {
    id: 'loan-103',
    borrower: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    lender: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    borrowAmount: '2,000',
    collateralEth: '1.00',
    interestApyBps: 800, // 8.0%
    durationDays: 7,
    status: 'Closed',
    createdAt: '5 days ago',
    expiresAt: 'Completed',
    dueDate: 'Jul 24, 2026',
    remainingBalance: '0.00 ABCD',
    monthlyEmi: '2,003.07 ABCD',
    nextPaymentDate: 'Closed',
    paidEmis: 1,
    totalEmis: 1,
    remainingEmis: 0,
    accruedInterest: '3.07 ABCD',
  },
  {
    id: 'loan-104',
    borrower: '0x15d34AA54267DB7D7c367839AAf71A00a2C6A65E',
    borrowAmount: '8,000',
    collateralEth: '4.00',
    interestApyBps: 1500, // 15.0%
    durationDays: 14,
    status: 'Requested',
    createdAt: '1 hour ago',
    expiresAt: 'In 14 days',
    dueDate: 'Aug 12, 2026',
    remainingBalance: '8,460.27 ABCD',
    monthlyEmi: '0.00 ABCD',
    nextPaymentDate: 'N/A',
    paidEmis: 0,
    totalEmis: 1,
    remainingEmis: 1,
    accruedInterest: '0.00 ABCD',
  },
];

export const LoanMarketplace: React.FC<LoanMarketplaceProps> = ({
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  onActionSuccess,
}) => {
  const [loans, setLoans] = useState<MarketplaceLoan[]>(DEFAULT_MARKETPLACE_LOANS);
  const [activeFilter, setActiveFilter] = useState<LoanMarketplaceFilter>('All');
  const [sortBy, setSortBy] = useState<'apy-high' | 'apy-low' | 'amount-high' | 'newest'>('newest');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedInspectLoan, setSelectedInspectLoan] = useState<MarketplaceLoan | null>(null);

  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [txMessage, setTxMessage] = useState<string>('');

  // Form Inputs for Create Loan
  const [formBorrowAmount, setFormBorrowAmount] = useState<string>('2500');
  const [formCollateralEth, setFormCollateralEth] = useState<string>('1.5');
  const [formDurationDays, setFormDurationDays] = useState<number>(14);
  const [formInterestApyBps, setFormInterestApyBps] = useState<number>(1000); // 10.0%

  // Filtered & Sorted Loans
  const filteredLoans = useMemo(() => {
    return loans
      .filter((loan) => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Open / Requested') return loan.status === 'Requested';
        if (activeFilter === 'Active / Funded') return loan.status === 'Active';
        if (activeFilter === 'Closed / Repaid') return loan.status === 'Closed';
        if (activeFilter === 'My Created') return loan.borrower.toLowerCase() === userAddress.toLowerCase();
        if (activeFilter === 'My Funded') return loan.lender && loan.lender.toLowerCase() === userAddress.toLowerCase();
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'apy-high') return b.interestApyBps - a.interestApyBps;
        if (sortBy === 'apy-low') return a.interestApyBps - b.interestApyBps;
        if (sortBy === 'amount-high') {
          return parseFloat(b.borrowAmount.replace(/,/g, '')) - parseFloat(a.borrowAmount.replace(/,/g, ''));
        }
        return b.id.localeCompare(a.id);
      });
  }, [loans, activeFilter, sortBy, userAddress]);

  // Handlers for Create, Fund, Cancel, Close
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxLoading(true);
    setTxMessage('Submitting Create Loan Request to Sepolia / Hardhat...');
    try {
      await createMarketplaceLoan(
        formBorrowAmount,
        formCollateralEth,
        formDurationDays,
        formInterestApyBps
      );

      const parsedAmount = parseFloat(formBorrowAmount || '0');
      const interestRatio = (formInterestApyBps / 10000) * (formDurationDays / 365);
      const totalOwed = (parsedAmount * (1 + interestRatio)).toFixed(2);

      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + formDurationDays);
      const formattedDueDate = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const newLoan: MarketplaceLoan = {
        id: `loan-${Date.now().toString().slice(-4)}`,
        borrower: userAddress,
        borrowAmount: parsedAmount.toLocaleString(),
        collateralEth: parseFloat(formCollateralEth).toFixed(2),
        interestApyBps: formInterestApyBps,
        durationDays: formDurationDays,
        status: 'Requested',
        createdAt: 'Just now',
        expiresAt: `In ${formDurationDays} days`,
        dueDate: formattedDueDate,
        remainingBalance: `${totalOwed} ABCD`,
        monthlyEmi: '0.00 ABCD',
        nextPaymentDate: 'N/A',
        paidEmis: 0,
        totalEmis: Math.max(1, Math.round(formDurationDays / 30)),
        remainingEmis: Math.max(1, Math.round(formDurationDays / 30)),
        accruedInterest: '0.00 ABCD',
      };

      setLoans([newLoan, ...loans]);
      setIsCreateModalOpen(false);
      setTxMessage('Loan Request created successfully!');
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      console.error(err);
      setTxMessage('Failed to create loan request.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleFundLoan = async (loan: MarketplaceLoan) => {
    setTxLoading(true);
    setTxMessage(`Funding Loan #${loan.id} with ${loan.borrowAmount} ABCD...`);
    try {
      await fundMarketplaceLoan(loan.id, loan.borrowAmount.replace(/,/g, ''));

      setLoans(
        loans.map((l) =>
          l.id === loan.id ? { ...l, status: 'Active', lender: userAddress, expiresAt: `In ${l.durationDays} days` } : l
        )
      );
      setTxMessage(`Loan #${loan.id} funding confirmed. LoanNFT certificates are minted only by the on-chain marketplace lifecycle.`);
      if (selectedInspectLoan && selectedInspectLoan.id === loan.id) {
        setSelectedInspectLoan({ ...selectedInspectLoan, status: 'Active', lender: userAddress });
      }
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      console.error(err);
      setTxMessage('Failed to fund loan.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleCancelLoan = async (loan: MarketplaceLoan) => {
    setTxLoading(true);
    setTxMessage(`Cancelling Loan #${loan.id} and releasing collateral...`);
    try {
      await cancelMarketplaceLoan(loan.id);

      setLoans(loans.map((l) => (l.id === loan.id ? { ...l, status: 'Cancelled', remainingBalance: '0.00 ABCD' } : l)));
      setTxMessage(`Cancelled Loan #${loan.id}. Collateral returned.`);
      if (selectedInspectLoan && selectedInspectLoan.id === loan.id) {
        setSelectedInspectLoan({ ...selectedInspectLoan, status: 'Cancelled', remainingBalance: '0.00 ABCD' });
      }
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      console.error(err);
      setTxMessage('Failed to cancel loan.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleCloseLoan = async (loan: MarketplaceLoan) => {
    setTxLoading(true);
    setTxMessage(`Repaying principal + interest to close Loan #${loan.id}...`);
    try {
      await closeMarketplaceLoan(loan.id);

      setLoans(loans.map((l) => (l.id === loan.id ? { ...l, status: 'Closed', remainingBalance: '0.00 ABCD', expiresAt: 'Completed' } : l)));
      setTxMessage(`Closed Loan #${loan.id}. Debt settled and collateral released!`);
      if (selectedInspectLoan && selectedInspectLoan.id === loan.id) {
        setSelectedInspectLoan({ ...selectedInspectLoan, status: 'Closed', remainingBalance: '0.00 ABCD' });
      }
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      console.error(err);
      setTxMessage('Failed to close loan.');
    } finally {
      setTxLoading(false);
    }
  };

  const getStatusBadgeStyle = (status: MarketplaceLoan['status']) => {
    switch (status) {
      case 'Requested':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'Active':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'Closed':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'Cancelled':
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div id="loan-marketplace" className="space-y-6">
      
      {/* MARKETPLACE HEADER & METRICS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="text-xs font-mono font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <span>Lending Protocol</span>
              <span className="text-slate-600">↓</span>
              <span>Loan Details & Marketplace</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
              <Landmark className="w-5 h-5 text-purple-400" />
              P2P & Pool Loan Marketplace
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive loan details displaying Borrower, Lender, Amount, Interest, Duration, Status, Collateral, Due Date, and Remaining Balance.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-lg shadow-purple-500/25 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Loan Request</span>
          </button>
        </div>

        {/* 4 SUMMARY STAT CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-slate-400">Total Marketplace Volume</div>
            <div className="text-base font-extrabold text-purple-400 font-mono mt-1">27,500 ABCD</div>
            <div className="text-[10px] text-slate-500 mt-0.5">13.5 ETH Collateral</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-slate-400">Active Funded Loans</div>
            <div className="text-base font-extrabold text-emerald-400 font-mono mt-1">
              {loans.filter((l) => l.status === 'Active').length} Active
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Earning Lender Interest</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-slate-400">Average APY Yield</div>
            <div className="text-base font-extrabold text-amber-400 font-mono mt-1">10.5% APY</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Fixed Rate Term</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-slate-400">Open Loan Requests</div>
            <div className="text-base font-extrabold text-blue-400 font-mono mt-1">
              {loans.filter((l) => l.status === 'Requested').length} Open
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Awaiting Lender Funding</div>
          </div>
        </div>

        {/* STATUS MESSAGE FEEDBACK */}
        {txMessage && (
          <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-xl text-xs font-mono text-purple-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {txLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
              <span>{txMessage}</span>
            </div>
            <button onClick={() => setTxMessage('')} className="text-slate-500 hover:text-white cursor-pointer">×</button>
          </div>
        )}

        {/* FILTER BAR & SORTING */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-purple-400" /> Filter:
            </span>
            {(
              ['All', 'Open / Requested', 'Active / Funded', 'Closed / Repaid', 'My Created', 'My Funded'] as LoanMarketplaceFilter[]
            ).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition cursor-pointer ${
                  activeFilter === filter
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 border border-purple-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500 font-mono cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="apy-high">Highest APY</option>
              <option value="apy-low">Lowest APY</option>
              <option value="amount-high">Highest Borrow Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* LOANS GRID (9 EXPLICIT LOAN DETAIL FIELDS DISPLAYED ON EACH CARD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {filteredLoans.map((loan) => {
          const isBorrower = loan.borrower.toLowerCase() === userAddress.toLowerCase();
          const isLender = loan.lender && loan.lender.toLowerCase() === userAddress.toLowerCase();

          return (
            <div
              key={loan.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-6 shadow-xl space-y-4 transition-all hover:scale-[1.01] group relative"
            >
              {/* Card Header: Loan ID & Status Badge */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono font-bold text-xs">
                    #{loan.id.split('-')[1]}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <span>Loan Request #{loan.id}</span>
                      {isBorrower && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                          My Loan
                        </span>
                      )}
                      {isLender && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                          Funded by Me
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Created {loan.createdAt}</div>
                  </div>
                </div>

                {/* 6. STATUS */}
                <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border ${getStatusBadgeStyle(loan.status)}`}>
                  {loan.status}
                </span>
              </div>

              {/* 9 LOAN DETAILS STRUCTURED GRID */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-xs font-mono">
                {/* 1. BORROWER */}
                <div className="col-span-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">1. Borrower</div>
                  <a
                    href={`https://sepolia.etherscan.io/address/${loan.borrower}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-200 font-bold hover:text-indigo-400 hover:underline text-[11px] truncate block mt-0.5"
                    title={loan.borrower}
                  >
                    {loan.borrower.substring(0, 6)}...{loan.borrower.substring(loan.borrower.length - 4)}
                  </a>
                </div>

                {/* 2. LENDER */}
                <div className="col-span-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">2. Lender</div>
                  <div className="text-slate-200 font-bold text-[11px] truncate mt-0.5">
                    {loan.lender ? `${loan.lender.substring(0, 6)}...${loan.lender.substring(loan.lender.length - 4)}` : 'Open Request'}
                  </div>
                </div>

                {/* 3. AMOUNT */}
                <div className="col-span-1 text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">3. Amount</div>
                  <div className="text-amber-400 font-extrabold text-[12px] mt-0.5">{loan.borrowAmount} ABCD</div>
                </div>

                {/* 4. INTEREST */}
                <div className="col-span-1 pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">4. Interest (APY)</div>
                  <div className="text-purple-400 font-bold text-[11px] mt-0.5">{(loan.interestApyBps / 100).toFixed(1)}% APY</div>
                </div>

                {/* 5. DURATION */}
                <div className="col-span-1 pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">5. Duration</div>
                  <div className="text-slate-200 font-bold text-[11px] mt-0.5">{loan.durationDays} Days</div>
                </div>

                {/* 7. COLLATERAL */}
                <div className="col-span-1 text-right pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">7. Collateral</div>
                  <div className="text-emerald-400 font-extrabold text-[11px] mt-0.5">{loan.collateralEth} ETH</div>
                </div>

                {/* 8. DUE DATE */}
                <div className="col-span-2 pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">8. Due Date</div>
                  <div className="text-indigo-300 font-semibold text-[11px] mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    <span>{loan.dueDate}</span>
                  </div>
                </div>

                {/* 9. REMAINING BALANCE */}
                <div className="col-span-1 text-right pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">9. Rem. Balance</div>
                  <div className="text-rose-400 font-extrabold text-[11px] mt-0.5">{loan.remainingBalance}</div>
                </div>
              </div>

              {/* CARD BOTTOM: Inspect Button & Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedInspectLoan(loan)}
                  className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-purple-400" />
                  <span>Inspect Details</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* 1. FUND LOAN */}
                  {loan.status === 'Requested' && !isBorrower && (
                    <button
                      onClick={() => handleFundLoan(loan)}
                      disabled={txLoading}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Fund Loan</span>
                    </button>
                  )}

                  {/* 2. CANCEL LOAN */}
                  {loan.status === 'Requested' && isBorrower && (
                    <button
                      onClick={() => handleCancelLoan(loan)}
                      disabled={txLoading}
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {/* 3. CLOSE LOAN */}
                  {loan.status === 'Active' && (isBorrower || isLender) && (
                    <button
                      onClick={() => handleCloseLoan(loan)}
                      disabled={txLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Close Loan</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* INSPECT LOAN DETAILS MODAL */}
      {selectedInspectLoan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 font-mono">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Loan Details Breakdown #{selectedInspectLoan.id}</h3>
                  <p className="text-xs text-slate-400">Complete 9-field smart contract inspection trace</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInspectLoan(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 9 LOAN DETAIL FIELDS IN MODAL */}
            <div className="space-y-3 text-xs divide-y divide-slate-800/80">
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">1. Borrower Wallet:</span>
                <span className="text-white font-bold">{selectedInspectLoan.borrower}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">2. Lender Wallet:</span>
                <span className="text-white font-bold">{selectedInspectLoan.lender || 'Open (No Lender Yet)'}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">3. Principal Amount:</span>
                <span className="text-amber-400 font-extrabold">{selectedInspectLoan.borrowAmount} ABCD</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">4. Interest APY Rate:</span>
                <span className="text-purple-400 font-bold">{(selectedInspectLoan.interestApyBps / 100).toFixed(1)}% APY</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">5. Loan Duration:</span>
                <span className="text-slate-200 font-bold">{selectedInspectLoan.durationDays} Days</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">6. Real-Time Status:</span>
                <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${getStatusBadgeStyle(selectedInspectLoan.status)}`}>
                  {selectedInspectLoan.status}
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">7. Locked ETH Collateral:</span>
                <span className="text-emerald-400 font-extrabold">{selectedInspectLoan.collateralEth} ETH (~66.7% LTV)</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">8. Settlement Due Date:</span>
                <span className="text-indigo-300 font-semibold">{selectedInspectLoan.dueDate}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">9. Remaining Balance Owed:</span>
                <span className="text-rose-400 font-extrabold">{selectedInspectLoan.remainingBalance}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedInspectLoan(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CREATE LOAN REQUEST MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Create Loan Request</h3>
                  <p className="text-xs text-slate-400">Lock ETH collateral to borrow ABCD tokens from lenders</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Borrow Amount (ABCD Tokens)</label>
                <input
                  type="number"
                  value={formBorrowAmount}
                  onChange={(e) => setFormBorrowAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ETH Collateral Offered</label>
                <input
                  type="number"
                  step="0.01"
                  value={formCollateralEth}
                  onChange={(e) => setFormCollateralEth(e.target.value)}
                  placeholder="e.g. 1.5"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Loan Duration (Days)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 14, 30, 60].map((days) => (
                    <button
                      type="button"
                      key={days}
                      onClick={() => setFormDurationDays(days)}
                      className={`py-2 rounded-xl border text-center transition cursor-pointer ${
                        formDurationDays === days
                          ? 'bg-purple-600 text-white font-bold border-purple-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Offered Interest APY (%)</label>
                <select
                  value={formInterestApyBps}
                  onChange={(e) => setFormInterestApyBps(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value={500}>5.0% APY</option>
                  <option value={800}>8.0% APY</option>
                  <option value={1000}>10.0% APY (Standard)</option>
                  <option value={1200}>12.0% APY</option>
                  <option value={1500}>15.0% APY (High Yield)</option>
                </select>
              </div>

              <div className="bg-slate-950 border border-purple-500/20 p-4 rounded-2xl space-y-2 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Collateral Ratio (LTV):</span>
                  <span className="text-emerald-400 font-bold">~66.7% LTV (Safe)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estimated Total Repayment:</span>
                  <span className="text-amber-400 font-bold">
                    {(
                      parseFloat(formBorrowAmount || '0') *
                      (1 + (formInterestApyBps / 10000) * (formDurationDays / 365))
                    ).toFixed(2)}{' '}
                    ABCD
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txLoading}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-purple-500/25 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {txLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMI SYSTEM COMPONENT */}
      <div className="pt-6 border-t border-slate-800">
        <EMISystem onEmiPaid={onActionSuccess} />
      </div>

      {/* MARGIN CALL & LIQUIDATION ENGINE */}
      <div className="pt-6 border-t border-slate-800">
        <MarginCallSystem onRiskUpdate={onActionSuccess} />
      </div>

    </div>
  );
};

export default LoanMarketplace;
