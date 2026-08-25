import React, { useState } from 'react';
import {
  LayoutDashboard, Wallet, Coins, RefreshCw, Repeat, TrendingUp, Sprout,
  Users, ShieldCheck, History, Bell, BarChart2, Share2, Vote, Lock, Sliders,
  Shield, CheckCircle2, AlertTriangle, ArrowUpRight, Search, Download, Sun, Moon,
  Copy, ExternalLink, PieChart, FileText, Image as ImageIcon, Clock, GraduationCap,
  Bot, Star, Gift, Shuffle, Heart, Building2, CreditCard, ChevronDown, ChevronRight,
  Send, Plus, X, Zap, QrCode, ArrowDownLeft, Sparkles, Check, Flame, Smartphone, Eye, EyeOff, Wifi, Battery, Signal, LogOut, FlameKindling
} from 'lucide-react';
import mockApiStore from '../Services/mockApiStore';
import ToastContainer, { ToastMessage } from './ToastContainer';
import Web3ActionModal from './Web3ActionModal';
import { AdminPortalEngine } from './AdminPortalEngine';
import { calculateMonthlyEMI, generateInstallmentSchedule } from '../Services/emiEngine';
import { executeeLICMechanism, INITIAL_ELIC_STATS } from '../Services/elicEngine';
import { handleLoanCompletionAndMintNFTs, INITIAL_LOAN_NFTS } from '../Services/loanWorkflow';

