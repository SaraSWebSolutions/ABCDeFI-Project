import React, { useState } from 'react';
import {
  Lock,
  Coins,
  RefreshCw,
  Flame,
  TrendingUp,
  Landmark,
  Award,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  INITIAL_ELIC_STATS,
  RECENT_ELIC_LOANS,
  eLICExecutionResult,
  executeeLICMechanism,
} from '../Services/elicEngine';

export const eLICDashboard: React.FC = () => {
  const [collateralETH, setCollateralETH] = useState('5.0');
  const [borrowABCD, setBorrowABCD] = useState('25000');
  const [stats, setStats] = useState(INITIAL_ELIC_STATS);
  const [history, setHistory] = useState<eLICExecutionResult[]>(RECENT_ELIC_LOANS);
  const [executing, setExecuting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    const eth = parseFloat(collateralETH);
    const abcd = parseFloat(borrowABCD);
    if (!eth || !abcd) return;

    setExecuting(true);
    setFeedbackMsg('Executing 7-step eLIC Whitepaper Mechanism...');
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await executeeLICMechanism(eth, abcd);
      setHistory([res, ...history]);
      setStats({ ...INITIAL_ELIC_STATS });
      setFeedbackMsg(
        `✓ Success! Executed eLIC Mechanism for ${res.loanId}. Burned ${res.abcdBurned.toLocaleString()} ABCD (Floor price increased to $${res.abcdFloorPriceAfterUSD}). Minted ${res.loanNftId}!`
      );
    } catch {
      setFeedbackMsg('Failed to execute eLIC Mechanism.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div id="elic-dashboard" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>Whitepaper Mechanism</span>
            <span className="text-slate-600">↓</span>
            <span>eLIC Tokenomics & Lending Engine</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Zap className="w-5 h-5 text-amber-400" />
            eLIC Loan Mechanism (7-Step Tokenomics Engine)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Whitepaper-specific loan execution combining collateral locking, derivative conversion, token burning, and NFT minting.
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <span>ABCD Floor Price: ${stats.currentAbcdFloorPriceUSD.toFixed(4)} USD</span>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {executing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* 7-STEP WHITEPAPER PIPELINE STEPRER */}
      <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">The 7-Step Whitepaper eLIC Mechanism</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2 text-center text-xs">
          {[
            { step: '1. Lock Collateral', icon: Lock, desc: 'Lock ETH Vault' },
            { step: '2. Issue ABCD', icon: Coins, desc: 'Mint Liquid Tokens' },
            { step: '3. Convert X Loan', icon: RefreshCw, desc: 'xLOAN Derivative' },
            { step: '4. Burn Tokens', icon: Flame, desc: '2% Deflation Burn' },
            { step: '5. Increase Value', icon: TrendingUp, desc: 'Floor Price Boost' },
            { step: '6. Reserve Alloc', icon: Landmark, desc: '3% Treasury Pool' },
            { step: '7. Mint Loan NFTs', icon: Award, desc: 'Soulbound NFTs' },
          ].map((st, i) => {
            const IC = st.icon;
            return (
              <div key={i} className="p-3 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl space-y-1.5 transition">
                <IC className="w-4 h-4 text-amber-400 mx-auto" />
                <div className="font-bold text-white text-[11px]">{st.step}</div>
                <div className="text-[9px] text-slate-500">{st.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EXECUTE FORM & TOKENOMICS METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* EXECUTION FORM */}
        <form onSubmit={handleExecute} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Execute eLIC Mechanism
          </h3>

          <div>
            <label className="block text-slate-400 mb-1">1. ETH Collateral Amount</label>
            <input
              type="number"
              value={collateralETH}
              onChange={(e) => setCollateralETH(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
              step="0.1"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">2. ABCD Borrow Amount</label>
            <input
              type="number"
              value={borrowABCD}
              onChange={(e) => setBorrowABCD(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {/* Breakdown Preview */}
          <div className="bg-slate-900 p-3 rounded-2xl space-y-1.5 border border-slate-800 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>xLOAN Derivative Converted:</span>
              <span className="text-white font-bold">{parseFloat(borrowABCD || '0').toLocaleString()} xLOAN</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>2% Deflationary Burn:</span>
              <span className="text-rose-400 font-bold">{(parseFloat(borrowABCD || '0') * 0.02).toLocaleString()} ABCD 🔥</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>3% Treasury Reserve:</span>
              <span className="text-purple-400 font-bold">{(parseFloat(borrowABCD || '0') * 0.03).toLocaleString()} ABCD 🏛️</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1 text-white font-bold">
              <span>Net Borrower Receives:</span>
              <span className="text-emerald-400">{(parseFloat(borrowABCD || '0') * 0.95).toLocaleString()} ABCD</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={executing}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black py-3 rounded-2xl shadow-lg shadow-amber-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>Execute 7-Step eLIC Loan</span>
          </button>
        </form>

        {/* TOKENOMICS CUMULATIVE STATS */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Cumulative eLIC Tokenomics Engine Metrics
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-500 uppercase">Collateral Locked</div>
              <div className="text-lg font-black text-white mt-1">{stats.totalCollateralLockedETH.toFixed(1)} ETH</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-500 uppercase">ABCD Tokens Issued</div>
              <div className="text-lg font-black text-amber-300 mt-1">{(stats.totalAbcdIssued / 1000000).toFixed(2)}M ABCD</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-500 uppercase">xLOAN Converted</div>
              <div className="text-lg font-black text-indigo-300 mt-1">{(stats.totalXLoanDerivativeConverted / 1000000).toFixed(2)}M xLOAN</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-500 uppercase">Tokens Burned 🔥</div>
              <div className="text-lg font-black text-rose-400 mt-1">{stats.totalAbcdBurned.toLocaleString()} ABCD</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-500 uppercase">Reserve Allocated</div>
              <div className="text-lg font-black text-purple-300 mt-1">${stats.totalReserveAllocatedUSD.toLocaleString()} USD</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-500 uppercase">Floor Price Boost</div>
              <div className="text-lg font-black text-emerald-400 mt-1">${stats.currentAbcdFloorPriceUSD.toFixed(4)} USD</div>
            </div>
          </div>

          {/* RECENT ELIC LOAN EXECUTIONS */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase">Recent eLIC Loan Executions</h4>
            <div className="space-y-2 text-xs">
              {history.map((l) => (
                <div key={l.loanId} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{l.loanId}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        {l.loanNftId}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Collateral: {l.collateralETH} ETH | Issued: {l.abcdIssued.toLocaleString()} ABCD | Burned: {l.abcdBurned.toLocaleString()} ABCD 🔥
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-emerald-400 font-bold text-xs">+${l.abcdFloorPriceAfterUSD.toFixed(4)} Floor</div>
                    <div className="text-[9px] text-slate-500">{l.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* X LOAN TOKEN SYSTEM SECTION (Loan ➔ X Loan Token ➔ Burn ➔ ABCD Token) */}
      <div className="bg-slate-950 border border-indigo-500/30 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <span>Whitepaper Derivative Engine</span>
              <span className="text-slate-600">↓</span>
              <span>X Loan Token System</span>
            </div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2 mt-0.5">
              <Flame className="w-4 h-4 text-indigo-400" />
              X Loan Token System (Loan ➔ X Loan Token ➔ Burn ➔ ABCD Token)
            </h3>
          </div>
          <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
            xLOAN Derivative Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center text-xs">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-slate-400 font-bold">1. Create Loan</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ETH Locked in Vault</div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-indigo-300 font-bold">2. Mint xLOAN Token</div>
            <div className="text-[10px] text-slate-500 mt-0.5">1:1 Derivative Debt Token</div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-rose-400 font-bold">3. Burn xLOAN Token</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Deflationary Supply Reduction</div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-emerald-400 font-bold">4. Receive ABCD Token</div>
            <div className="text-[10px] text-slate-500 mt-0.5">+2% Yield Bonus Unlocked</div>
          </div>
        </div>

        {/* WHITEPAPER EXACT EXAMPLE: 112 X Tokens ➔ Burn 12 ➔ 100 ABCD ➔ Increase ABCD Value */}
        <div className="pt-3 border-t border-slate-800/80 bg-slate-900/60 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase">
            <span>Whitepaper Dynamic Burn Value Example</span>
            <span className="text-emerald-400 font-mono">+0.12% Floor Price Boost</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 font-bold">112 X Tokens</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Input Position</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-rose-500/40 text-rose-300">
              <div className="font-bold flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Burn 12 Tokens
              </div>
              <div className="text-[10px] text-rose-400/80 mt-0.5">10.71% Deflation</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/40 text-emerald-300">
              <div className="font-bold">100 ABCD Tokens</div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5">Released to User</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/40 text-amber-300">
              <div className="font-bold flex items-center justify-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Increase ABCD Value
              </div>
              <div className="text-[10px] text-amber-400/80 mt-0.5">$0.1850 ➔ $0.1852 USD</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default eLICDashboard;
