import React, { useState } from 'react';
import { TOKEN_ALLOCATIONS, TOTAL_SUPPLY, SALE_PHASES } from '../Services/icoLaunchpad';

export const TokenomicsDashboard: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'allocation' | 'ico' | 'treasury' | 'reserve'>('allocation');

  const treasurySplits = [
    { name: 'Platform Development', pct: 15, color: '#3b82f6' },
    { name: 'DEX / CEX Liquidity', pct: 40, color: '#10b981' },
    { name: 'Marketing & PR', pct: 5, color: '#f59e0b' },
    { name: 'Smart Contract Audits', pct: 15, color: '#8b5cf6' },
    { name: 'Community Grants', pct: 5, color: '#ec4899' },
    { name: 'Financial Education', pct: 10, color: '#06b6d4' },
    { name: 'Contingency Reserve', pct: 8, color: '#ef4444' },
    { name: 'Protocol Reserve', pct: 2, color: '#6366f1' },
  ];

  return (
    <div className="w-full bg-slate-950 text-white rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
            ABCDeFi Protocol Tokenomics & Analytics
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Total Fixed Supply: <span className="text-emerald-400 font-mono font-semibold">1,000,000,000,000,000 ABCD</span> (1 Quadrillion)
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          {(['allocation', 'ico', 'treasury', 'reserve'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                selectedTab === tab
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Allocation Module */}
      {selectedTab === 'allocation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Token Distribution Breakdowns</h3>
            <div className="space-y-3">
              {TOKEN_ALLOCATIONS.map((alloc) => (
                <div key={alloc.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: alloc.color }}></span>
                      {alloc.label}
                    </span>
                    <span className="font-mono text-emerald-400">{alloc.pct}% ({alloc.tokens} ABCD)</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${alloc.pct}%`, backgroundColor: alloc.color }}></div>
                  </div>
                  <span className="text-xs text-slate-400">Lockup / Schedule: {alloc.lockup}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-md font-semibold text-slate-200 mb-2">Ecosystem Wallets Status</h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                  <span className="text-slate-400">Founder Vesting (55%)</span>
                  <span className="text-emerald-400 font-mono">550T ABCD</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                  <span className="text-slate-400">ICO Presale Vault (20%)</span>
                  <span className="text-emerald-400 font-mono">200T ABCD</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                  <span className="text-slate-400">Partnerships / Mktg (10%)</span>
                  <span className="text-emerald-400 font-mono">100T ABCD</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                  <span className="text-slate-400">Finance Resource (9%)</span>
                  <span className="text-emerald-400 font-mono">90T ABCD</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                  <span className="text-slate-400">Advisors (2%)</span>
                  <span className="text-emerald-400 font-mono">20T ABCD</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                  <span className="text-slate-400">Contingency Fund (2%)</span>
                  <span className="text-emerald-400 font-mono">20T ABCD</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                  <span className="text-slate-400">Protocol Reserve (2%)</span>
                  <span className="text-emerald-400 font-mono">20T ABCD</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-lg text-xs text-indigo-300">
              ⚡ All initial allocations minted strictly once on-contract creation. Minter rights capped permanently.
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 3-Stage ICO Progress */}
      {selectedTab === 'ico' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SALE_PHASES.map((phase) => (
              <div key={phase.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">{phase.label}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${
                    phase.status === 'Live' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                    phase.status === 'Filled' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' :
                    'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {phase.status}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{phase.icon}</span> {phase.name}
                </h4>
                <div className="space-y-1 text-xs text-slate-300">
                  <div className="flex justify-between"><span>Token Price:</span> <span className="font-mono text-emerald-400">${phase.tokenPrice}</span></div>
                  <div className="flex justify-between"><span>Hard Cap:</span> <span className="font-mono">${phase.hardCap.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Timeframe:</span> <span>{phase.startsAt} - {phase.endsAt}</span></div>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full" style={{ width: `${(phase.soldTokens / phase.totalTokens) * 100}%` }}></div>
                </div>
                <p className="text-xs text-slate-400 text-right font-mono">
                  {((phase.soldTokens / phase.totalTokens) * 100).toFixed(1)}% Sold
                </p>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h4 className="text-md font-semibold text-slate-200">Automatic Stage Rollover Engine</h4>
              <p className="text-xs text-slate-400 mt-1">Unsold tokens from Private & Presale automatically carry over to next stage. Remaining tokens at conclusion transfer to ReserveVault.</p>
            </div>
            <button className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-semibold hover:brightness-110 transition-all">
              Trigger Stage Rollover Check
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Treasury Splits */}
      {selectedTab === 'treasury' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-200">Treasury Automated 8-Way Fund Distribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {treasurySplits.map((item) => (
              <div key={item.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-lg font-mono font-bold" style={{ color: item.color }}>{item.pct}%</span>
                </div>
                <h4 className="text-sm font-medium text-slate-200">{item.name}</h4>
                <p className="text-xs text-slate-400">Automated ETH/USDT vault allocation</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Reserve Vault & Growth */}
      {selectedTab === 'reserve' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Protocol Reserve & Recycled Assets</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Unsold ICO Tokens Recycled</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">42,500,000 ABCD</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Unclaimed Bonus Tokens Recycled</span>
              <p className="text-xl font-bold font-mono text-indigo-400 mt-1">1,850,000 ABCD</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Treasury 2% Protocol Funds</span>
              <p className="text-xl font-bold font-mono text-amber-400 mt-1">128.5 ETH</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
