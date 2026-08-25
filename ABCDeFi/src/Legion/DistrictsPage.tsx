import React, { useState } from 'react';
import { MapPin, Search, ChevronLeft, ShieldCheck, CheckCircle2, Globe, Layers, Sparkles, ExternalLink, User } from 'lucide-react';
import { LegionNFTMetadata, NFTLevel, NFTLevelIcons, slugify } from '../Services/legionNFT';

interface DistrictsPageProps {
  nfts: LegionNFTMetadata[];
  selectedState: string;
  onBackToStates: () => void;
}

export const DistrictsPage: React.FC<DistrictsPageProps> = ({
  nfts,
  selectedState,
  onBackToStates,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const stateFilter = selectedState || 'Telangana';

  const districtNfts = nfts.filter((n) => {
    if (n.level !== NFTLevel.District) return false;

    const parentState = nfts.find((s) => s.nftId === n.parentId);
    const matchesState = stateFilter === 'All' || parentState?.name === stateFilter || n.territory.includes(stateFilter);
    const matchesSearch = searchQuery === '' || n.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesState && matchesSearch;
  });

  // Find Hyderabad and Warangal for Step 24
  const hyderabadNft = districtNfts.find((d) => d.name === 'Hyderabad') || districtNfts[0];
  const warangalNft = districtNfts.find((d) => d.name === 'Warangal') || districtNfts[1];

  const [activeDistrict, setActiveDistrict] = useState<LegionNFTMetadata>(hyderabadNft || districtNfts[0]);

  const getParentState = (parentId: number) => {
    return nfts.find((n) => n.nftId === parentId);
  };

  const getParentCountry = (stateParentId?: number) => {
    if (!stateParentId) return undefined;
    const parentState = nfts.find((n) => n.nftId === stateParentId);
    if (!parentState) return undefined;
    return nfts.find((n) => n.nftId === parentState.parentId);
  };

  const getParentContinent = (countryParentId?: number) => {
    if (!countryParentId) return undefined;
    const parentCountry = nfts.find((n) => n.nftId === countryParentId);
    if (!parentCountry) return undefined;
    return nfts.find((n) => n.nftId === parentCountry.parentId);
  };

  const getArtworkPath = (slug: string) => `/assets/districts/${slug}.png`;

  const activeParentState = getParentState(activeDistrict?.parentId || 0);
  const activeParentCountry = getParentCountry(activeParentState?.nftId);
  const activeParentContinent = getParentContinent(activeParentCountry?.nftId);

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER & NAV */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <button
          onClick={onBackToStates}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-amber-400" /> Back to States ({stateFilter})
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold mb-1">
              <Sparkles className="w-3 h-3" /> Step 24 — District NFT Inspector & Details
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <MapPin className="w-6 h-6 text-amber-400" />
              District Page ({districtNfts.length} Telangana Districts)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspecting complete on-chain NFT details for Telangana Districts (e.g. <span className="text-amber-400 font-bold">Hyderabad</span>, <span className="text-amber-400 font-bold">Warangal</span>).
            </p>
          </div>

          <div className="px-3 py-1 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold shrink-0">
            State Parent: {stateFilter}
          </div>
        </div>

        {/* STEP 24 QUICK HIGHLIGHT BUTTONS (HYDERABAD & WARANGAL) */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Select:</span>
          {hyderabadNft && (
            <button
              onClick={() => setActiveDistrict(hyderabadNft)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeDistrict?.nftId === hyderabadNft.nftId
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950 text-amber-400 border border-amber-500/40 hover:border-amber-400'
              }`}
            >
              <span>📍 Hyderabad (#{hyderabadNft.nftId})</span>
            </button>
          )}

          {warangalNft && (
            <button
              onClick={() => setActiveDistrict(warangalNft)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeDistrict?.nftId === warangalNft.nftId
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950 text-amber-400 border border-amber-500/40 hover:border-amber-400'
              }`}
            >
              <span>📍 Warangal (#{warangalNft.nftId})</span>
            </button>
          )}
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search 33 Telangana districts (e.g. Hyderabad, Warangal, Nizamabad, Karimnagar)..."
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* DUAL VIEW: DISTRICT INSPECTOR + CATALOG GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* INSPECTOR CARD (STEP 24: SHOWS NFT DETAILS) */}
        {activeDistrict && (
          <div className="bg-slate-950 border border-amber-500/40 rounded-3xl p-5 space-y-4 lg:col-span-1 shadow-2xl ring-1 ring-amber-500/20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> On-Chain NFT Details
              </span>
              <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                Token ID #{activeDistrict.nftId}
              </span>
            </div>

            {/* ARTWORK DISPLAY */}
            <div className="w-full aspect-square bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center p-4 text-center">
              <img
                src={getArtworkPath(slugify(activeDistrict.name))}
                alt={activeDistrict.name}
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

              <div className="fallback-card absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 p-4 flex flex-col items-center justify-between text-center hidden">
                <div className="text-[10px] font-black text-amber-400 tracking-wider">TELANGANA DISTRICT</div>
                <div className="space-y-1">
                  <div className="text-3xl">📍</div>
                  <h3 className="text-2xl font-black text-white">{activeDistrict.name}</h3>
                  <div className="text-[10px] text-amber-300 font-bold uppercase">{activeDistrict.territory}</div>
                </div>
                <div className="text-[9px] text-indigo-300 italic font-bold">District Knight</div>
              </div>
            </div>

            {/* STEP 24 FULL NFT DETAILS TABLE */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500">Name:</span>
                <span className="font-black text-white">{activeDistrict.name}</span>
              </div>

              <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500">Hierarchy Level:</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <span>📍</span> District (Level 3)
                </span>
              </div>

              {/* LINEAGE CHAIN */}
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Full Phase 6 Hierarchy Lineage:</span>
                <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1 flex-wrap">
                  <span className="text-amber-400">{activeParentContinent?.name || 'Asia'}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-amber-400">{activeParentCountry?.name || 'India'}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-amber-400">{activeParentState?.name || 'Telangana'}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-white bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">{activeDistrict.name}</span>
                </div>
              </div>

              <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500">Character Role:</span>
                <span className="font-bold text-cyan-300">{activeDistrict.character}</span>
              </div>

              <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500">Treasury Revenue Share:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {(activeDistrict.treasuryShareBps / 100).toFixed(2)}% ({activeDistrict.treasuryShareBps} Bps)
                </span>
              </div>

              <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500">Population Metric:</span>
                <span className="font-bold text-slate-300 font-mono">{activeDistrict.population.toLocaleString()}</span>
              </div>

              <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500">Owner Wallet:</span>
                <span className="font-mono text-[10px] text-slate-300 truncate max-w-[160px] flex items-center gap-1">
                  <User className="w-3 h-3 text-indigo-400" />
                  {activeDistrict.owner}
                </span>
              </div>

              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Metadata URI (IPFS):</span>
                <span className="font-mono text-[10px] text-amber-400 break-all flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {activeDistrict.metadataURI}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* DISTRICT CATALOG GRID */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">District Catalog ({districtNfts.length})</span>
            <span className="text-[10px] text-slate-500 font-bold">Click any district card to view NFT details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
            {districtNfts.map((district) => {
              const isSelected = activeDistrict?.nftId === district.nftId;
              const isHighlight = district.name === 'Hyderabad' || district.name === 'Warangal';

              return (
                <div
                  key={district.nftId}
                  onClick={() => setActiveDistrict(district)}
                  className={`bg-slate-950 border rounded-2xl p-3.5 space-y-2 cursor-pointer transition hover:scale-[1.02] ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-500/10'
                      : isHighlight
                      ? 'border-amber-500/40 hover:border-amber-400 bg-slate-900/60'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">📍</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                      #{district.nftId}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                      <span>{district.name}</span>
                      {isHighlight && (
                        <span className="px-1.5 py-0.2 text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono">
                          Featured
                        </span>
                      )}
                    </h4>
                    <div className="text-[10px] text-slate-400 truncate">{activeParentState?.name || 'Telangana'} State</div>
                  </div>

                  <div className="text-[9px] text-emerald-400 font-mono flex items-center justify-between">
                    <span>0.50% Share</span>
                    <span className="text-cyan-400 font-bold">District Knight</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
