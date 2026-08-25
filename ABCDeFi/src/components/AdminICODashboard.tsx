import React, { useState } from 'react';
import {
  ShieldCheck,
  Coins,
  Gift,
  Users,
  FileCheck2,
  ArrowRightLeft,
  BarChart3,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Eye,
  ToggleLeft,
  ToggleRight,
  Download,
  Wallet,
} from 'lucide-react';

// Services
import {
  getAllocationWallets,
  getDistributionHistory,
  getPromotionPool,
  distributeICOFunds,
  getICOAnalytics,
  exportICOReport,
  togglePromotionPool,
} from '../Services/icoFundAllocation';
import {
  getBonusPoolStatus,
  getBonusRules,
  getClaimsHistory,
  toggleBonusRule,
  updateClaimStatus,
  type BonusRule,
  type UserBonusClaim,
} from '../Services/bonusEngine';
import {
  getAllReferralLinks,
  getAllPurchaseEvents,
  toggleReferralLink,
} from '../Services/referralPromotion';
import {
  getPendingDocuments,
  getAllDocuments,
  approveVerification,
  rejectVerification,
  getVerificationStats,
} from '../Services/bonusVerification';
import {
  getReserveTransferHistory,
  getReserveTransferStats,
  checkAndTransferUnusedBonuses,
} from '../Services/reserveAccounting';

type AdminICOTab = 'overview' | 'rounds' | 'price' | 'bonus' | 'promotion' | 'verification' | 'allocation' | 'reserve' | 'reports';

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n.toFixed(0)}`;

const fmtUSD = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`;

