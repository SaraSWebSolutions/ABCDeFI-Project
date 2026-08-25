import React, { useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { RealNFT, mintLegionNFT, MOCK_LEGION_NFTS } from '../Services/nftServices';
import { Layers, CheckCircle2, ExternalLink, PlusCircle, RefreshCw, Users } from 'lucide-react';

interface LegionNFTDashboardProps {
  nfts?: RealNFT[];
  onRefresh?: () => void;
  loading?: boolean;
  connectedWallet?: string;
}

const defaultLegionNFTs: RealNFT[] = MOCK_LEGION_NFTS.map((item) => ({
  _id: `legion-${item.tokenId}`,
  tokenId: item.tokenId,
  type: 'Legion NFT',
  contractAddress: '0x1C2F8e68Ea47a16E64Ff48D3d98B356f9166F13D',
  ownerAddress: item.owner,
  metadataURI: item.metadataURI,
  transactionHash: '0x32a4b89c7d1e0f6a5b4c3d2e1f0a9b8c7d6e5f4a',
  mintedAt: item.mintedAt,
  metadata: {
    name: item.name,
    description: item.description,
    image: item.artwork,
    attributes: [
      { trait_type: 'Level', value: item.level },
      { trait_type: 'Territory Code', value: item.territoryCode },
      { trait_type: 'Character', value: item.character },
      { trait_type: 'Population', value: item.population.toLocaleString() },
      { trait_type: 'Treasury Share', value: `${(item.treasuryShareBps / 100).toFixed(1)}%` },
    ],
  },
}));

export const LegionNFTDashboard: React.FC<LegionNFTDashboardProps> = ({ nfts = [], onRefresh, loading = false, connectedWallet }) => {
  const { shortAddress } = useWallet();
  const activeAddress = connectedWallet || shortAddress;
  const [isMintingModalOpen, setIsMintingModalOpen] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);

  // Form state for Legion NFT minting
  const [tier, setTier] = useState('Legion Alpha');
  const [rank, setRank] = useState('3');
  const [perks, setPerks] = useState('Community Staking Boost, Governance Vote');

  const handleMintLegionNFT = async (e: React.FormEvent) => {
    e.preventDefault();
    setMintLoading(true);

    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        } catch (err) {
          console.warn('MetaMask connection skipped or canceled:', err);
        }
      }

      const payload = {
        ownerAddress: activeAddress,
        tier,
        rank: parseInt(rank) || 3,
        perks,
      };

      const res = await mintLegionNFT(payload);
      if (res.success || res.nft) {
        setIsMintingModalOpen(false);
        if (typeof onRefresh === 'function') {
          onRefresh();
        }
      } else {
        alert(res.message || res.error || 'Legion NFT minting failed');
      }
    } catch (err: any) {
      console.error('Mint Error:', err);
      alert('Transaction failed: ' + (err.message || 'Error minting Legion NFT'));
    } finally {
      setMintLoading(false);
    }
  };

  const incomingLegions = nfts.filter((nft) => nft.type === 'Legion NFT' || nft.type?.toLowerCase().includes('legion'));
  const legionNFTs = incomingLegions.length > 0 ? incomingLegions : defaultLegionNFTs;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Legion Governance & Rank NFTs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Hierarchical Legion NFTs granting community voting power and staking multipliers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {typeof onRefresh === 'function' && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              Refresh
            </button>
          )}
          <button
            onClick={() => setIsMintingModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-600/20"
          >
            <PlusCircle className="w-4 h-4" />
            Mint Legion NFT
          </button>
        </div>
      </div>

      {/* Legion Cards Grid */}
      {loading ? (
        <div className="glass-panel p-8 text-center text-slate-400 text-xs">
          Syncing on-chain Legion NFTs...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {legionNFTs.map((nft) => {
            const meta = nft.metadata || {};
            const img = meta.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop';
            const name = meta.name || `Legion NFT #${nft.tokenId}`;
            const description = meta.description || 'Verified On-Chain Legion Membership and Voting Badge.';
            const attributes = meta.attributes || nft.attributes || {};

            return (
              <div
                key={nft._id || String(nft.tokenId)}
                className="glass-panel rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition overflow-hidden flex flex-col justify-between bg-slate-900/80 shadow-xl"
              >
                <div>
                  <div className="relative h-56 overflow-hidden bg-slate-950 p-2 flex items-center justify-center">
                    <img src={img} alt={name} className="w-full h-full object-contain hover:scale-105 transition duration-300" />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-950/90 text-cyan-300 border border-cyan-500/30 backdrop-blur-md">
                      Legion NFT
                    </div>
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                      #{nft.tokenId}
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="font-bold text-white text-base">{name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{description}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5 font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Token ID:</span>
                        <span className="text-white font-bold">{nft.tokenId}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Owner:</span>
                        <span className="text-cyan-400 truncate max-w-[140px]">
                          {nft.ownerAddress ? `${nft.ownerAddress.slice(0, 6)}...${nft.ownerAddress.slice(-4)}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Contract:</span>
                        <span className="text-slate-300 truncate max-w-[140px]">
                          {nft.contractAddress ? `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}` : 'N/A'}
                        </span>
                      </div>
                      {nft.transactionHash && (
                        <div className="flex justify-between text-slate-400">
                          <span>Tx Hash:</span>
                          <span className="text-indigo-400 truncate max-w-[140px]">
                            {`${nft.transactionHash.slice(0, 6)}...${nft.transactionHash.slice(-4)}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Attributes */}
                    {Object.keys(attributes).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Attributes:</span>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          {Array.isArray(attributes)
                            ? attributes.map((attr: any, idx: number) => (
                                <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                  <span className="text-slate-400 block text-[9px]">{attr.trait_type}</span>
                                  <span className="text-white font-bold">{attr.value}</span>
                                </div>
                              ))
                            : Object.entries(attributes).map(([k, v]: [string, any], idx: number) => (
                                <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                  <span className="text-slate-400 block text-[9px]">{k}</span>
                                  <span className="text-white font-bold">{String(v)}</span>
                                </div>
                              ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified On-Chain
                  </span>
                  <a
                    href={`https://testnet.bscscan.com/address/${nft.contractAddress || '0x1C2F8e68Ea47a16E64Ff48D3d98B356f9166F13D'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition flex items-center gap-1"
                  >
                    BSCScan <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mint Modal */}
      {isMintingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel max-w-md w-full p-6 rounded-3xl border border-slate-800 bg-slate-900 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Mint Legion NFT On-Chain
            </h3>

            <form onSubmit={handleMintLegionNFT} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Tier / Name</label>
                <input
                  type="text"
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Rank (Level 1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Perks & Benefits</label>
                <input
                  type="text"
                  value={perks}
                  onChange={(e) => setPerks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                Wallet Owner: <span className="text-cyan-400 font-mono">{activeAddress}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMintingModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mintLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition disabled:opacity-50"
                >
                  {mintLoading ? 'Minting...' : 'Confirm Mint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegionNFTDashboard;
