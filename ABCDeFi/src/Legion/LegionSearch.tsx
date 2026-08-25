import React, { useState } from 'react';
import { Search, Globe, Flag, Landmark, MapPin, Layers, X, ArrowRight } from 'lucide-react';
import { LegionNFTMetadata, NFTLevel, NFTLevelIcons, NFTLevelNames } from '../Services/legionNFT';

import Web3ActionModal from '../components/Web3ActionModal';

interface LegionSearchProps {
  nfts: LegionNFTMetadata[];
  onSelectNft: (nft: LegionNFTMetadata) => void;
}

export const LegionSearch: React.FC<LegionSearchProps> = ({ nfts, onSelectNft }) => {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<NFTLevel | 'All'>('All');

  // Web3 Action Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    contractName: string;
    methodName: string;
    amountLabel: string;
    amountValue: string;
    params: { label: string; value: string }[];
    icon: string;
    onExecute: () => Promise<void> | void;
    onSuccessMutation: () => void;
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    contractName: '',
    methodName: '',
    amountLabel: '',
    amountValue: '',
    params: [],
    icon: '📜',
    onExecute: () => {},
    onSuccessMutation: () => {},
  });

  const triggerMintTerritoryNFT = (item: LegionNFTMetadata) => {
    const feeAmount = item.level === 0 ? '2.50 ETH' : item.level === 1 ? '1.50 ETH' : item.level === 2 ? '0.75 ETH' : '0.25 ETH';
    setModalState({
      isOpen: true,
      title: `Mint ${item.name} Territory Franchise NFT`,
      subtitle: `Protocol Smart Contract Invocation for ${NFTLevelNames[item.level]} #${item.nftId}`,
      contractName: 'LegionNFTRegistry',
      methodName: 'mintTerritoryNFT',
      amountLabel: 'License Mint Fee',
      amountValue: feeAmount,
      params: [
        { label: 'Territory Name', value: item.name },
        { label: 'Territory Level', value: `${NFTLevelNames[item.level]} (Level ${item.level})` },
        { label: 'Population Reach', value: item.population ? `${(item.population / 1000000).toFixed(1)}M Citizens` : 'Global' },
        { label: 'Fee Revenue Share', value: `${(item.treasuryShareBps / 100).toFixed(2)}% (${item.treasuryShareBps} bps)` },
        { label: 'Character Guardian', value: item.character || 'Sovereign Warden' },
      ],
      icon: NFTLevelIcons[item.level] || '📜',
      onExecute: async () => {
        await new Promise((r) => setTimeout(r, 600));
      },
      onSuccessMutation: () => {},
    });
  };

  const searchResults = nfts.filter((nft) => {
    const matchesLevel = levelFilter === 'All' || nft.level === levelFilter;
    const matchesQuery =
      query === '' ||
      nft.name.toLowerCase().includes(query.toLowerCase()) ||
      nft.territory.toLowerCase().includes(query.toLowerCase()) ||
      nft.character.toLowerCase().includes(query.toLowerCase());
    return matchesLevel && matchesQuery;
  });

  // Level Counts
  const continentCount = nfts.filter((n) => n.level === NFTLevel.Continent).length;
  const countryCount = nfts.filter((n) => n.level === NFTLevel.Country).length;
  const stateCount = nfts.filter((n) => n.level === NFTLevel.State).length;
  const districtCount = nfts.filter((n) => n.level === NFTLevel.District).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl font-mono">
      {/* SEARCH HEADER & LEVEL FILTER TABS */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* INPUT */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Continent, Country, State (e.g. Tamil Nadu), District..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-3 text-slate-500 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* FILTER CATEGORY BUTTONS */}
        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar text-xs">
          <button
            onClick={() => setLevelFilter('All')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              levelFilter === 'All'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All ({nfts.length})
          </button>

          <button
            onClick={() => setLevelFilter(NFTLevel.Continent)}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
              levelFilter === NFTLevel.Continent
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <span>🌍</span> Continent ({continentCount})
          </button>

          <button
            onClick={() => setLevelFilter(NFTLevel.Country)}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
              levelFilter === NFTLevel.Country
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <span>🏳️</span> Country ({countryCount})
          </button>

          <button
            onClick={() => setLevelFilter(NFTLevel.State)}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
              levelFilter === NFTLevel.State
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <span>🏛️</span> State ({stateCount})
          </button>

          <button
            onClick={() => setLevelFilter(NFTLevel.District)}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
              levelFilter === NFTLevel.District
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <span>📍</span> District ({districtCount})
          </button>
        </div>
      </div>

      {/* SEARCH RESULTS FEED */}
      {query && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between">
            <span>Search Results ({searchResults.length})</span>
            <span className="text-amber-400">Query: "{query}"</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1 no-scrollbar">
            {searchResults.map((item) => (
              <div
                key={item.nftId}
                className="bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-2xl p-4 space-y-2.5 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{NFTLevelIcons[item.level]}</span>
                      <div>
                        <div className="font-bold text-white text-sm">{item.name}</div>
                        <div className="text-[10px] text-amber-400 font-mono">
                          {NFTLevelNames[item.level]} #{item.nftId}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                      {item.character || 'Guardian'}
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-900 text-xs space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Population:</span>
                      <span className="text-white font-bold">{item.population ? `${(item.population / 1000000).toFixed(1)}M Citizens` : 'Global'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Revenue Share:</span>
                      <span className="text-emerald-400 font-bold">{(item.treasuryShareBps / 100).toFixed(2)}% ({item.treasuryShareBps} bps)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Owner:</span>
                      <span className="text-slate-300 font-mono text-[10px]">{item.owner ? `${item.owner.substring(0, 8)}...` : 'Unclaimed'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-900">
                  <button
                    onClick={() => onSelectNft(item)}
                    className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-slate-800"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => triggerMintTerritoryNFT(item)}
                    className="flex-1 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-md shadow-amber-500/20"
                  >
                    <span>Mint License 📜</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WEB3 ACTION MODAL */}
      <Web3ActionModal
        {...modalState}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default LegionSearch;
