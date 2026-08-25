import React, { useState } from 'react';
import {
  Globe,
  MapPin,
  Building2,
  Landmark,
  Shield,
  Layers,
  ChevronRight,
  Plus,
  Users,
  Award,
  Sparkles,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  NFTLevel,
  NFTLevelNames,
  NFTLevelIcons,
  MOCK_LEGION_NFTS,
  LegionNFTMetadata,
  slugify,
} from '../Services/legionNFT';

export const LegionNFTExplorer: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState<NFTLevel | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [nfts, setNfts] = useState<LegionNFTMetadata[]>(MOCK_LEGION_NFTS);
  const [activeNft, setActiveNft] = useState<LegionNFTMetadata>(MOCK_LEGION_NFTS[7]); // Default to India / Afghanistan
  const [isMintModalOpen, setIsMintModalOpen] = useState(false);

  // Mint Form State
  const [mintForm, setMintForm] = useState({
    name: '',
    territory: '',
    level: NFTLevel.District,
    parentId: 201, // Telangana State
    character: 'District Knight',
    population: 1000000,
    treasuryShareBps: 50,
  });

  const filteredNfts = nfts.filter((n) => {
    const matchesLevel = selectedLevel === 'All' || n.level === selectedLevel;
    const matchesSearch = searchQuery === '' ||
      n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.territory.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const getParentName = (parentId: number) => {
    if (parentId === 0) return 'None (Top Level Continent)';
    const parent = nfts.find((n) => n.nftId === parentId);
    return parent ? `${parent.name} (#${parent.nftId})` : `Parent #${parentId}`;
  };

  const getChildren = (nftId: number) => nfts.filter((n) => n.parentId === nftId);

  const getArtworkPath = (nft: LegionNFTMetadata) => {
    // Map territory names/codes to our public SVG assets
    const nameLC = nft.name.toLowerCase();
    if (nameLC.includes('world')) return '/nft-assets/world.svg';
    if (nameLC.includes('asia') || nameLC.includes('china') || nameLC.includes('japan') || nameLC.includes('korea') || nameLC.includes('vietnam') || nameLC.includes('indonesia') || nameLC.includes('malaysia')) return '/nft-assets/asia.svg';
    if (nameLC.includes('europe') || nameLC.includes('germany') || nameLC.includes('france') || nameLC.includes('spain') || nameLC.includes('italy') || nameLC.includes('uk') || nameLC.includes('britain') || nameLC.includes('united kingdom') || nameLC.includes('netherlands')) return '/nft-assets/europe.svg';
    if (nameLC.includes('america') || nameLC.includes('united states') || nameLC.includes('canada') || nameLC.includes('mexico') || nameLC.includes('brazil') || nameLC.includes('argentina')) return '/nft-assets/americas.svg';
    if (nameLC.includes('africa') || nameLC.includes('nigeria') || nameLC.includes('kenya') || nameLC.includes('egypt') || nameLC.includes('ghana') || nameLC.includes('south africa')) return '/nft-assets/africa.svg';
    if (nameLC.includes('india') || nameLC.includes('maharashtra') || nameLC.includes('gujarat') || nameLC.includes('karnataka') || nameLC.includes('tamil') || nameLC.includes('andhra')) return '/nft-assets/india.svg';
    if (nameLC.includes('telangana') || nameLC.includes('warangal') || nameLC.includes('nizamabad')) return '/nft-assets/telangana.svg';
    if (nameLC.includes('hyderabad') || nameLC.includes('secunderabad') || nameLC.includes('rangareddy')) return '/nft-assets/hyderabad.svg';
    // Fallback by level
    if (nft.level === NFTLevel.Continent) return '/nft-assets/asia.svg';
    if (nft.level === NFTLevel.Country) return '/nft-assets/india.svg';
    if (nft.level === NFTLevel.State) return '/nft-assets/telangana.svg';
    return '/nft-assets/hyderabad.svg';
  };

  const handleMintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newNft: LegionNFTMetadata = {
      nftId: nfts.length + 1,
      name: mintForm.name,
      territory: mintForm.territory || `${mintForm.name} Territory`,
      level: mintForm.level,
      parentId: mintForm.parentId,
      character: mintForm.character,
      metadataURI: `https://api.abcdefi.com/nft/${slugify(mintForm.name)}.json`,
      population: Number(mintForm.population),
      treasuryShareBps: Number(mintForm.treasuryShareBps),
      createdAt: new Date().toISOString().split('T')[0],
      owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      imageSlug: slugify(mintForm.name),
    };

    setNfts([newNft, ...nfts]);
    setActiveNft(newNft);
    setIsMintModalOpen(false);
  };

  return (
    <div id="legion-nft-explorer" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>Legion Protocol</span>
            <span className="text-slate-600">↓</span>
            <span>Continents · Countries · States · Districts</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Globe className="w-5 h-5 text-amber-400" />
            Legion NFT Territory Ecosystem
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            193+ UN Countries, States (Telangana, Andhra Pradesh, Tamil Nadu), and Districts (Hyderabad, Warangal, Nizamabad).
          </p>
        </div>

        <button
          onClick={() => setIsMintModalOpen(true)}
          className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black px-4 py-2.5 rounded-2xl text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Mint Legion NFT
        </button>
      </div>

      {/* SAMPLE HIERARCHY CHAIN DEMO (Asia -> India -> Telangana -> Hyderabad) */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" /> Multi-Tier Lineage Sample
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { name: 'Asia', level: 'Continent', icon: '🌍', file: 'continents/asia.png' },
            { name: 'India', level: 'Country', icon: '🏳️', file: 'countries/india.png' },
            { name: 'Telangana', level: 'State', icon: '🏛️', file: 'states/telangana.png' },
            { name: 'Hyderabad', level: 'District', icon: '📍', file: 'districts/hyderabad.png' },
          ].map((item, idx) => (
            <React.Fragment key={item.name}>
              <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-2xl flex items-center gap-2 shrink-0">
                <span className="text-base">{item.icon}</span>
                <div>
                  <div className="font-bold text-white text-xs">{item.name}</div>
                  <div className="text-[9px] text-amber-400">{item.file}</div>
                </div>
              </div>
              {idx < 3 && <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* CONTROLS: SEARCH & LEVEL FILTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800 pb-4">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search country, state, district..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Level Tabs */}
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar text-xs">
          <button
            onClick={() => setSelectedLevel('All')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              selectedLevel === 'All'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All ({nfts.length})
          </button>

          {[NFTLevel.Continent, NFTLevel.Country, NFTLevel.State, NFTLevel.District].map((lvl) => {
            const count = nfts.filter((n) => n.level === lvl).length;
            const isSel = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  isSel
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <span>{NFTLevelIcons[lvl]}</span>
                <span>{NFTLevelNames[lvl]} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN VIEW: INSPECTOR + CATALOG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* INSPECTOR */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase">Selected NFT Inspector</span>
            <span className="text-xs font-black text-amber-400">#{activeNft.nftId}</span>
          </div>

          {/* ARTWORK CARD DISPLAY WITH FALLBACK TO DESIGN CANVAS */}
          <div className="w-full aspect-square bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center">
            {/* Try loading image */}
            <img
              src={getArtworkPath(activeNft)}
              alt={activeNft.name}
              onError={(e) => {
                // If image fails to load, render high-res fallback card
                (e.target as HTMLElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  const fallback = parent.querySelector('.fallback-card') as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }
              }}
              className="w-full h-full object-contain"
            />

            {/* Fallback Artwork Card matching ABCDeFi Skater Astronaut design */}
            <div className="fallback-card absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 p-5 flex flex-col items-center justify-between text-center hidden">
              <div className="text-[11px] font-black text-amber-400 tracking-wider">ABCDeFi PLATFORM</div>
              <div className="space-y-1">
                <div className="text-3xl">{NFTLevelIcons[activeNft.level]}</div>
                <h3 className="text-xl font-black text-white">{activeNft.name}</h3>
                <div className="text-[10px] text-amber-300 uppercase font-bold tracking-widest">{activeNft.territory}</div>
              </div>
              <div className="text-[10px] text-indigo-300 italic font-bold">Finance for everyone</div>
            </div>
          </div>

          {/* METADATA & HIERARCHY BREAKDOWN (PHASE 6) */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-500">Artwork Path:</span>
              <span className="font-bold text-amber-300 truncate max-w-[180px]">{getArtworkPath(activeNft)}</span>
            </div>

            <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-500">Level:</span>
              <span className="font-bold text-white flex items-center gap-1">
                {NFTLevelIcons[activeNft.level]} {NFTLevelNames[activeNft.level]}
              </span>
            </div>

            {/* PHASE 6: PARENT */}
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-500">Parent NFT</div>
              <div className="font-bold text-slate-200">
                {activeNft.parentId === 0 ? 'None (Top Level Continent)' : getParentName(activeNft.parentId)}
              </div>
            </div>

            {/* PHASE 6: CHILDREN */}
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
                <span>Children NFTs</span>
                <span className="text-amber-400 font-extrabold">{getChildren(activeNft.nftId).length}</span>
              </div>
              {getChildren(activeNft.nftId).length === 0 ? (
                <div className="text-[11px] text-slate-500 italic">None (Terminal Level)</div>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar">
                  {getChildren(activeNft.nftId).slice(0, 15).map((child) => (
                    <span
                      key={child.nftId}
                      onClick={() => setActiveNft(child)}
                      className="bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 hover:text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition"
                    >
                      {child.name} (#{child.nftId})
                    </span>
                  ))}
                  {getChildren(activeNft.nftId).length > 15 && (
                    <span className="text-[10px] text-slate-500 py-0.5">
                      +{getChildren(activeNft.nftId).length - 15} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-500">Character Role:</span>
              <span className="font-bold text-cyan-300">{activeNft.character}</span>
            </div>

            <div className="flex justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-500">Treasury Share:</span>
              <span className="font-bold text-emerald-400">{(activeNft.treasuryShareBps / 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* NFT CATALOG GRID */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Territory Catalog ({filteredNfts.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
            {filteredNfts.map((nft) => {
              const isSelected = activeNft.nftId === nft.nftId;
              return (
                <div
                  key={nft.nftId}
                  onClick={() => setActiveNft(nft)}
                  className={`bg-slate-950 border rounded-2xl p-3.5 space-y-2 cursor-pointer transition hover:scale-[1.02] ${
                    isSelected ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-500/5' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{NFTLevelIcons[nft.level]}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                      #{nft.nftId}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white truncate">{nft.name}</h4>
                    <div className="text-[10px] text-slate-400 truncate">{NFTLevelNames[nft.level]}</div>
                  </div>

                  <div className="text-[9px] text-slate-500 truncate">
                    Path: {getArtworkPath(nft)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MINT MODAL */}
      {isMintModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" /> Mint New Territory NFT
              </h3>
              <button onClick={() => setIsMintModalOpen(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleMintSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={mintForm.name}
                  onChange={(e) => setMintForm({ ...mintForm, name: e.target.value })}
                  placeholder="e.g. Telangana, Warangal, Nizamabad"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Hierarchy Level</label>
                  <select
                    value={mintForm.level}
                    onChange={(e) => setMintForm({ ...mintForm, level: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={NFTLevel.Continent}>Continent (continents/)</option>
                    <option value={NFTLevel.Country}>Country (countries/)</option>
                    <option value={NFTLevel.State}>State (states/)</option>
                    <option value={NFTLevel.District}>District (districts/)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Parent NFT ID</label>
                  <input
                    type="number"
                    value={mintForm.parentId}
                    onChange={(e) => setMintForm({ ...mintForm, parentId: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Character Designation</label>
                <input
                  type="text"
                  value={mintForm.character}
                  onChange={(e) => setMintForm({ ...mintForm, character: e.target.value })}
                  placeholder="e.g. District Knight"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsMintModalOpen(false)} className="text-slate-400 hover:text-white px-4 py-2 cursor-pointer">Cancel</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2 rounded-xl transition cursor-pointer">Mint NFT</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegionNFTExplorer;
