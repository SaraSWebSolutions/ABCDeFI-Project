import React, { useState } from 'react';
import { Flag, ArrowRight, Search, ChevronLeft, Shield, Layers } from 'lucide-react';
import { LegionNFTMetadata, NFTLevel, NFTLevelIcons, CONTINENTS_6, slugify } from '../Services/legionNFT';

interface CountriesPageProps {
  nfts: LegionNFTMetadata[];
  selectedContinent: string;
  onSelectContinent: (continentName: string) => void;
  onSelectCountry: (countryName: string) => void;
  onBackToContinents: () => void;
}

export const CountriesPage: React.FC<CountriesPageProps> = ({
  nfts,
  selectedContinent,
  onSelectContinent,
  onSelectCountry,
  onBackToContinents,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const continentFilter = selectedContinent || 'All';

  const countryNfts = nfts.filter((n) => {
    if (n.level !== NFTLevel.Country) return false;

    // Map parent ID to continent name
    const parentContinent = nfts.find((cont) => cont.nftId === n.parentId);
    const matchesContinent = continentFilter === 'All' || parentContinent?.name === continentFilter;
    const matchesSearch = searchQuery === '' || n.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesContinent && matchesSearch;
  });

  const getParentContinentName = (parentId: number) => {
    const parent = nfts.find((n) => n.nftId === parentId);
    return parent ? parent.name : 'Asia';
  };

  const getStateCount = (countryId: number) => {
    return nfts.filter((n) => n.level === NFTLevel.State && n.parentId === countryId).length;
  };

  const getArtworkPath = (slug: string) => `/assets/countries/${slug}.png`;

  return (
    <div className="space-y-6 font-mono">
      {/* NAVIGATION & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="space-y-2">
          <button
            onClick={onBackToContinents}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" /> Back to Continents
          </button>

          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Flag className="w-6 h-6 text-amber-400" />
            Country NFTs ({countryNfts.length})
          </h2>
          <p className="text-xs text-slate-400">
            Showing countries in <span className="text-amber-400 font-bold">{continentFilter}</span>. Click a country (e.g. India) to drill down into its States.
          </p>
        </div>

        {/* CONTINENT SELECTOR TABS */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onSelectContinent('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              continentFilter === 'All'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All Continents
          </button>
          {CONTINENTS_6.map((c) => (
            <button
              key={c}
              onClick={() => onSelectContinent(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                continentFilter === c
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search 193 countries (e.g. India, USA, Germany)..."
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* COUNTRIES CATALOG GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {countryNfts.map((country) => {
          const parentContinent = getParentContinentName(country.parentId);
          const stateCount = getStateCount(country.nftId);
          const slug = slugify(country.name);

          return (
            <div
              key={country.nftId}
              onClick={() => onSelectCountry(country.name)}
              className="bg-slate-950 border border-slate-800 hover:border-amber-500/80 rounded-2xl p-4 space-y-3 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{NFTLevelIcons[country.level]}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                  #{country.nftId}
                </span>
              </div>

              {/* CARD MEDIA WITH FALLBACK */}
              <div className="w-full aspect-square bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative flex flex-col items-center justify-center p-3 text-center group-hover:border-amber-500/40 transition">
                <img
                  src={getArtworkPath(slug)}
                  alt={country.name}
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

                <div className="fallback-card absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 p-3 flex flex-col items-center justify-between text-center hidden">
                  <div className="text-[9px] font-black text-amber-400 tracking-wider">ABCDeFi COUNTRY</div>
                  <div className="space-y-0.5">
                    <h4 className="text-base font-black text-white">{country.name}</h4>
                    <div className="text-[9px] text-indigo-300 font-bold uppercase">{parentContinent}</div>
                  </div>
                  <div className="text-[8px] text-emerald-400 font-mono">3.00% Treasury Share</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{parentContinent}</div>
                <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition truncate">{country.name}</h4>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[11px]">
                <span className="text-slate-400 flex items-center gap-1 font-bold">
                  <Layers className="w-3 h-3 text-amber-400" /> {stateCount > 0 ? `${stateCount} States` : 'State Lineage'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCountry(country.name);
                  }}
                  className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[10px]"
                >
                  View States <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
