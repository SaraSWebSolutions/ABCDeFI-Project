import React from 'react';
import { Globe, Flag, Landmark, MapPin, Layers, Award, Users, TrendingUp, ShieldCheck } from 'lucide-react';
import { LegionNFTMetadata, NFTLevel } from '../Services/legionNFT';

interface LegionStatsDashboardProps {
  nfts: LegionNFTMetadata[];
}

export const LegionStatsDashboard: React.FC<LegionStatsDashboardProps> = ({ nfts }) => {
  const continentsCount = nfts.filter((n) => n.level === NFTLevel.Continent).length;
  const countriesCount = nfts.filter((n) => n.level === NFTLevel.Country).length;
  const statesCount = nfts.filter((n) => n.level === NFTLevel.State).length;
  const districtsCount = nfts.filter((n) => n.level === NFTLevel.District).length;
  const totalNftsCount = nfts.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl font-mono">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Phase 10 — Statistics Dashboard
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-400" />
            Legion Territory Ecosystem Statistics
          </h2>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black flex items-center gap-2 shrink-0">
          <Award className="w-4 h-4 text-amber-400" /> Total Minted: {totalNftsCount} NFTs
        </div>
      </div>

      {/* PHASE 10 STATS COUNTERS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* STAT 1: CONTINENTS */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-amber-500/60 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Continents</span>
            <span className="text-xl">🌍</span>
          </div>
          <div className="text-3xl font-black text-white">{continentsCount}</div>
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Top-Level Tier (5.00%)</div>
        </div>

        {/* STAT 2: COUNTRIES */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-amber-500/60 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Countries</span>
            <span className="text-xl">🏳️</span>
          </div>
          <div className="text-3xl font-black text-white">{countriesCount}</div>
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">UN Member Countries (3.00%)</div>
        </div>

        {/* STAT 3: STATES */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-amber-500/60 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>States</span>
            <span className="text-xl">🏛️</span>
          </div>
          <div className="text-3xl font-black text-white">{statesCount}</div>
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Regional States/UTs (1.50%)</div>
        </div>

        {/* STAT 4: DISTRICTS */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-amber-500/60 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Districts</span>
            <span className="text-xl">📍</span>
          </div>
          <div className="text-3xl font-black text-white">{districtsCount}</div>
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Telangana Districts (0.50%)</div>
        </div>

        {/* STAT 5: TOTAL NFTS */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-950 to-yellow-500/10 border border-amber-500/40 rounded-2xl p-4 space-y-2 col-span-2 lg:col-span-1 ring-1 ring-amber-500/20">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
            <span>Total NFTs</span>
            <span className="text-xl">👑</span>
          </div>
          <div className="text-3xl font-black text-amber-300">{totalNftsCount}</div>
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Full Lineage Minted</div>
        </div>
      </div>
    </div>
  );
};

export default LegionStatsDashboard;
