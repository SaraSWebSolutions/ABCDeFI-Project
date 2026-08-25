import React, { useState } from 'react';
import { Globe, Flag, Landmark, MapPin, ChevronRight, Layers, Sparkles } from 'lucide-react';
import { MOCK_LEGION_NFTS, LegionNFTMetadata } from '../Services/legionNFT';
import { ContinentsPage } from './ContinentsPage';
import { CountriesPage } from './CountriesPage';
import { StatesPage } from './StatesPage';
import { DistrictsPage } from './DistrictsPage';
import { FranchiseDashboard } from './FranchiseDashboard';
import { LegionSearch } from './LegionSearch';
import { LegionStatsDashboard } from './LegionStatsDashboard';

export type LegionViewMode = 'Continents' | 'Countries' | 'States' | 'Districts' | 'Franchise';

export const LegionApp: React.FC = () => {
  const [nfts, setNfts] = useState<LegionNFTMetadata[]>(MOCK_LEGION_NFTS);
  const [viewMode, setViewMode] = useState<LegionViewMode>('Franchise');

  const [selectedContinent, setSelectedContinent] = useState<string>('Asia');
  const [selectedCountry, setSelectedCountry] = useState<string>('India');
  const [selectedState, setSelectedState] = useState<string>('Telangana');

  const handleNftMinted = (newNft: LegionNFTMetadata) => {
    setNfts([newNft, ...nfts]);
  };

  const handleSearchSelectNft = (nft: LegionNFTMetadata) => {
    if (nft.level === 0) setViewMode('Continents');
    else if (nft.level === 1) setViewMode('Countries');
    else if (nft.level === 2) setViewMode('States');
    else if (nft.level === 3) setViewMode('Districts');
  };

  // Drilldown Navigation Handlers
  const handleContinentClick = (continentName: string) => {
    setSelectedContinent(continentName);
    setViewMode('Countries');
  };

  const handleCountryClick = (countryName: string) => {
    setSelectedCountry(countryName);
    setViewMode('States');
  };

  const handleStateClick = (stateName: string) => {
    setSelectedState(stateName);
    setViewMode('Districts');
  };

  return (
    <div id="legion-app-container" className="space-y-6 font-mono">
      {/* PHASE 10: STATISTICS DASHBOARD */}
      <LegionStatsDashboard nfts={nfts} />

      {/* PHASE 9: MULTI-TIER SEARCH */}
      <LegionSearch nfts={nfts} onSelectNft={handleSearchSelectNft} />

      {/* GLOBAL TOP NAVIGATION HIERARCHY BREADCRUMB */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-amber-400">Legion Hierarchy & Franchise Portal</div>
            <div className="text-sm font-black text-white">Continents ↓ Countries ↓ States ↓ Districts</div>
          </div>
        </div>

        {/* BREADCRUMB TRAIL & FRANCHISE TAB */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {/* Step 21: Continents */}
          <button
            onClick={() => setViewMode('Continents')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'Continents'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Continents</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

          {/* Step 22: Countries */}
          <button
            onClick={() => setViewMode('Countries')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'Countries'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Countries ({selectedContinent})</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

          {/* Step 23: States */}
          <button
            onClick={() => setViewMode('States')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'States'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>States ({selectedCountry})</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

          {/* Step 24: Districts */}
          <button
            onClick={() => setViewMode('Districts')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'Districts'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Districts ({selectedState})</span>
          </button>

          {/* PHASE 8: FRANCHISE DASHBOARD */}
          <button
            onClick={() => setViewMode('Franchise')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'Franchise'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-black'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/40 hover:bg-amber-500/20'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>Franchise Dashboard (0-Code)</span>
          </button>
        </div>
      </div>

      {/* RENDER CURRENT PAGE */}
      {viewMode === 'Continents' && (
        <ContinentsPage
          nfts={nfts}
          onSelectContinent={handleContinentClick}
        />
      )}

      {viewMode === 'Countries' && (
        <CountriesPage
          nfts={nfts}
          selectedContinent={selectedContinent}
          onSelectContinent={setSelectedContinent}
          onSelectCountry={handleCountryClick}
          onBackToContinents={() => setViewMode('Continents')}
        />
      )}

      {viewMode === 'States' && (
        <StatesPage
          nfts={nfts}
          selectedCountry={selectedCountry}
          onSelectState={handleStateClick}
          onBackToCountries={() => setViewMode('Countries')}
        />
      )}

      {viewMode === 'Districts' && (
        <DistrictsPage
          nfts={nfts}
          selectedState={selectedState}
          onBackToStates={() => setViewMode('States')}
        />
      )}

      {viewMode === 'Franchise' && (
        <FranchiseDashboard
          onNftMinted={handleNftMinted}
        />
      )}
    </div>
  );
};

export default LegionApp;