export const AdminICODashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminICOTab>('overview');
  const [actionMsg, setActionMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  // Load data
  const analytics = getICOAnalytics();
  const bonusPool = getBonusPoolStatus();
  const promoPool = getPromotionPool();
  const bonusRules = getBonusRules();
  const claims = getClaimsHistory();
  const referralLinks = getAllReferralLinks();
  const purchaseEvents = getAllPurchaseEvents();
  const pendingDocs = getPendingDocuments();
  const allDocs = getAllDocuments();
  const verifyStats = getVerificationStats();
  const reserveHistory = getReserveTransferHistory();
  const reserveStats = getReserveTransferStats();
  const allocationWallets = getAllocationWallets();
  const distributions = getDistributionHistory();

  const doAction = (msg: string, fn: () => void) => {
    setProcessing(true);
    setActionMsg(msg);
    setTimeout(() => {
      fn();
      setProcessing(false);
      setActionMsg('');
    }, 400);
  };

  const tabs: { id: AdminICOTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: '📊 Round Management', icon: BarChart3 },
    { id: 'price', label: '💵 Token Price', icon: Coins },
    { id: 'bonus', label: '🎁 Bonus Rules', icon: Gift },
    { id: 'promotion', label: '🤝 Referral Rules', icon: Users },
    { id: 'allocation', label: '🥧 Token Allocation', icon: Wallet },
    { id: 'verification', label: '👥 Participants / KYC', icon: FileCheck2 },
    { id: 'reserve', label: '🏦 Reserve Transfers', icon: ArrowRightLeft },
    { id: 'reports', label: '📄 Reports & Audit', icon: Download },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>ICO Administration</span>
            <span className="text-slate-600">→</span>
            <span>Bonus, Promotion & Fund Allocation</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Coins className="w-6 h-6 text-amber-400" />
            ICO Bonus & Promotion Admin Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage bonus tiers, promotion pool, verification queue, fund allocation, and reserve transfers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> ICO_ADMIN
          </span>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionMsg && (
        <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {processing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
            <span>{actionMsg}</span>
          </div>
          <button onClick={() => setActionMsg('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-800 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================== */}
      {/* TAB: OVERVIEW                                                       */}
      {/* ================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Total Raised</div>
              <div className="text-xl font-black text-amber-400 mt-1">{fmtUSD(analytics.totalRaisedUSD)}</div>
              <div className="text-[10px] text-emerald-400 font-bold">All Phases</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Bonus Pool</div>
              <div className="text-xl font-black text-white mt-1">{fmtTokens(bonusPool.remainingTokens)} ABCD</div>
              <div className="text-[10px] text-slate-500">{bonusPool.utilizationPercent.toFixed(1)}% Used of 15M Cap</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Promotion Pool</div>
              <div className="text-xl font-black text-emerald-400 mt-1">{fmtTokens(promoPool.remainingTokens)} ABCD</div>
              <div className="text-[10px] text-slate-500">{promoPool.isActive ? '✅ Active' : '❌ Inactive'}</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Reserve Transfers</div>
              <div className="text-xl font-black text-indigo-300 mt-1">{fmtTokens(reserveStats.totalTokensTransferred)}</div>
              <div className="text-[10px] text-slate-500">{reserveStats.totalTransfers} Transfers</div>
            </div>
          </div>

          {/* Bonus Pool Gauge */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">🎯 Bonus Allocation Cap — 1.5% of Total Supply</span>
              <span className="text-xs text-amber-400 font-bold">{fmtTokens(bonusPool.totalDistributedTokens)} / {fmtTokens(bonusPool.totalCapTokens)} ABCD</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  bonusPool.capReached ? 'bg-rose-500' : bonusPool.utilizationPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(bonusPool.utilizationPercent, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px]">
              {Object.entries(bonusPool.byType).map(([type, amount]) => (
                <div key={type} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-center">
                  <div className="text-slate-400 capitalize">{type.replace('_', ' ')}</div>
                  <div className="font-bold text-white mt-0.5">{fmtTokens(amount)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Claims */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2">Recent Bonus Claims</div>
            <div className="space-y-2 text-xs">
              {claims.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <span className="font-bold text-white">{c.userName}</span>
                    <span className="text-slate-500 ml-2">{c.walletAddress.slice(0, 10)}...</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 font-bold">+{fmtTokens(c.totalBonusTokens)} ABCD</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                      c.status === 'distributed' ? 'bg-emerald-500/20 text-emerald-300' :
                      c.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                      c.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: BONUS MANAGEMENT                                               */}
      {/* ================================================================== */}
      {activeTab === 'bonus' && (
        <div className="space-y-6">
          {/* Bonus Rules */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Active Bonus Rules</span>
              <span className="text-slate-400 font-normal">{bonusRules.filter(r => r.isActive).length} / {bonusRules.length} Active</span>
            </div>
            <div className="space-y-2 text-xs">
              {bonusRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{rule.icon}</span>
                    <div>
                      <div className="font-bold text-white">{rule.label}</div>
                      <div className="text-[10px] text-slate-400">{rule.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 font-bold">{(rule.bonusBps / 100).toFixed(1)}%</span>
                    {rule.requiresVerification && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">Verified</span>
                    )}
                    <button
                      onClick={() => doAction(
                        `${rule.isActive ? 'Disabling' : 'Enabling'} ${rule.label}...`,
                        () => {
                          toggleBonusRule(rule.id, !rule.isActive);
                          setActionMsg(`✓ ${rule.label} ${!rule.isActive ? 'enabled' : 'disabled'}`);
                        }
                      )}
                      className="cursor-pointer"
                    >
                      {rule.isActive
                        ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                        : <ToggleLeft className="w-5 h-5 text-slate-600" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Claims Queue */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2">
              Bonus Claims Queue ({claims.filter(c => c.status === 'pending' || c.status === 'approved').length} Pending)
            </div>
            <div className="space-y-2 text-xs">
              {claims.map((c) => (
                <div key={c.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-white">{c.userName}</span>
                      <span className="text-slate-500 ml-2 text-[10px]">{c.walletAddress}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">+{fmtTokens(c.totalBonusTokens)} ABCD</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        c.status === 'distributed' ? 'bg-emerald-500/20 text-emerald-300' :
                        c.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                        c.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>{c.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.bonusBreakdown.map((b, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {b.label}: +{fmtTokens(b.bonusTokens)}
                      </span>
                    ))}
                  </div>
                  {(c.status === 'pending' || c.status === 'approved') && (
                    <div className="flex gap-2">
                      {c.status === 'pending' && (
                        <button
                          onClick={() => doAction('Approving claim...', () => {
                            updateClaimStatus(c.id, 'approved');
                            setActionMsg(`✓ Claim ${c.id} approved`);
                          })}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] cursor-pointer hover:bg-emerald-500 transition"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />Approve
                        </button>
                      )}
                      {c.status === 'approved' && (
                        <button
                          onClick={() => doAction('Distributing tokens...', () => {
                            updateClaimStatus(c.id, 'distributed');
                            setActionMsg(`✓ Claim ${c.id} distributed`);
                          })}
                          className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px] cursor-pointer hover:bg-blue-500 transition"
                        >
                          <Coins className="w-3 h-3 inline mr-1" />Distribute
                        </button>
                      )}
                      <button
                        onClick={() => doAction('Rejecting claim...', () => {
                          updateClaimStatus(c.id, 'rejected');
                          setActionMsg(`✓ Claim ${c.id} rejected`);
                        })}
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] cursor-pointer hover:bg-rose-500 transition"
                      >
                        <XCircle className="w-3 h-3 inline mr-1" />Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: PROMOTION POOL                                                 */}
      {/* ================================================================== */}
      {activeTab === 'promotion' && (
        <div className="space-y-6">
          {/* Pool Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Pool Allocated</div>
              <div className="text-xl font-black text-white mt-1">{fmtTokens(promoPool.totalAllocatedTokens)} ABCD</div>
              <div className="text-[10px] text-slate-500">0.05% of ICO Allocation</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Distributed</div>
              <div className="text-xl font-black text-amber-400 mt-1">{fmtTokens(promoPool.totalDistributedTokens)} ABCD</div>
              <div className="text-[10px] text-slate-500">{promoPool.rewards.length} Rewards</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Remaining</div>
              <div className="text-xl font-black text-emerald-400 mt-1">{fmtTokens(promoPool.remainingTokens)} ABCD</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[10px] font-bold ${promoPool.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {promoPool.isActive ? '● Active' : '● Inactive'}
                </span>
                <button
                  onClick={() => doAction(
                    `${promoPool.isActive ? 'Deactivating' : 'Activating'} promotion pool...`,
                    () => {
                      togglePromotionPool(!promoPool.isActive);
                      setActionMsg(`✓ Promotion pool ${!promoPool.isActive ? 'activated' : 'deactivated'}`);
                    }
                  )}
                  className="cursor-pointer"
                >
                  {promoPool.isActive
                    ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                    : <ToggleLeft className="w-4 h-4 text-slate-600" />
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Referral Links */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2">
              Referral Links ({referralLinks.length})
            </div>
            <div className="space-y-2 text-xs">
              {referralLinks.map((link) => (
                <div key={link.code} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <div className="font-bold text-white">{link.ownerName}</div>
                    <div className="text-[10px] text-slate-400">Code: <span className="text-amber-400 font-mono">{link.code}</span></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-white font-bold">{link.totalReferrals} referrals</div>
                      <div className="text-[10px] text-emerald-400 font-bold">+{fmtTokens(link.totalRewardTokens)} ABCD</div>
                    </div>
                    <button
                      onClick={() => doAction(
                        `${link.isActive ? 'Disabling' : 'Enabling'} link...`,
                        () => {
                          toggleReferralLink(link.code, !link.isActive);
                          setActionMsg(`✓ Link ${link.code} ${!link.isActive ? 'enabled' : 'disabled'}`);
                        }
                      )}
                      className="cursor-pointer"
                    >
                      {link.isActive
                        ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                        : <ToggleLeft className="w-5 h-5 text-slate-600" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Promotion Reward History */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2">
              Promotion Rewards History ({promoPool.rewards.length})
            </div>
            <div className="space-y-2 text-xs">
              {promoPool.rewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <span className="font-bold text-white">{r.referrerName}</span>
                    <span className="text-slate-500 ml-2 text-[10px]">← {r.purchaserAddress.slice(0, 10)}...</span>
                    <div className="text-[10px] text-slate-400">{r.awardedAt}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">+{r.rewardTokens.toFixed(2)} ABCD</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                      r.status === 'claimed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: VERIFICATION QUEUE                                             */}
      {/* ================================================================== */}
      {activeTab === 'verification' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Total Documents</div>
              <div className="text-xl font-black text-white mt-1">{verifyStats.totalDocuments}</div>
            </div>
            <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-2xl">
              <div className="text-amber-400 font-bold">⏳ Pending</div>
              <div className="text-xl font-black text-amber-400 mt-1">{verifyStats.pending}</div>
            </div>
            <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-2xl">
              <div className="text-emerald-400 font-bold">✅ Verified</div>
              <div className="text-xl font-black text-emerald-400 mt-1">{verifyStats.verified}</div>
            </div>
            <div className="p-4 bg-slate-950 border border-rose-500/30 rounded-2xl">
              <div className="text-rose-400 font-bold">❌ Rejected</div>
              <div className="text-xl font-black text-rose-400 mt-1">{verifyStats.rejected}</div>
            </div>
          </div>

          {/* Pending Documents Queue */}
          {pendingDocs.length > 0 && (
            <div className="p-5 bg-slate-950 border border-amber-500/30 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-amber-400 uppercase border-b border-amber-500/30 pb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Pending Verification Queue ({pendingDocs.length})
              </div>
              <div className="space-y-2 text-xs">
                {pendingDocs.map((doc) => (
                  <div key={doc.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-white">{doc.userName}</span>
                        <span className="text-slate-500 ml-2 text-[10px]">{doc.walletAddress.slice(0, 14)}...</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">{doc.docType.replace('_', ' ')}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mb-2">
                      <span className="font-bold">{doc.docLabel}</span> — Submitted {doc.submittedAt}
                    </div>
                    {Object.keys(doc.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.entries(doc.metadata).map(([k, v]) => (
                          <span key={k} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => doAction('Approving verification...', () => {
                          approveVerification(doc.id);
                          setActionMsg(`✓ Document ${doc.id} approved for ${doc.userName}`);
                        })}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] cursor-pointer hover:bg-emerald-500 transition"
                      >
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />Approve
                      </button>
                      <button
                        onClick={() => doAction('Rejecting verification...', () => {
                          rejectVerification(doc.id, 'Document unclear or incomplete');
                          setActionMsg(`✓ Document ${doc.id} rejected`);
                        })}
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] cursor-pointer hover:bg-rose-500 transition"
                      >
                        <XCircle className="w-3 h-3 inline mr-1" />Reject
                      </button>
                      <button className="px-3 py-1 rounded-lg bg-slate-700 text-white font-bold text-[10px] cursor-pointer hover:bg-slate-600 transition">
                        <Eye className="w-3 h-3 inline mr-1" />View Document
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Documents Table */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2">
              All Verification Documents ({allDocs.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 font-bold">User</th>
                    <th className="text-left py-2 font-bold">Type</th>
                    <th className="text-left py-2 font-bold">Document</th>
                    <th className="text-left py-2 font-bold">Status</th>
                    <th className="text-left py-2 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allDocs.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-800/50">
                      <td className="py-2 text-white font-bold">{doc.userName}</td>
                      <td className="py-2 text-slate-400 capitalize">{doc.docType.replace('_', ' ')}</td>
                      <td className="py-2 text-slate-300">{doc.docLabel}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          doc.status === 'verified' ? 'bg-emerald-500/20 text-emerald-300' :
                          doc.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-rose-500/20 text-rose-300'
                        }`}>{doc.status}</span>
                      </td>
                      <td className="py-2 text-slate-500 text-[10px]">{doc.submittedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: FUND ALLOCATION                                                */}
      {/* ================================================================== */}
      {activeTab === 'allocation' && (
        <div className="space-y-6">
          {/* Waterfall Visualization */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>ICO Fund Allocation — Whitepaper Percentages</span>
              <button
                onClick={() => doAction('Distributing funds...', () => {
                  distributeICOFunds(4_020_000, 'all');
                  setActionMsg('✓ Fund distribution completed for $4.02M');
                })}
                className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px] cursor-pointer hover:bg-amber-500 transition"
              >
                <TrendingUp className="w-3 h-3 inline mr-1" />Run Distribution
              </button>
            </div>

            {/* Stacked bar visualization */}
            <div className="space-y-2">
              {allocationWallets.map((w) => {
                const pct = w.percentageBps / 100;
                const colors: Record<string, string> = {
                  founder: 'bg-purple-500',
                  ico: 'bg-amber-500',
                  marketing: 'bg-pink-500',
                  finance: 'bg-blue-500',
                  advisors: 'bg-indigo-500',
                  reserve: 'bg-emerald-500',
                  contingency: 'bg-slate-500',
                };
                return (
                  <div key={w.id} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-slate-300 font-bold truncate">{w.label}</div>
                    <div className="flex-1 bg-slate-800 rounded-full h-5 relative overflow-hidden">
                      <div
                        className={`h-5 rounded-full ${colors[w.id] || 'bg-slate-600'} transition-all flex items-center justify-end pr-2`}
                        style={{ width: `${pct}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-24 text-right text-xs text-amber-400 font-bold">{fmtUSD(w.allocatedUSD)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribution History */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Distribution History ({distributions.length})</span>
              <button
                onClick={() => {
                  const report = exportICOReport();
                  const blob = new Blob([report], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ico_report_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setActionMsg('✓ ICO report exported');
                }}
                className="px-3 py-1 rounded-lg bg-slate-700 text-white font-bold text-[10px] cursor-pointer hover:bg-slate-600 transition"
              >
                <Download className="w-3 h-3 inline mr-1" />Export Report
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {distributions.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <span className="font-bold text-white">{d.id}</span>
                    <span className="text-slate-500 ml-2 text-[10px]">{d.phase} phase</span>
                    <div className="text-[10px] text-slate-400">{d.distributedAt}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 font-bold">{fmtUSD(d.totalRaisedUSD)}</div>
                    <div className="text-[10px] text-slate-500">Tx: {d.txHash.slice(0, 14)}...</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: RESERVE TRANSFERS                                              */}
      {/* ================================================================== */}
      {activeTab === 'reserve' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Total Transferred</div>
              <div className="text-xl font-black text-emerald-400 mt-1">{fmtTokens(reserveStats.totalTokensTransferred)} ABCD</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Auto Transfers</div>
              <div className="text-xl font-black text-white mt-1">{reserveStats.automaticTransfers}</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Admin Sweeps</div>
              <div className="text-xl font-black text-white mt-1">{reserveStats.adminSweeps}</div>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-slate-400 font-bold">Bonus Pool Left</div>
              <div className="text-xl font-black text-amber-400 mt-1">{fmtTokens(bonusPool.remainingTokens)} ABCD</div>
            </div>
          </div>

          {/* Manual Sweep */}
          <div className="p-5 bg-slate-950 border border-amber-500/30 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-amber-400 uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Manual Reserve Sweep
            </div>
            <p className="text-xs text-slate-400">
              Sweep remaining unused bonus tokens from the Bonus Pool to the Reserve Pool.
              This is typically done automatically when an ICO phase ends, but can be triggered manually.
            </p>
            <button
              onClick={() => doAction('Sweeping unused bonus tokens to Reserve...', () => {
                const result = checkAndTransferUnusedBonuses(50_000, 'admin_sweep', 'admin');
                if (result) {
                  setActionMsg(`✓ Swept ${fmtTokens(result.tokensTransferred)} ABCD to Reserve Pool`);
                } else {
                  setActionMsg('No unused tokens to sweep');
                }
              })}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs cursor-pointer hover:bg-amber-500 transition flex items-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" /> Sweep to Reserve
            </button>
          </div>

          {/* Transfer History */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2">
              Transfer History ({reserveHistory.length})
            </div>
            <div className="space-y-2 text-xs">
              {reserveHistory.map((t) => (
                <div key={t.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        t.triggeredBy === 'automatic' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>{t.triggeredBy}</span>
                      <span className="font-bold text-white">{fmtTokens(t.tokensTransferred)} ABCD</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{t.timestamp}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{t.reasonLabel}</div>
                  <div className="text-[10px] text-slate-600 mt-1">
                    {t.fromPool} → {t.toPool} | Tx: {t.txHash.slice(0, 14)}...
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By Reason Breakdown */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2">
              Transfers by Reason
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {Object.entries(reserveStats.byReason).map(([reason, amount]) => (
                <div key={reason} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                  <div className="text-slate-400 capitalize text-[10px] font-bold">{reason.replace(/_/g, ' ')}</div>
                  <div className="font-bold text-white mt-1">{fmtTokens(amount)} ABCD</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminICODashboard;
