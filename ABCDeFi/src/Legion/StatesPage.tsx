import React, { useState } from 'react';
import { Landmark, ArrowRight, Search, ChevronLeft, Layers, ShieldCheck } from 'lucide-react';
import { LegionNFTMetadata, NFTLevel, NFTLevelIcons, slugify } from '../Services/legionNFT';

interface StatesPageProps {
  nfts: LegionNFTMetadata[];
  selectedCountry: string;
  onSelectState: (stateName: string) => void;
  onBackToCountries: () => void;
}

export const StatesPage: React.FC<StatesPageProps> = ({
  nfts,
  selectedCountry,
  onSelectState,
  onBackToCountries,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const countryFilter = selectedCountry || 'India';

  const stateNfts = nfts.filter((n) => {
    if (n.level !== NFTLevel.State) return false;

    // Find parent country
    const parentCountry = nfts.find((c) => c.nftId === n.parentId);
    const matchesCountry = countryFilter === 'All' || parentCountry?.name === countryFilter || n.territory.includes(countryFilter);
    const matchesSearch = searchQuery === '' || n.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCountry && matchesSearch;
  });

  const getDistrictCount = (stateId: number) => {
    return nfts.filter((n) => n.level === NFTLevel.District && n.parentId === stateId).length;
  };

  const getArtworkPath = (slug: string) => `/assets/states/${slug}.png`;

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER & NAV */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-3">
        <button
          onClick={onBackToCountries}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-amber-400" /> Back to Countries
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Landmark className="w-6 h-6 text-amber-400" />
              State NFTs for {countryFilter} ({stateNfts.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Regional Warlord governance tokens (1.50% Treasury Bps). Click a state (e.g. <span className="text-amber-400 font-bold">Telangana</span>) to drill down into its Districts.
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold shrink-0">
            Parent Country: {countryFilter}
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search states (e.g. Telangana, Tamil Nadu, Andhra Pradesh, Maharashtra)..."
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* STATES CATALOG GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stateNfts.map((state) => {
          const districtCount = getDistrictCount(state.nftId);
          const slug = slugify(state.name);

          return (
            <div
              key={state.nftId}
              onClick={() => onSelectState(state.name)}
              className="bg-slate-950 border border-slate-800 hover:border-amber-500/80 rounded-2xl p-4 space-y-3 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{NFTLevelIcons[state.level]}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                  #{state.nftId}
                </span>
              </div>

              {/* CARD MEDIA WITH FALLBACK */}
              <div className="w-full aspect-video bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative flex flex-col items-center justify-center p-3 text-center group-hover:border-amber-500/40 transition">
                <img
                  src={getArtworkPath(slug)}
                  alt={state.name}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent) {
                      const fallback = parent.querySelector('.fallback-card') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }
                  }}
                  className="w-full h-full object-cover rounded-lg"
                />

                <div className="fallback-card absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-amber-950/40 p-3 flex flex-col items-center justify-between text-center hidden">
                  <div className="text-[9px] font-black text-amber-400 tracking-wider">REGIONAL STATE</div>
                  <h4 className="text-lg font-black text-white">{state.name}</h4>
                  <div className="text-[9px] text-emerald-400 font-mono">1.50% Share</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">State Territory</div>
                <h4 className="text-base font-black text-white group-hover:text-amber-300 transition truncate">{state.name}</h4>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[11px]">
                <span className="text-slate-400 flex items-center gap-1 font-bold">
                  <Layers className="w-3.5 h-3.5 text-amber-400" /> {districtCount > 0 ? `${districtCount} Districts` : 'District Lineage'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectState(state.name);
                  }}
                  className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[10px]"
                >
                  View Districts <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
