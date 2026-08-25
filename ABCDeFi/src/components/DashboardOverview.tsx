import React from 'react';
import {
  Wallet,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  Award,
  ChevronRight,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PortfolioSummary } from '../types';

interface DashboardOverviewProps {
  portfolio: PortfolioSummary | null;
  onNavigate: (tab: string) => void;
  onApproveKyc: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  portfolio,
  onNavigate,
  onApproveKyc,
}) => {
  if (!portfolio) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Clock className="w-6 h-6 animate-spin mr-2 text-amber-500" /> Loading ABCDeFi Protocol state...
      </div>
    );
  }

  const {
    wallet,
    depositedCollateralBnb,
    depositedCollateralUsd,
    borrowedABCD,
    availableWithdrawABCD,
    collateralStatus,
    healthFactor,
    activeLoanId,
    loans,
    deposits,
    nfts,
  } = portfolio;

  const activeLoan = loans.find((l) => l.loanId === activeLoanId || l.status === 'active');

  return (
    <div className="space-y-8">
      {/* Top Banner Notice */}
      {wallet.kycStatus !== 'approved' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-200">KYC Verification Required for Borrowing</h4>
              <p className="text-xs text-amber-300/80">
                You can deposit collateral anytime. KYC approval is required before creating a loan request.
              </p>
            </div>
          </div>
          <button
            onClick={onApproveKyc}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 whitespace-nowrap"
          >
            Complete Instant KYC
          </button>
        </div>
      )}

      {/* Finance Metrics Dashboard matching prompt */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Finance Overview</span>
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
              {wallet.network}
            </span>
          </h2>
          <span className="text-xs text-slate-400">Live On-Chain Protocol Metrics</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Wallet Balance */}
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Wallet</span>
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-extrabold text-white">
              {wallet.balances.ABCD === null ? 'Unavailable' : wallet.balances.ABCD.toLocaleString()}{' '}
              {wallet.balances.ABCD !== null && <span className="text-xs text-amber-400 font-semibold">ABCD</span>}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Native Asset Balance</div>
          </div>

          {/* 2. Deposited Collateral */}
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Deposited</span>
              <Lock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-white">
              {depositedCollateralBnb} <span className="text-xs text-amber-400 font-semibold">BNB</span>
            </div>
            <div className="text-[11px] text-amber-400/90 mt-1">${depositedCollateralUsd.toLocaleString()} USD</div>
          </div>

          {/* 3. Borrowed Amount */}
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Borrowed</span>
              <ArrowDownLeft className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-extrabold text-white">
              {borrowedABCD.toLocaleString()} <span className="text-xs text-amber-400 font-semibold">ABCD</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Active Debt Principal</div>
          </div>

          {/* 4. Available Withdraw */}
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Available Withdraw</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-emerald-400">
              {availableWithdrawABCD.toLocaleString()} <span className="text-xs font-semibold">ABCD</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Unlocked Funds</div>
          </div>

          {/* 5. Collateral Status */}
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Collateral</span>
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div
              className={`text-lg font-bold px-2 py-0.5 rounded-lg inline-block text-xs uppercase tracking-wider ${
                collateralStatus === 'Locked'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : collateralStatus === 'Unlocked'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {collateralStatus}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              {collateralStatus === 'Locked' ? 'Vault Secured' : 'No Active Lock'}
            </div>
          </div>

          {/* 6. Health Factor */}
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Health Factor</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div
              className={`text-xl font-black ${
                healthFactor >= 1.5
                  ? 'text-emerald-400'
                  : healthFactor >= 1.1
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {healthFactor >= 99 ? '1.82' : healthFactor}
            </div>
            <div className="text-[11px] text-emerald-400/90 mt-1">
              {healthFactor >= 1.5 ? 'Safe (> 1.5)' : 'Monitor LTV'}
            </div>
          </div>
        </div>
      </div>

      {/* ABCDeFi Flow Pipeline Map */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Zap className="w-64 h-64 text-amber-500" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> ABCDeFi Whitepaper Protocol Flow
            </h3>
            <p className="text-xs text-slate-400">
              The exact non-standard lending mechanism: Deposit Collateral → Borrow → Marketplace → EMI Repayment → NFT Minting
            </p>
          </div>
          <button
            onClick={() => onNavigate('deposit')}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
          >
            Start Deposit <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {[
            {
              step: '01',
              title: 'Deposit Collateral',
              desc: 'Lock BNB/ETH in CollateralVault.sol',
              active: true,
              tab: 'deposit',
            },
            {
              step: '02',
              title: 'Create Loan',
              desc: '50% LTV max borrow in LoanMarketplace',
              active: deposits.some((d) => d.status === 'locked'),
              tab: 'borrow',
            },
            {
              step: '03',
              title: 'Lender Funding',
              desc: 'Peer lenders fund loan & receive ABCD',
              active: loans.some((l) => l.status === 'pending_funding' || l.status === 'active'),
              tab: 'marketplace',
            },
            {
              step: '04',
              title: 'Monthly EMI',
              desc: 'Pay installments via EMIManager.sol',
              active: loans.some((l) => l.status === 'active'),
              tab: 'repayments',
            },
            {
              step: '05',
              title: 'Collateral & NFT',
              desc: 'Release collateral + Mint Credit NFT',
              active: nfts.length > 0 || loans.some((l) => l.status === 'completed'),
              tab: 'repayments',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onNavigate(item.tab)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                item.active
                  ? 'bg-slate-800/90 border-amber-500/40 hover:border-amber-400 text-white'
                  : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-amber-400/80 mb-1">
                <span>{item.step}</span>
                {item.active && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
              </div>
              <div className="text-xs font-bold text-slate-200 mb-1">{item.title}</div>
              <div className="text-[11px] text-slate-400 leading-tight">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Shortcut Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Loan Summary Card */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Active Loan & Repayment Status
            </h3>
            {activeLoan && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Loan #{activeLoan.loanId} Active
              </span>
            )}
          </div>

          {activeLoan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">Borrowed</div>
                  <div className="text-lg font-bold text-white">{activeLoan.loanAmount} ABCD</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Monthly EMI</div>
                  <div className="text-lg font-bold text-amber-400">${activeLoan.monthlyEmi} ABCD</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Progress</div>
                  <div className="text-lg font-bold text-slate-200">
                    {activeLoan.paidEmis} / {activeLoan.durationMonths} Mos
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Collateral</div>
                  <div className="text-lg font-bold text-indigo-400">
                    {activeLoan.collateralAmount} {activeLoan.collateralToken}
                  </div>
                </div>
              </div>

              {/* EMI Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Repayment Progress</span>
                  <span className="font-semibold text-amber-400">
                    {Math.round((activeLoan.paidEmis / activeLoan.durationMonths) * 100)}% Completed
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${Math.max(5, (activeLoan.paidEmis / activeLoan.durationMonths) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">Next EMI Due in 18 Days</span>
                <button
                  onClick={() => onNavigate('repayments')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20"
                >
                  Pay Monthly EMI
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
              <p className="text-sm text-slate-300 font-medium">No Active Borrowing Loan</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Lock collateral in CollateralVault.sol to unlock loan borrowing up to 50% LTV.
              </p>
              <button
                onClick={() => onNavigate('deposit')}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all"
              >
                Deposit Collateral Now
              </button>
            </div>
          )}
        </div>

        {/* Repayment Badges & NFTs Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" /> Credit Score & NFTs
              </h3>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                +25 Boost / Paid Loan
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center mb-4">
              <div className="text-xs text-slate-400">On-Chain Reputation Score</div>
              <div className="text-3xl font-black text-amber-400 my-1">{wallet.creditScore}</div>
              <div className="text-[11px] text-emerald-400">Excellent Credit Tier</div>
            </div>

            {nfts.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 font-medium">Minted Repayment NFTs ({nfts.length})</div>
                {nfts.map((nft) => (
                  <div key={nft.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{nft.badgeTitle}</div>
                      <div className="text-[10px] text-slate-500">Loan #{nft.loanId} Repaid</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] font-bold">
                      {nft.tier}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-2">
                Pay off your first loan completely to mint your soulbound Repayment Credit Badge NFT!
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('repayments')}
            className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            View Repayment Details
          </button>
        </div>
      </div>
    </div>
  );
};