export const MasterPlatformEngine: React.FC = () => {
  // Mobile Flow & Portal Role State
  const [portalRole, setPortalRole] = useState<'user' | 'franchise' | 'admin'>('user');
  const [mobileFlowStep, setMobileFlowStep] = useState<'splash' | 'auth' | 'wallet' | 'kyc' | 'app'>('app');
  const [mobileTab, setMobileTab] = useState<'home' | 'finance' | 'nft' | 'portfolio' | 'profile'>('home');
  const [financeScreen, setFinanceScreen] = useState<'menu' | 'borrow' | 'lending' | 'marketplace' | 'deposit' | 'withdraw' | 'stake' | 'farming' | 'ico' | 'vesting' | 'history'>('menu');

  // Custom interactive states
  const [deviceFrameMode, setDeviceFrameMode] = useState<boolean>(true);
  const [hideBalance, setHideBalance] = useState<boolean>(false);
  const [showAiDrawer, setShowAiDrawer] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // eLIC Borrow Application Form State
  const [borrowerName, setBorrowerName] = useState<string>('Dinesh Rivers');
  const [borrowerEmail, setBorrowerEmail] = useState<string>('dinesh@abcdefi.io');
  const [borrowerPhone, setBorrowerPhone] = useState<string>('+91 9876543210');
  const [borrowerCountry, setBorrowerCountry] = useState<string>('India');
  const [icoAmount, setIcoAmount] = useState<string>('250');
  const [reservedNft, setReservedNft] = useState<string | null>(null);
  const [employment, setEmployment] = useState<string>('Software Engineer');
  const [income, setIncome] = useState<string>('$4,500 / Month');
  const [loanPurpose, setLoanPurpose] = useState<string>('DeFi Business Expansion');
  const [borrowAmount, setBorrowAmount] = useState<string>('1000');
  const [borrowCollateral, setBorrowCollateral] = useState<string>('2 ETH ($7,000)');
  const [borrowDuration, setBorrowDuration] = useState<number>(12);

  // Calculated EMI Model
  const emiModel = generateInstallmentSchedule(parseFloat(borrowAmount) || 1000, 11, borrowDuration);

  // Lender State
  const [lendingDeposit, setLendingDeposit] = useState<string>('1000');
  const [selectedMarketplaceLoan, setSelectedMarketplaceLoan] = useState<any | null>(null);

  // AI Assistant Floating Prompt State
  const [aiInput, setAiInput] = useState<string>('');
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: '👋 Good morning Dinesh! I am 59C AI. Ask me about eLIC P2P lending, 2% token burns, loan NFTs, or EMI schedules.' },
  ]);

  // Web3 Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean; title: string; subtitle: string; contractName: string;
    methodName: string; amountLabel: string; amountValue: string;
    params: { label: string; value: string }[]; icon: string;
    onExecute: () => Promise<void> | void; onSuccessMutation: () => void;
  }>({
    isOpen: false, title: '', subtitle: '', contractName: '', methodName: '',
    amountLabel: '', amountValue: '', params: [], icon: '⚡',
    onExecute: () => { }, onSuccessMutation: () => { },
  });

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const triggerModal = (title: string, contract: string, method: string, amount: string, icon: string = '⚡') => {
    setModalState({
      isOpen: true,
      title: `Execute ${title}`,
      subtitle: `Web3 Smart Contract Call: ${contract}.${method}`,
      contractName: contract, methodName: method,
      amountLabel: 'Transaction Value', amountValue: amount,
      params: [
        { label: 'Sender', value: 'dinesh.eth (0x7099...79C8)' },
        { label: 'Network', value: 'Ethereum Sepolia Testnet' },
        { label: 'Burn Pool Fee', value: '2.0% (Burned on-chain)' }
      ],
      icon,
      onExecute: async () => { await new Promise((r) => setTimeout(r, 800)); },
      onSuccessMutation: () => addToast(`${title} Success`, `${contract}.${method} confirmed!`),
    });
  };

  const handleAiAskPrompt = (promptText: string) => {
    setAiMessages((prev) => [...prev, { role: 'user', text: promptText }]);
    setShowAiDrawer(true);
    setTimeout(() => {
      let resp = '🤖 eLIC Mechanism Details:';
      if (promptText.includes('borrow')) {
        resp = '💳 eLIC Borrowing: Submit loan request with 2 ETH collateral. Lenders inspect your request on the P2P Marketplace. Once funded, 1,000 ABCD tokens are disbursed and collateral is locked in Escrow.sol.';
      } else if (promptText.includes('rewards')) {
        resp = '🎁 Lender ROI: Lenders earn 11% interest APY + community incentives. 2% of platform fees are automatically burned on-chain to increase token floor value.';
      } else if (promptText.includes('portfolio')) {
        resp = '📊 Portfolio Breakdown: Net Worth $35,840. Active eLIC Loans: #LOAN-104 ($1,000 USDC borrowed, 2 ETH collateral locked). Health Score: 92% (Safe).';
      } else if (promptText.includes('EMIs')) {
        resp = '🗓 EMI Schedule: 12 Monthly EMIs of $88.38 USDC each. Next EMI is due in 12 days. Pay on time to increase your Credit Score!';
      } else if (promptText.includes('investments')) {
        resp = '💡 eLIC Investment: Browse the P2P Marketplace to inspect verified borrowers. Select a 11% APY loan request and fund directly to receive Lender NFTs!';
      }
      setAiMessages((prev) => [...prev, { role: 'ai', text: resp }]);
    }, 600);
  };

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    handleAiAskPrompt(aiInput.trim());
    setAiInput('');
  };

  // Mock Store Data
  const tokenBalances = mockApiStore.getTokenBalances();
  const lendingPools = mockApiStore.getLendingPools();
  const nftPortfolio = mockApiStore.getNftPortfolio();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased pb-12">

      {/* 🚀 TOP APP HEADER WITH PLATFORM SEPARATION CONTROLS */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-600/40">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-tight">ABCDeFi eLIC Platform</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> eLIC Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">dinesh.eth • 2% Token Burn Pool: <span className="text-amber-400 font-bold">{INITIAL_ELIC_STATS.totalAbcdBurned} ABCD</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
            Phase 1 Foundation
          </span>
          <span className="px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider">
            Mobile Dashboard
          </span>
        </div>

        <div className="flex items-center gap-2">
          {portalRole === 'user' && (
            <button
              onClick={() => setDeviceFrameMode(!deviceFrameMode)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> {deviceFrameMode ? 'Full Screen' : 'Phone Frame'}
            </button>
          )}
        </div>
      </header>

      {/* 🛡️ ADMIN DESKTOP WEB APPLICATION */}
      {portalRole === 'admin' && (
        <div className="p-4 sm:p-8">
          <div className="bg-purple-950/30 border border-purple-500/30 p-4 rounded-2xl mb-6 text-xs text-purple-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400 shrink-0" />
            <span><strong>Desktop Admin Portal:</strong> Manage eLIC Loan Marketplace, Pending Loans, Sumsub KYC Queue, Treasury 8-Way Split, 2% Burn Pool, and Smart Contracts.</span>
          </div>
          <AdminPortalEngine />
        </div>
      )}

      {/* 🌍 FRANCHISE REGIONAL APP */}
      {portalRole === 'franchise' && (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-3 py-1 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full tracking-wider">
                  🌍 Regional Franchise App
                </span>
                <h2 className="text-2xl font-black text-white mt-2">South Asia Regional Dashboard</h2>
                <p className="text-xs text-slate-400">Territory: India & Subcontinent • eLIC Node: FR-IND-8829</p>
              </div>
              <button
                onClick={() => addToast('Commission Claimed!', '$18,450 USDC claimed to franchise wallet.')}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs rounded-2xl shadow-xl transition cursor-pointer"
              >
                Withdraw Commission $18,450 💰
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Region Users</div>
                <div className="text-lg font-black text-indigo-400 mt-0.5">12,840</div>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Legion NFTs</div>
                <div className="text-lg font-black text-emerald-400 mt-0.5">48 Minted</div>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Active Loans</div>
                <div className="text-lg font-black text-amber-400 mt-0.5">$1,840,000</div>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Revenue</div>
                <div className="text-lg font-black text-purple-400 mt-0.5">$148,250</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📱 USER MOBILE APP EXPERIENCE */}
      {portalRole === 'user' && (
        <div className="pt-6 flex justify-center items-center px-4 relative">

          <div className={deviceFrameMode ? "w-full max-w-[420px] bg-slate-900 border-[8px] border-slate-800 rounded-[50px] shadow-2xl overflow-hidden relative" : "w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative"}>

            {/* SMARTPHONE STATUS BAR */}
            <div className="bg-slate-950 pt-3 px-6 pb-2 flex justify-between items-center text-[11px] font-mono text-slate-400 border-b border-slate-800/50">
              <span>9:41</span>
              <div className="w-20 h-4 bg-black rounded-full flex items-center justify-center gap-1.5 px-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <Signal className="w-3 h-3 text-slate-300" />
                <Wifi className="w-3 h-3 text-slate-300" />
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            {/* STAGE 1: SPLASH SCREEN FLOW */}
            {mobileFlowStep === 'splash' && (
              <div className="p-8 text-center space-y-6 py-20 bg-gradient-to-b from-indigo-950 to-slate-950">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-2xl shadow-indigo-600/50 animate-bounce">
                  ⚡
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">ABCDeFi eLIC Mobile</h2>
                  <p className="text-xs text-indigo-300 mt-1">Earnings for Lender & Incentive for Community</p>
                </div>
                <button
                  onClick={() => setMobileFlowStep('auth')}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs cursor-pointer shadow-lg"
                >
                  Get Started →
                </button>
              </div>
            )}

            {/* STAGE 2: AUTHENTICATION FLOW */}
            {mobileFlowStep === 'auth' && (
              <div className="p-6 space-y-5 text-xs">
                <h3 className="text-base font-bold text-white">Login / Register Account</h3>
                <input defaultValue="dinesh@abcdefi.io" className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2.5 rounded-xl" placeholder="Email address" />
                <input type="password" defaultValue="••••••••" className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2.5 rounded-xl" placeholder="Password" />
                <button
                  onClick={() => setMobileFlowStep('wallet')}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer"
                >
                  Continue to Wallet Connect →
                </button>
              </div>
            )}

            {/* STAGE 3: WALLET CONNECT */}
            {mobileFlowStep === 'wallet' && (
              <div className="p-6 space-y-4 text-xs text-center">
                <h3 className="text-base font-bold text-white">Connect Web3 Wallet</h3>
                <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-2xl space-y-2">
                  <div className="font-mono text-emerald-400 font-bold">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</div>
                  <div className="text-[10px] text-slate-400 font-mono">MetaMask / Thirdweb Connected</div>
                </div>
                <button
                  onClick={() => setMobileFlowStep('kyc')}
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl cursor-pointer"
                >
                  Proceed to Complete KYC →
                </button>
              </div>
            )}

            {/* STAGE 4: COMPLETE KYC */}
            {mobileFlowStep === 'kyc' && (
              <div className="p-6 space-y-4 text-xs text-center">
                <h3 className="text-base font-bold text-white">Identity Verification (KYC)</h3>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 font-bold">
                  Sumsub Review Passed ✓ (Session GREEN)
                </div>
                <button
                  onClick={() => setMobileFlowStep('app')}
                  className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl cursor-pointer"
                >
                  Enter Home Dashboard 🏠
                </button>
              </div>
            )}

            {/* STAGE 5: MAIN MOBILE APP ENGINE WITH 5 BOTTOM NAV TABS */}
            {mobileFlowStep === 'app' && (
              <div className="p-4 space-y-4 max-h-[640px] overflow-y-auto pb-24">

                {/* 🏠 TAB 1: HOME */}
                {mobileTab === 'home' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-black text-white">👋 Good Morning, Dinesh</h3>
                        <p className="text-[10px] font-mono text-slate-400">Connected: 0x7099...79C8</p>
                      </div>
                      <button onClick={() => addToast('Notifications', 'You have 2 new alerts.')} className="p-2 rounded-full bg-slate-800 text-slate-300 relative">
                        <Bell className="w-4 h-4" />
                        <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1 right-1" />
                      </button>
                    </div>

                    <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-900/90 via-slate-900 to-slate-950 border border-indigo-500/40 shadow-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-extrabold uppercase text-indigo-300 tracking-wider">Portfolio Value</span>
                            <button onClick={() => setHideBalance(!hideBalance)} className="text-slate-400 hover:text-white">
                              {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <h2 className="text-3xl font-black text-white font-mono mt-0.5">
                            {hideBalance ? '••••••••' : '$35,840'}
                          </h2>
                          <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full mt-1">
                            +8.25% (24h)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-slate-400">KYC</span>
                          <div className="text-base font-black text-emerald-400 font-mono mt-0.5">Verified</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                        <button onClick={() => setMobileTab('finance')} className="p-2.5 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-left cursor-pointer">
                          <div className="text-[10px] font-bold uppercase">ICO Status</div>
                          <div className="text-sm font-black text-white mt-0.5">Live now</div>
                        </button>
                        <button onClick={() => setMobileTab('nft')} className="p-2.5 rounded-2xl bg-slate-800 text-slate-200 text-left cursor-pointer">
                          <div className="text-[10px] font-bold uppercase">Franchise NFT</div>
                          <div className="text-sm font-black text-white mt-0.5">2 available</div>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] uppercase text-slate-400">Wallet Balance</div>
                        <div className="text-base font-black text-white mt-0.5">$8,420</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] uppercase text-slate-400">Loan Eligibility</div>
                        <div className="text-base font-black text-emerald-400 mt-0.5">Phase 2 Ready</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-white">Notifications</h4>
                        <button onClick={() => addToast('Inbox Opened', 'Your latest alerts are now visible.')} className="text-[10px] text-indigo-400 font-bold">View all</button>
                      </div>
                      <div className="space-y-2 text-[11px]">
                        <div className="flex justify-between items-center rounded-xl bg-slate-900 px-3 py-2">
                          <span className="text-slate-300">KYC approved successfully</span>
                          <span className="text-emerald-400 font-bold">Now</span>
                        </div>
                        <div className="flex justify-between items-center rounded-xl bg-slate-900 px-3 py-2">
                          <span className="text-slate-300">ICO stage 2 started</span>
                          <span className="text-amber-400 font-bold">12m ago</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-white">Recent Transactions</h4>
                        <span className="text-[10px] text-slate-400">Last 3</span>
                      </div>
                      {tokenBalances.slice(0, 3).map((item) => (
                        <div key={item.symbol} className="flex justify-between items-center rounded-xl bg-slate-900 px-3 py-2 text-[11px]">
                          <span className="text-slate-300">{item.name}</span>
                          <span className="text-emerald-400 font-bold">{item.usdValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 💰 TAB 2: FINANCE HUB */}
                {mobileTab === 'finance' && (
                  <div className="space-y-4">
                    <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">ICO Module</div>
                          <h4 className="text-sm font-black text-white mt-1">Phase 1 Token Sale</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Live</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-3 rounded-2xl bg-slate-900">
                          <div className="text-slate-400">Current Stage</div>
                          <div className="font-black text-white mt-1">Stage 2</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-900">
                          <div className="text-slate-400">Price</div>
                          <div className="font-black text-emerald-400 mt-1">$0.18 / ABCD</div>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Remaining Tokens</span>
                          <span className="font-black text-white">84,250</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Countdown</span>
                          <span className="font-black text-indigo-300">03:12:44</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase text-slate-400 font-bold">Buy Tokens</label>
                        <div className="flex gap-2 mt-2">
                          <input value={icoAmount} onChange={(e) => setIcoAmount(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 text-white px-3 py-2.5 rounded-xl" />
                          <button onClick={() => { addToast('ICO Purchase Queued', `${icoAmount} ABCD tokens are ready for checkout.`); setIcoAmount(''); }} className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl cursor-pointer">Buy</button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                      {[
                        { id: 'menu', label: 'Overview' },
                        { id: 'borrow', label: 'Borrow' },
                        { id: 'marketplace', label: 'Marketplace' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setFinanceScreen(s.id as any)}
                          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer ${financeScreen === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {financeScreen === 'menu' && (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-white">Recent ICO Activity</h4>
                          <span className="text-[10px] text-slate-400">Live feed</span>
                        </div>
                        {[
                          { label: 'Purchased 500 ABCD', time: '2 min ago' },
                          { label: 'Wallet connected', time: '15 min ago' },
                          { label: 'KYC approved', time: '1 hr ago' },
                        ].map((item) => (
                          <div key={item.label} className="flex justify-between items-center rounded-xl bg-slate-900 px-3 py-2 text-[11px]">
                            <span className="text-slate-300">{item.label}</span>
                            <span className="text-slate-400">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(financeScreen === 'borrow' || financeScreen === 'menu') && (
                      <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <h4 className="font-bold text-white text-sm">Create eLIC Loan Request</h4>
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">KYC Verified ✓</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Borrower Name</label>
                            <input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-2.5 py-1.5 rounded-xl font-bold" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Country</label>
                            <input value={borrowerCountry} onChange={(e) => setBorrowerCountry(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-2.5 py-1.5 rounded-xl font-bold" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Employment</label>
                            <input value={employment} onChange={(e) => setEmployment(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-2.5 py-1.5 rounded-xl" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Monthly Income</label>
                            <input value={income} onChange={(e) => setIncome(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-2.5 py-1.5 rounded-xl" />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-bold uppercase">Purpose of Loan</label>
                          <input value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-3 py-1.5 rounded-xl" />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Requested Loan (USDC)</label>
                            <input value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-800 text-emerald-400 px-3 py-1.5 rounded-xl font-mono font-bold" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Duration (Months)</label>
                            <select value={borrowDuration} onChange={(e) => setBorrowDuration(parseInt(e.target.value))} className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-3 py-1.5 rounded-xl font-mono">
                              <option value={6}>6 Months</option>
                              <option value={12}>12 Months</option>
                              <option value={24}>24 Months</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-bold uppercase">Collateral Asset</label>
                          <input value={borrowCollateral} onChange={(e) => setBorrowCollateral(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-800 text-amber-400 px-3 py-1.5 rounded-xl font-mono" />
                        </div>

                        <div className="p-3 bg-slate-900 rounded-2xl space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Monthly EMI:</span>
                            <strong className="text-amber-400 font-mono">${emiModel.monthlyEMIUSD} USDC</strong>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Total Interest:</span>
                            <strong className="text-purple-400 font-mono">${emiModel.totalInterestUSD} USDC</strong>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Total Repayment:</span>
                            <strong className="text-white font-mono">${emiModel.totalRepaymentUSD} USDC</strong>
                          </div>
                        </div>

                        <button onClick={() => {
                          triggerModal('Submit Loan Request', 'LoanMarketplace', 'createLoanRequest', `${borrowAmount} USDC`, '📝');
                          addToast('Loan Request Created!', 'Submitted to marketplace. Status: waiting for lender');
                          setFinanceScreen('marketplace');
                        }} className="w-full py-3 bg-gradient-to-r from-amber-600 to-indigo-600 text-white font-bold rounded-xl cursor-pointer">
                          Submit Loan to Marketplace 🚀
                        </button>
                      </div>
                    )}

                    {financeScreen === 'marketplace' && (
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-white uppercase text-xs">Marketplace Request</h4>
                          <span className="text-[10px] text-emerald-400 font-bold">Open Request #1001</span>
                        </div>

                        <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-xl">
                          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <div>
                              <span className="font-bold text-white text-base">Borrower Profile: {borrowerName}</span>
                              <div className="text-[10px] text-indigo-300 font-mono">Wallet: 0x7099...79C8 • Country: {borrowerCountry}</div>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                              KYC Status: Verified ✓
                            </span>
                          </div>

                          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-[11px]">
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-slate-400">Employment:</span> <strong className="text-white">{employment}</strong></div>
                              <div><span className="text-slate-400">Monthly Income:</span> <strong className="text-emerald-400 font-mono">{income}</strong></div>
                              <div><span className="text-slate-400">Purpose:</span> <strong className="text-indigo-300">{loanPurpose}</strong></div>
                              <div><span className="text-slate-400">Requested Amount:</span> <strong className="text-emerald-400 font-mono">{borrowAmount} USDC</strong></div>
                            </div>
                          </div>

                          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-[11px]">
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-slate-400">Monthly EMI:</span> <strong className="text-amber-400 font-mono">${emiModel.monthlyEMIUSD} USDC</strong></div>
                              <div><span className="text-slate-400">Duration:</span> <strong className="text-white">{borrowDuration} Months</strong></div>
                              <div><span className="text-slate-400">Collateral:</span> <strong className="text-amber-400 font-mono">{borrowCollateral}</strong></div>
                              <div><span className="text-slate-400">Risk:</span> <strong className="text-purple-400">Medium</strong></div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => {
                                setModalState({
                                  isOpen: true,
                                  title: `Approve & Fund Loan #1001`,
                                  subtitle: 'Execute smart contract funding flow',
                                  contractName: 'P2PLendingPool',
                                  methodName: 'fundLoan',
                                  amountLabel: 'Transaction Value',
                                  amountValue: `${borrowAmount} USDC`,
                                  params: [
                                    { label: 'Borrower', value: borrowerName },
                                    { label: 'Country', value: borrowerCountry },
                                    { label: 'Collateral', value: borrowCollateral },
                                  ],
                                  icon: '🤝',
                                  onExecute: async () => { await new Promise((r) => setTimeout(r, 800)); },
                                  onSuccessMutation: () => addToast('Loan Approved & Funded!', 'Lender funding flow started successfully.'),
                                });
                              }}
                              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white font-black text-xs rounded-xl cursor-pointer"
                            >
                              Approve & Fund Loan 🤝
                            </button>
                            <button
                              onClick={() => addToast('Agreement Draft Saved', 'Marketplace agreement draft saved locally.')}
                              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] rounded-xl cursor-pointer"
                            >
                              Save Agreement Draft 📄
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {mobileTab === 'nft' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Franchise NFTs</div>
                          <h3 className="text-sm font-black text-white mt-1">Reserve a location-based NFT</h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Available</span>
                      </div>

                      {[
                        { id: 'FR-DEL-01', name: 'Delhi Franchise NFT', location: 'Delhi, India', price: '$1,200', status: 'Available', map: 'North Hub' },
                        { id: 'FR-MUM-02', name: 'Mumbai Franchise NFT', location: 'Mumbai, India', price: '$1,450', status: 'Reserved', map: 'West Hub' },
                      ].map((nft) => (
                        <div key={nft.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-white">{nft.name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{nft.location}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${nft.status === 'Available' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                              {nft.status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>Map: {nft.map}</span>
                            <span>Price: {nft.price}</span>
                          </div>
                          <button
                            onClick={() => {
                              setReservedNft(nft.id);
                              addToast('Reservation Requested', `${nft.name} is now on your shortlist.`);
                            }}
                            className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl cursor-pointer"
                          >
                            {reservedNft === nft.id ? 'Reserved ✓' : 'Reserve NFT'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 📊 TAB 4: PORTFOLIO & ACTIVITY */}
                {mobileTab === 'portfolio' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Account Activity</div>
                          <h3 className="text-sm font-black text-white mt-1">Your phase 1 progress</h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">On Track</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-2xl bg-slate-900">
                          <div className="text-slate-400">KYC Status</div>
                          <div className="font-black text-emerald-400 mt-1">Approved</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-900">
                          <div className="text-slate-400">ICO Contribution</div>
                          <div className="font-black text-white mt-1">$2,500</div>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Lending Access</span>
                          <span className="text-amber-400 font-bold">Unlocked in Phase 2</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-white">Recent Activity</h4>
                        <span className="text-[10px] text-slate-400">Today</span>
                      </div>
                      {[
                        { label: 'Wallet connected', time: '09:41' },
                        { label: 'KYC verified', time: '08:20' },
                        { label: 'ICO stage updated', time: '07:05' },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between items-center rounded-xl bg-slate-900 px-3 py-2 text-[11px]">
                          <span className="text-slate-300">{item.label}</span>
                          <span className="text-slate-400">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 👤 TAB 5: PROFILE */}
                {mobileTab === 'profile' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-3">
                      <h4 className="font-bold text-white">Profile Information</h4>
                      <div className="flex justify-between py-1 border-b border-slate-800"><span>Full Name:</span><strong className="text-white">Dinesh Rivers</strong></div>
                      <div className="flex justify-between py-1 border-b border-slate-800"><span>Email:</span><strong className="text-white">dinesh@abcdefi.io</strong></div>
                      <div className="flex justify-between py-1 border-b border-slate-800"><span>Country:</span><strong className="text-white">India</strong></div>
                      <div className="flex justify-between py-1 border-b border-slate-800"><span>KYC Status:</span><strong className="text-emerald-400 font-bold">Approved</strong></div>
                      <div className="flex justify-between py-1 border-b border-slate-800"><span>Wallet:</span><strong className="text-indigo-300 font-mono">0x7099...79C8</strong></div>
                      <button onClick={() => setMobileFlowStep('splash')} className="w-full py-2.5 bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 mt-2">
                        <LogOut className="w-3.5 h-3.5" /> Logout Session
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 📲 FIXED MOBILE BOTTOM NAVIGATION BAR */}
            {mobileFlowStep === 'app' && (
              <nav className="absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 py-3 px-3 flex justify-around items-center z-30">
                <button
                  onClick={() => setMobileTab('home')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${mobileTab === 'home' ? 'text-indigo-400 font-bold scale-110' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  <span className="text-lg">🏠</span>
                  <span className="text-[9px]">Home</span>
                </button>

                <button
                  onClick={() => setMobileTab('finance')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${mobileTab === 'finance' ? 'text-indigo-400 font-bold scale-110' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  <span className="text-lg">💰</span>
                  <span className="text-[9px]">ICO</span>
                </button>

                <button
                  onClick={() => setMobileTab('nft')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${mobileTab === 'nft' ? 'text-indigo-400 font-bold scale-110' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  <span className="text-lg">🖼</span>
                  <span className="text-[9px]">NFTs</span>
                </button>

                <button
                  onClick={() => setMobileTab('portfolio')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${mobileTab === 'portfolio' ? 'text-indigo-400 font-bold scale-110' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  <span className="text-lg">📊</span>
                  <span className="text-[9px]">Activity</span>
                </button>

                <button
                  onClick={() => setMobileTab('profile')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${mobileTab === 'profile' ? 'text-indigo-400 font-bold scale-110' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  <span className="text-lg">👤</span>
                  <span className="text-[9px]">Profile</span>
                </button>
              </nav>
            )}

            {/* 🤖 FLOATING AI ASSISTANT BUTTON */}
            {portalRole === 'user' && mobileFlowStep === 'app' && (
              <button
                onClick={() => setShowAiDrawer(true)}
                className="absolute bottom-16 right-4 z-40 w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/50 hover:scale-110 transition cursor-pointer border-2 border-indigo-400/50 animate-bounce"
              >
                <span className="text-2xl">🤖</span>
              </button>
            )}

          </div>
        </div>
      )}

      {/* 🤖 59C AI ASSISTANT DRAWER WITH SUGGESTED PROMPTS */}
      {showAiDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>🤖</span> 59C AI Financial Assistant
              </h3>
              <button onClick={() => setShowAiDrawer(false)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SUGGESTED PROMPT BUTTONS */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500">Quick Questions</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'How can I borrow?',
                  'How much rewards?',
                  'Explain portfolio.',
                  'Show my EMIs.',
                  'Suggest investments.',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleAiAskPrompt(q)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold rounded-xl text-[10px] cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* MESSAGES LIST */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {aiMessages.map((m, i) => (
                <div key={i} className={`p-3.5 rounded-2xl ${m.role === 'ai' ? 'bg-indigo-950/50 border border-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-white ml-8'}`}>
                  {m.text}
                </div>
              ))}
            </div>

            {/* AI INPUT */}
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
                placeholder="Ask 59C AI..."
                className="flex-1 bg-slate-950 border border-slate-800 text-white px-4 py-2.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              />
              <button onClick={handleAiSend} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST & WEB3 MODAL */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
      <Web3ActionModal {...modalState} onClose={() => setModalState((p) => ({ ...p, isOpen: false }))} />
    </div>
  );
};
