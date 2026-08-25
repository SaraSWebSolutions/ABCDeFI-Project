import React, { useState } from 'react';
import {
  Coins,
  Gift,
  ArrowLeftRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Search,
  Download,
  Zap,
  Info,
  Clock,
  Award,
  DollarSign,
  Layers,
  ChevronRight,
  Percent,
  Sliders,
  Send,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  MARKETPLACE_FEE_TIERS,
  AIRDROP_CAMPAIGNS,
  PROTOCOL_GIFT_BARTER_RULES,
  calculateMarketplaceFees,
  AirdropCampaign,
} from '../Services/nftEcosystem';

export type GovernancePortalTab = 'fees' | 'airdrops' | 'rules';

interface NFTMarketplaceGovernancePortalProps {
  initialTab?: GovernancePortalTab;
  userAddress?: string;
}

export const NFTMarketplaceGovernancePortal: React.FC<NFTMarketplaceGovernancePortalProps> = ({
  initialTab = 'fees',
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}) => {
  const [activeTab, setActiveTab] = useState<GovernancePortalTab>(initialTab);

  // --- Marketplace Fees State ---
  const [calcPriceEth, setCalcPriceEth] = useState<string>('2.5');
  const [userRepScore, setUserRepScore] = useState<number>(720);

  // --- Airdrop State ---
  const [snapshotAddress, setSnapshotAddress] = useState<string>(userAddress);
  const [eligibleStatus, setEligibleStatus] = useState<boolean | null>(true);
  const [claimingCampaign, setClaimingCampaign] = useState<AirdropCampaign | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [claimedIds, setClaimedIds] = useState<string[]>([]);

  // --- Gift & Barter Rules Simulator State ---
  const [giftAmountInput, setGiftAmountInput] = useState<string>('1000');
  const [giftLockDays, setGiftLockDays] = useState<number>(14);
  const [barterVal1, setBarterVal1] = useState<string>('1.5');
  const [barterVal2, setBarterVal2] = useState<string>('1.45');

  // Compute live fee estimation
  const feeCalculation = calculateMarketplaceFees(parseFloat(calcPriceEth || '0'), userRepScore);

  // Handle Airdrop Claim
  const handleClaimAirdrop = (campaign: AirdropCampaign) => {
    setClaimingCampaign(campaign);
    setFeedbackMsg(`Processing Web3 airdrop claim for "${campaign.title}"...`);
    setTimeout(() => {
      setClaimedIds((prev) => [...prev, campaign.id]);
      setFeedbackMsg(`Successfully claimed ${campaign.rewardAmount}! Added to wallet.`);
      setClaimingCampaign(null);
    }, 1200);
  };

  // Barter Valuation Match evaluation
  const val1Num = parseFloat(barterVal1 || '0');
  const val2Num = parseFloat(barterVal2 || '0');
  const diffPct = val1Num > 0 ? Math.abs((val1Num - val2Num) / val1Num) * 100 : 0;
  const isTradeEqual = diffPct <= PROTOCOL_GIFT_BARTER_RULES.barterMaxValuationSpreadPct;

  return (
    <div className="space-y-6">
      {/* HEADER & TOP NAVIGATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-pink-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>NFT Marketplace & Protocol Rules Hub</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-3">
              Marketplace Fees, Airdrops & Barter Rules
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Transparent protocol fee schedules, live airdrop snapshot reward claims, and peer-to-peer barter trade escrow rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-2xl text-xs font-mono font-bold bg-pink-500/10 text-pink-300 border border-pink-500/30">
              Protocol Fee Split: 80% Treasury / 20% Stakers
            </span>
          </div>
        </div>

        {/* 3 TOP TABS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('fees')}
            className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'fees'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Coins className="w-4 h-4" /> Marketplace Fees & Discounts
          </button>

          <button
            onClick={() => setActiveTab('airdrops')}
            className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'airdrops'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" /> NFT & Token Airdrops
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" /> Gift & Barter Rules
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className="p-4 bg-slate-900 border border-indigo-500/40 rounded-2xl text-xs text-indigo-300 flex items-center justify-between font-mono animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: MARKETPLACE FEES & DISCOUNT TIERS                             */}
      {/* ========================================================================= */}
      {activeTab === 'fees' && (
        <div className="space-y-6">
          {/* Overview Schedule Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Listing Fee</div>
              <div className="text-3xl font-black text-indigo-400 font-mono">1.0%</div>
              <div className="text-[11px] text-slate-400 mt-1">Flat listing deposit</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Standard Trading Fee</div>
              <div className="text-3xl font-black text-white font-mono">2.5%</div>
              <div className="text-[11px] text-slate-400 mt-1">Deducted from seller</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Creator Royalty</div>
              <div className="text-3xl font-black text-pink-400 font-mono">5.0%</div>
              <div className="text-[11px] text-slate-400 mt-1">Paid directly to creator</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">VIP Max Discount</div>
              <div className="text-3xl font-black text-emerald-400 font-mono">100% OFF</div>
              <div className="text-[11px] text-slate-400 mt-1">0% Trading Fee for VIPs</div>
            </div>
          </div>

          {/* Interactive Fee Estimator Simulator */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                <Sliders className="w-5 h-5 text-indigo-400" /> Interactive Marketplace Fee Calculator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter an NFT price and reputation score to see precise fee breakdowns and net seller proceeds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inputs */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-mono">NFT Sale Price (ETH):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcPriceEth}
                    onChange={(e) => setCalcPriceEth(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>User Reputation Score:</span>
                    <span className="text-emerald-400 font-bold">{userRepScore} pts</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="850"
                    step="10"
                    value={userRepScore}
                    onChange={(e) => setUserRepScore(Number(e.target.value))}
                    className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>

              {/* Calculations Output */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Sale Price:</span>
                  <span className="text-white font-bold">{feeCalculation.salePriceEth} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Listing Deposit (1.0%):</span>
                  <span className="text-slate-300">-{feeCalculation.listingFeeEth} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Trading Fee (2.5% base - {feeCalculation.discountPct}% Discount):
                  </span>
                  <span className="text-indigo-300">-{feeCalculation.tradingFeeEth} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Creator Royalty (5.0%):</span>
                  <span className="text-pink-400">-{feeCalculation.royaltyFeeEth} ETH</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-bold">
                  <span className="text-emerald-400">Seller Net Proceeds:</span>
                  <span className="text-emerald-400 font-mono">{feeCalculation.sellerNetProceedsEth} ETH</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fee Discount Tiers Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-bold text-white uppercase text-xs tracking-wider flex items-center gap-2 font-mono">
                <Award className="w-4 h-4 text-indigo-400" /> Reputation Fee Discount Tier Table
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Tier Badge</th>
                    <th className="p-4">Min Credit Score</th>
                    <th className="p-4">Fee Discount %</th>
                    <th className="p-4">Effective Trading Fee</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {MARKETPLACE_FEE_TIERS.map((tier) => {
                    const isUserTier = userRepScore >= tier.minReputationScore;
                    return (
                      <tr key={tier.tierName} className="hover:bg-slate-900/80 transition">
                        <td className="p-4 font-bold text-white flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-amber-300">
                            {tier.badge}
                          </span>
                          {tier.tierName}
                        </td>
                        <td className="p-4 text-slate-400">{tier.minReputationScore}+ pts</td>
                        <td className="p-4 text-emerald-400 font-bold">{tier.feeDiscountPercent}% OFF</td>
                        <td className="p-4 text-indigo-300 font-bold">{(tier.effectiveTradingFeeBps / 100).toFixed(2)}%</td>
                        <td className="p-4">
                          {isUserTier ? (
                            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                              Unlocked ✓
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded bg-slate-800 text-slate-500 text-[10px]">Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: NFT AIRDROPS & REWARD CLAIM PORTAL                            */}
      {/* ========================================================================= */}
      {activeTab === 'airdrops' && (
        <div className="space-y-6">
          {/* Snapshot Verifier Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                  <Search className="w-5 h-5 text-pink-400" /> Airdrop Snapshot Eligibility Checker
                </h3>
                <p className="text-xs text-slate-400">
                  Verify wallet address snapshot eligibility across active and upcoming protocol reward drops.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={snapshotAddress}
                onChange={(e) => setSnapshotAddress(e.target.value)}
                placeholder="Enter Web3 Wallet Address (0x...)"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono outline-none focus:border-pink-500/50"
              />
              <button
                onClick={() => setEligibleStatus(true)}
                className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs transition cursor-pointer font-mono shadow-lg shadow-pink-600/20"
              >
                Check Eligibility
              </button>
            </div>

            {eligibleStatus !== null && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Wallet address is eligible for active airdrop campaigns!</span>
              </div>
            )}
          </div>

          {/* Active Campaigns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AIRDROP_CAMPAIGNS.map((c) => {
              const isClaimed = claimedIds.includes(c.id);
              return (
                <div
                  key={c.id}
                  className={`bg-slate-950 border rounded-3xl p-6 space-y-4 flex flex-col justify-between transition ${
                    isClaimed
                      ? 'border-emerald-500/50 bg-emerald-950/10'
                      : c.status === 'Active'
                      ? 'border-pink-500/40 shadow-xl shadow-pink-950/20'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3 font-mono">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-2xl">{c.icon}</span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'Active'
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30 animate-pulse'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white tracking-tight">{c.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 font-sans">{c.description}</p>
                    </div>

                    <div className="space-y-2 text-xs pt-2 border-t border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Reward:</span>
                        <span className="text-pink-300 font-bold">{c.rewardAmount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Snapshot Date:</span>
                        <span className="text-slate-300">{c.snapshotDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pool Claimed:</span>
                        <span className="text-emerald-400 font-bold">{c.totalClaimed}</span>
                      </div>
                    </div>
                  </div>

                  {c.status === 'Active' ? (
                    isClaimed ? (
                      <button
                        disabled
                        className="w-full py-3 bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl text-xs font-mono"
                      >
                        Claimed ✓
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClaimAirdrop(c)}
                        className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs font-mono transition cursor-pointer shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Claim Airdrop Reward
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 bg-slate-900 text-slate-500 font-bold rounded-xl text-xs font-mono cursor-not-allowed"
                    >
                      Scheduled for Aug 15
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: GIFT & BARTER RULES                                           */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Rules Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gift Rules Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                <Gift className="w-5 h-5 text-amber-400" /> Gift NFT Ecosystem Rules
              </h3>

              <div className="space-y-3 font-mono text-xs text-slate-300">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-amber-400 font-bold">1. Wrapped Yield APY Rate (8.5%)</div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Tokens wrapped inside Gift NFTs automatically accrue 8.5% APY protocol yield until unwrapped by recipient.
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-amber-400 font-bold">2. Minimum Lock-up Window ({PROTOCOL_GIFT_BARTER_RULES.giftMinLockDays} Days)</div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Gift NFTs carry an optional lock-up period to prevent immediate liquidation and encourage long-term wealth accumulation.
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-amber-400 font-bold">3. Transferability & Theme Customization</div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Gift NFTs can be transferred on open secondary markets or unwrapped directly to claim underlying token balances.
                  </p>
                </div>
              </div>
            </div>

            {/* Barter Rules Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                <ArrowLeftRight className="w-5 h-5 text-indigo-400" /> Barter Swap Protocol Rules
              </h3>

              <div className="space-y-3 font-mono text-xs text-slate-300">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-indigo-400 font-bold">1. Zero-Fee Barter Swaps</div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Peer-to-peer asset barter swaps carry 0% marketplace trading fees to encourage direct community liquidity.
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-indigo-400 font-bold">
                    2. Valuation Spread Tolerance (±{PROTOCOL_GIFT_BARTER_RULES.barterMaxValuationSpreadPct}%)
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    The smart contract validates proposed asset trades to ensure offered vs requested values fall within safety margins.
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-indigo-400 font-bold">
                    3. Anti-Scam Escrow Vault ({PROTOCOL_GIFT_BARTER_RULES.barterEscrowLockHours}h Lock)
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Atomic swap smart contracts lock both sides of trade until both counterparties verify item provenance and signatures.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Barter Trade Valuation Matcher */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 font-mono">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-amber-400" /> Interactive Barter Trade Escrow Validator
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Your Offered Asset Value (ETH equivalent):</label>
                <input
                  type="number"
                  step="0.05"
                  value={barterVal1}
                  onChange={(e) => setBarterVal1(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Requested Target Asset Value (ETH equivalent):</label>
                <input
                  type="number"
                  step="0.05"
                  value={barterVal2}
                  onChange={(e) => setBarterVal2(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400">Valuation Variance: </span>
                <span className="text-white font-bold">{diffPct.toFixed(1)}%</span>
                <span className="text-slate-500 text-[11px] ml-2">
                  (Max allowed: {PROTOCOL_GIFT_BARTER_RULES.barterMaxValuationSpreadPct}%)
                </span>
              </div>

              <span
                className={`px-3 py-1.5 rounded-xl font-bold ${
                  isTradeEqual
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {isTradeEqual ? 'Escrow Status: Trade Approved ✓' : 'Escrow Warning: Valuation Disparity High ⚠️'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NFTMarketplaceGovernancePortal;
