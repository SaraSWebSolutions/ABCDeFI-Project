import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Layers,
  Sparkles,
  Landmark,
  Image as ImageIcon,
  Gift,
  Download,
  Lock,
  RefreshCw,
  Database,
  Hash,
  Globe,
} from 'lucide-react';
import { getTransactions, TransactionRecord } from '../Services/transactionHistory';
import { useAuth } from '../Context/AuthContext';
import { useWallet } from '../Context/WalletContext';

export type TxFilterCategory =
  | 'All'
  | 'Transfers'
  | 'Presale'
  | 'Staking'
  | 'Lending'
  | 'Borrowing'
  | 'NFTs'
  | 'Rewards'
  | 'Referrals';

interface TransactionHistoryProps {
  transactions?: TransactionRecord[];
  onRefresh?: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions: suppliedTransactions,
  onRefresh,
}) => {
  const { token } = useAuth();
  const wallet = useWallet();
  const [transactions, setTransactions] = useState<TransactionRecord[]>(suppliedTransactions || []);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TxFilterCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const refreshHistory = useCallback(async (signal?: AbortSignal) => {
    if (suppliedTransactions) {
      setTransactions(suppliedTransactions);
      return;
    }
    if (!token || !wallet.address || !wallet.isConnected) {
      setTransactions([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      setTransactions(await getTransactions(token, wallet.address, signal));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setTransactions([]);
        setLoadError((error as Error).message || 'Transaction history is unavailable.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [suppliedTransactions, token, wallet.address, wallet.isConnected]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshHistory(controller.signal);
    return () => controller.abort();
  }, [refreshHistory]);

  // Category Filter Mapping for Step 13 activity categories
  const isTypeInFilter = (type: TransactionRecord['type'], filter: TxFilterCategory): boolean => {
    switch (filter) {
      case 'All':
        return true;
      case 'Transfers':
        return type === 'Token Transfer';
      case 'Presale':
        return type === 'Buy Token';
      case 'Staking':
        return type === 'Stake' || type === 'Unstake';
      case 'Lending':
        return type === 'Deposit Collateral' || type === 'Release Collateral';
      case 'Borrowing':
        return type === 'Borrow' || type === 'Repay';
      case 'NFTs':
        return type === 'NFT Mint' || type === 'NFT Purchase';
      case 'Rewards':
        return type === 'Claim Reward' || type === 'Referral Reward';
      case 'Referrals':
        return type === 'Referral Reward';
      default:
        return true;
    }
  };

  // Filtered & Searched Dataset
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => isTypeInFilter(tx.type, activeFilter))
      .filter(
        (tx) =>
          tx.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.userAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.amount.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (tx.loanId && tx.loanId.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (tx.nftId && tx.nftId.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        const direction = sortBy === 'oldest' ? 1 : -1;
        return direction * (a.blockNumber - b.blockNumber || a.id.localeCompare(b.id));
      });
  }, [transactions, activeFilter, searchQuery, sortBy]);

  // Icon Helper for Step 13 Transaction Types
  const getTypeIcon = (type: TransactionRecord['type']) => {
    switch (type) {
      case 'Token Transfer':
        return <ArrowUpRight className="w-4 h-4 text-cyan-400" />;
      case 'Buy Token':
        return <ShoppingBag className="w-4 h-4 text-amber-400" />;
      case 'Stake':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'Unstake':
        return <ArrowDownRight className="w-4 h-4 text-rose-400" />;
      case 'Claim Reward':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'Borrow':
        return <ArrowUpRight className="w-4 h-4 text-purple-400" />;
      case 'Repay':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'Deposit Collateral':
        return <Landmark className="w-4 h-4 text-indigo-400" />;
      case 'Release Collateral':
        return <ArrowDownRight className="w-4 h-4 text-teal-400" />;
      case 'NFT Mint':
        return <ImageIcon className="w-4 h-4 text-rose-400" />;
      case 'NFT Purchase':
        return <ShoppingBag className="w-4 h-4 text-purple-400" />;
      case 'Referral Reward':
        return <Gift className="w-4 h-4 text-cyan-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  // Type Badge Color Helper
  const getTypeBadgeStyle = (type: TransactionRecord['type']) => {
    switch (type) {
      case 'Token Transfer':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'Buy Token':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'Stake':
      case 'Claim Reward':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'Unstake':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'Borrow':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'Repay':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'Deposit Collateral':
      case 'Release Collateral':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
      case 'NFT Mint':
      case 'NFT Purchase':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'Referral Reward':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Export CSV Helper matching all 12 Schema Fields
  const handleExportCSV = () => {
    const headers = [
      'id',
      'txHash',
      'userAddress',
      'type',
      'amount',
      'token',
      'status',
      'loanId',
      'nftId',
      'blockNumber',
      'timestamp',
      'network',
    ];
    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.txHash,
      tx.userAddress,
      tx.type,
      `"${tx.amount}"`,
      tx.token,
      tx.status,
      tx.loanId || '',
      tx.nftId || '',
      tx.blockNumber,
      tx.timestamp,
      tx.network,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ABCDeFi_Transactions_Schema_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="transaction-history" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <span>Transaction History</span>
            <span className="text-slate-600">↓</span>
            <span>Canonical indexed on-chain events</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Database className="w-5 h-5 text-indigo-400" />
            Transaction History ({filteredTransactions.length} Records)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Source: authenticated API → canonical chain 31337 indexer. No transactions are shown until a wallet is explicitly connected.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export CSV</span>
          </button>

          {(onRefresh || wallet.address) && (
            <button
              onClick={() => { onRefresh?.(); void refreshHistory(); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-indigo-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{loading ? 'Loading…' : 'Refresh History'}</span>
            </button>
          )}
        </div>
      </div>

      {/* CATEGORY FILTERS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-indigo-400" /> Filter:
          </span>
          {(
            ['All', 'Transfers', 'Presale', 'Staking', 'Lending', 'Borrowing', 'NFTs', 'Rewards', 'Referrals'] as TxFilterCategory[]
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeFilter === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-500/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address, hash, loanId..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* TRANSACTION ITEMS TABLE / LIST DISPLAYING ALL 12 FIELDS */}
      {!wallet.isConnected || !wallet.address ? (
        <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-2xl">
          <Lock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Connect and verify a wallet to view its indexed transaction history.</p>
        </div>
      ) : loading ? (
        <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-indigo-400 mx-auto mb-2 animate-spin" />
          <p className="text-xs text-slate-400">Loading canonical on-chain events…</p>
        </div>
      ) : loadError ? (
        <div className="p-12 text-center bg-slate-950 border border-rose-500/30 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="text-xs text-rose-300">{loadError}</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-2xl">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No indexed on-chain events found matching "{activeFilter}".</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60 bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
          {filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/40 transition group"
            >
              <div className="flex items-start md:items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  {getTypeIcon(tx.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white tracking-tight">{tx.id}</span>
                    <span
                      className={`px-2.5 py-0.5 text-[10px] rounded-lg font-bold border ${getTypeBadgeStyle(
                        tx.type
                      )}`}
                    >
                      {tx.type}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      {tx.token}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-3">
                    <span>User: <strong className="text-slate-300">{tx.userAddress.substring(0, 6)}...{tx.userAddress.substring(38)}</strong></span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Hash className="w-3 h-3 text-indigo-400" /> Hash: {tx.txHash.substring(0, 10)}...
                    </span>
                    <span>• Block #{tx.blockNumber}</span>
                    <span>• {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Block timestamp unavailable'}</span>
                    <span>• {tx.network}</span>
                    {tx.loanId && <span className="text-purple-300 font-bold">• Loan: {tx.loanId}</span>}
                    {tx.nftId && <span className="text-pink-300 font-bold">• NFT: {tx.nftId}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-400">
                    {tx.amount}
                  </div>
                  <div className="text-[10px] text-slate-500">Amount</div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-xl">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{tx.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FOOTER SUMMARY */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 border-t border-slate-800/80 pt-4">
        <div>
          Showing <strong className="text-white">{filteredTransactions.length}</strong> of{' '}
          <strong className="text-white">{transactions.length}</strong> indexed records
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Canonical chain data
          </span>
        </div>
      </div>

    </div>
  );
};

export default TransactionHistory;
