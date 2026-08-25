import React from 'react';
import { Globe, ArrowRight, ShieldCheck, Layers, Users } from 'lucide-react';
import { LegionNFTMetadata, NFTLevel, NFTLevelIcons, slugify } from '../Services/legionNFT';

interface ContinentsPageProps {
  nfts: LegionNFTMetadata[];
  onSelectContinent: (continentName: string) => void;
}

export const ContinentsPage: React.FC<ContinentsPageProps> = ({ nfts, onSelectContinent }) => {
  const continentNfts = nfts.filter((n) => n.level === NFTLevel.Continent);

  const getCountryCount = (continentId: number) => {
    return nfts.filter((n) => n.level === NFTLevel.Country && n.parentId === continentId).length;
  };

  const getArtworkPath = (slug: string) => `/assets/continents/${slug}.png`;

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER HERO */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Globe className="w-80 h-80 text-amber-400" />
        </div>

        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
            <Globe className="w-3.5 h-3.5" /> Step 21 — Top-Level Continents Page
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Legion Continent NFTs ({continentNfts.length})
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Supreme Guardians governing regional territories. Select a continent below to drill down into its UN member countries.
          </p>
        </div>
      </div>

      {/* CONTINENTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {continentNfts.map((continent) => {
          const countriesCount = getCountryCount(continent.nftId);
          const slug = slugify(continent.name);

          return (
            <div
              key={continent.nftId}
              onClick={() => onSelectContinent(continent.name)}
              className="bg-slate-950 border border-slate-800 hover:border-amber-500/80 rounded-3xl p-5 space-y-4 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 group relative"
            >
              {/* TOP BADGE */}
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 font-black text-xs">
                  NFT #{continent.nftId}
                </span>
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {continent.character}
                </span>
              </div>

              {/* CARD MEDIA WITH FALLBACK */}
              <div className="w-full aspect-video bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center p-4 text-center group-hover:border-amber-500/40 transition">
                <img
                  src={getArtworkPath(slug)}
                  alt={continent.name}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent) {
                      const fallback = parent.querySelector('.fallback-card') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }
                  }}
                  className="w-full h-full object-cover rounded-xl"
                />

                <div className="fallback-card absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 p-4 flex flex-col items-center justify-center space-y-1 text-center hidden">
                  <div className="text-4xl">{NFTLevelIcons[continent.level]}</div>
                  <h3 className="text-xl font-black text-white">{continent.name}</h3>
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{continent.territory}</div>
                </div>
              </div>

              {/* DETAILS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition flex items-center gap-2">
                    <span>{NFTLevelIcons[continent.level]}</span>
                    <span>{continent.name}</span>
                  </h3>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {(continent.treasuryShareBps / 100).toFixed(2)}% Bps
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  Top tier territory governing {countriesCount} countries. Supreme Guardian authority token.
                </p>
              </div>

              {/* ACTION FOOTER */}
              <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-bold">
                  <Layers className="w-3.5 h-3.5 text-amber-400" /> {countriesCount} Countries
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectContinent(continent.name);
                  }}
                  className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  View Countries <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
