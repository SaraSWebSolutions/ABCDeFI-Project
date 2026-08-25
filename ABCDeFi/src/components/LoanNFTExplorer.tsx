import React, { useState } from 'react';
import {
  ShieldCheck,
  Award,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  Clock,
  Sparkles,
  TrendingUp,
  Landmark,
  CreditCard,
  AlertTriangle,
  Flame,
  Zap,
  BarChart2,
  DollarSign,
  UserCheck,
  Bot,
} from 'lucide-react';
import {
  INITIAL_LOAN_NFTS,
  INITIAL_ANALYTICS_STATS,
  LoanNFTItem,
  handleLoanCompletionAndMintNFTs,
} from '../Services/loanWorkflow';

export const LoanNFTExplorer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'analytics' | 'workflow'>('explorer');

  // Explorer Filter State
  const [nftFilter, setNftFilter] = useState<'All' | 'Borrower NFTs' | 'Lender NFTs' | 'Platform NFTs'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Loan State
  const [nftList, setNftList] = useState<LoanNFTItem[]>(INITIAL_LOAN_NFTS);
  const [analytics, setAnalytics] = useState(INITIAL_ANALYTICS_STATS);
  const [simulating, setSimulating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Phase 5 & 6 Demo Handler: Settle Loan ➔ Unlock Collateral ➔ Automatic Mint 3 NFTs
  const handleSimulateLoanCompletion = async () => {
    setSimulating(true);
    setFeedbackMsg('Settling outstanding balance to $0... Unlocking ETH Collateral...');
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await handleLoanCompletionAndMintNFTs(
        1005,
        3500,
        280,
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
        7.0
      );
      setNftList([res.borrowerNft, res.lenderNft, res.platformNft, ...nftList]);
      setFeedbackMsg(
        '✓ Loan Completed! Collateral Released (7.0 ETH). Minted 3 NFTs: Borrower NFT, Lender NFT, and Platform NFT.'
      );
    } catch {
      setFeedbackMsg('Failed to complete loan workflow.');
    } finally {
      setSimulating(false);
    }
  };

  const filteredNFTs = nftList.filter((nft) => {
    if (nftFilter === 'Borrower NFTs' && nft.nftType !== 'Borrower NFT') return false;
    if (nftFilter === 'Lender NFTs' && nft.nftType !== 'Lender NFT') return false;
    if (nftFilter === 'Platform NFTs' && nft.nftType !== 'Platform NFT') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        nft.metadata.loanId.toString().includes(q) ||
        nft.metadata.borrower.toLowerCase().includes(q) ||
        nft.metadata.lender.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div id="loan-nft-explorer" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <span>Phases 4–8</span>
            <span className="text-slate-600">↓</span>
            <span>Loan Lifecycle, NFT Minting & Analytics</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Award className="w-5 h-5 text-purple-400" />
            Loan NFT Explorer & Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatic 3 NFT Minting (Lender, Borrower, Platform) upon loan completion, with explorer & analytics.
          </p>
        </div>

        {/* TAB BUTTONS */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'explorer', label: `NFT Explorer (${nftList.length})`, icon: Layers },
            { id: 'analytics', label: 'Analytics Charts', icon: BarChart2 },
            { id: 'workflow', label: 'Workflow Demo', icon: Zap },
          ].map((t) => {
            const IC = t.icon;
            const sel = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  sel
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 border border-purple-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <IC className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className="p-3.5 bg-purple-950/40 border border-purple-800/50 rounded-xl text-xs text-purple-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 7: LOAN NFT EXPLORER                                               */}
      {/* ========================================================================= */}
      {activeTab === 'explorer' && (
        <div className="space-y-6">
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Filter NFT Type:</span>
              {(['All', 'Borrower NFTs', 'Lender NFTs', 'Platform NFTs'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNftFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    nftFilter === cat
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Loan ID, address..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* NFT CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredNFTs.map((nft) => (
              <div
                key={nft.id}
                className="bg-slate-950 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 shadow-xl space-y-4 transition group"
              >
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">
                      Loan NFT #{nft.tokenId}
                    </div>
                    <h3 className="text-sm font-black text-white mt-0.5">Loan #{nft.metadata.loanId} Certificate</h3>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border ${
                    nft.nftType === 'Borrower NFT'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      : nft.nftType === 'Lender NFT'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {nft.nftType}
                  </span>
                </div>

                {/* METADATA JSON PREVIEW */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Principal:</span>
                    <span className="font-bold text-white">${nft.metadata.principal.toLocaleString()} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Interest Earned:</span>
                    <span className="font-bold text-emerald-400">+${nft.metadata.interest.toLocaleString()} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Borrower:</span>
                    <span className="font-mono text-slate-300 text-[11px]">{nft.metadata.borrower.substring(0, 6)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lender:</span>
                    <span className="font-mono text-slate-300 text-[11px]">{nft.metadata.lender.substring(0, 6)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Completion Date:</span>
                    <span className="font-bold text-purple-300">{nft.completionDate}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Status:</span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      {nft.metadata.status} ✓
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                  <span>Collateral Released: {nft.collateralReleasedETH} ETH</span>
                  <span className="text-purple-400 font-bold">Owner: {nft.owner.substring(0, 6)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 8: LOAN ANALYTICS DASHBOARD                                        */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">1. Active Loans</div>
              <div className="text-2xl font-black text-indigo-400">{analytics.activeLoans} Loans</div>
              <div className="text-[10px] text-slate-400">Currently Earning Interest</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">2. Completed Loans</div>
              <div className="text-2xl font-black text-emerald-400">{analytics.completedLoans} Loans</div>
              <div className="text-[10px] text-emerald-400 font-bold">100% Repaid & NFT Minted</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">3. Defaulted Loans</div>
              <div className="text-2xl font-black text-amber-400">{analytics.defaultedLoans} Loans</div>
              <div className="text-[10px] text-slate-400">Past Due Date</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">4. Liquidated Loans</div>
              <div className="text-2xl font-black text-rose-400">{analytics.liquidatedLoans} Loans</div>
              <div className="text-[10px] text-rose-400">Collateral Seized</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold">Interest Earned</div>
              <div className="text-2xl font-black text-emerald-400">${analytics.interestEarnedUSD.toLocaleString()} USD</div>
              <div className="text-[10px] text-slate-400">Distributed to Lenders & Treasury</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold">Treasury Balance</div>
              <div className="text-2xl font-black text-purple-400">${(analytics.treasuryBalanceUSD / 1000000).toFixed(2)}M USD</div>
              <div className="text-[10px] text-slate-400">Protocol Protocol Reserves</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold">Total Borrowed</div>
              <div className="text-2xl font-black text-cyan-400">${(analytics.totalBorrowedUSD / 1000000).toFixed(2)}M USD</div>
              <div className="text-[10px] text-slate-400">Cumulative Volume</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASES 4–6: WORKFLOW DEMO (Pay EMI, Settlement, Automatic Minting)       */}
      {/* ========================================================================= */}
      {activeTab === 'workflow' && (
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase">Loan Lifecycle Simulation Workflow</h3>
              <p className="text-xs text-slate-400">Pay EMI ➔ Interest Distribution ➔ Loan Completion ➔ Collateral Unlock ➔ Mint 3 NFTs</p>
            </div>
            <button
              onClick={handleSimulateLoanCompletion}
              disabled={simulating}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black px-6 py-2.5 rounded-2xl text-xs shadow-lg shadow-purple-500/25 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {simulating ? <Clock className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>Simulate Loan Completion & Mint 3 NFTs</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="font-bold text-white uppercase flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Phase 4: Pay EMI & Claim Interest
              </div>
              <p className="text-slate-400 text-[11px]">
                Borrower pays EMI. Contract receives payment, updates remaining balance, emits `InstallmentPaid`, and distributes interest to Lender, Treasury, and Reserve fund.
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="font-bold text-white uppercase flex items-center gap-1.5 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Phase 5: Completion & Collateral Unlock
              </div>
              <p className="text-slate-400 text-[11px]">
                When Outstanding Balance reaches 0, loan status updates from `Active` to `Completed`, and ETH collateral is automatically unlocked to Borrower.
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="font-bold text-white uppercase flex items-center gap-1.5 text-[11px]">
                <Award className="w-4 h-4 text-amber-400" /> Phase 6: Automatic 3 NFT Minting
              </div>
              <p className="text-slate-400 text-[11px]">
                Upon completion, `LoanNFT.sol` automatically mints 3 certificates: Lender NFT, Borrower NFT, and Platform NFT with metadata stored on IPFS.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LoanNFTExplorer;
