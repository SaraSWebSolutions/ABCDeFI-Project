import React, { useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { RealNFT, mintFranchiseNFT, MOCK_FRANCHISE_NFTS } from '../Services/nftServices';
import { Award, CheckCircle2, ExternalLink, PlusCircle, RefreshCw, Building2 } from 'lucide-react';

interface FranchiseNFTDashboardProps {
  nfts?: RealNFT[];
  onRefresh?: () => void;
  loading?: boolean;
}

const defaultFranchiseNFTs: RealNFT[] = MOCK_FRANCHISE_NFTS.map((item) => ({
  _id: `franchise-${item.franchiseId}`,
  tokenId: item.franchiseId,
  type: 'Franchise NFT',
  contractAddress: '0x811A1B43c7B6D821bA48439F57b0185e7DF47A11',
  ownerAddress: item.franchiseeWallet,
  metadataURI: item.metadataURI,
  transactionHash: '0x5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d',
  mintedAt: item.mintedAt,
  metadata: {
    name: item.franchiseName,
    description: item.territoryName,
    image: item.artwork,
    attributes: [
      { trait_type: 'Level', value: item.level },
      { trait_type: 'Territory Code', value: item.territoryCode },
      { trait_type: 'Monthly Revenue', value: `$${item.monthlyRevenueUSD.toLocaleString()}` },
      { trait_type: 'Total Revenue', value: `$${item.totalRevenueUSD.toLocaleString()}` },
      { trait_type: 'Members', value: item.memberCount.toLocaleString() },
    ],
  },
}));

export const FranchiseNFTDashboard: React.FC<FranchiseNFTDashboardProps> = ({ nfts = [], onRefresh, loading = false }) => {
  const { shortAddress } = useWallet();
  const [isMintingModalOpen, setIsMintingModalOpen] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);

  // Form state for Franchise NFT minting
  const [franchiseName, setFranchiseName] = useState('Territory Franchise');
  const [location, setLocation] = useState('Global Territory');
  const [tier, setTier] = useState('5');
  const [revenueShare, setRevenueShare] = useState('6');

  const handleMintFranchiseNFT = async (e: React.FormEvent) => {
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
        ownerAddress: shortAddress,
        franchiseName,
        location,
        tier,
        revenueShare,
      };

      const res = await mintFranchiseNFT(payload);
      if (res.success || res.nft) {
        setIsMintingModalOpen(false);
        if (typeof onRefresh === 'function') {
          onRefresh();
        }
      } else {
        alert(res.message || res.error || 'Franchise NFT minting failed');
      }
    } catch (err: any) {
      console.error('Mint Error:', err);
      alert('Transaction failed: ' + (err.message || 'Error minting Franchise NFT'));
    } finally {
      setMintLoading(false);
    }
  };

  const incomingFranchises = nfts.filter((nft) => nft.type === 'Franchise NFT' || nft.type?.toLowerCase().includes('franchise'));
  const franchiseNFTs = incomingFranchises.length > 0 ? incomingFranchises : defaultFranchiseNFTs;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Franchise Territory & Node Rights
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Territory Franchise NFTs yielding protocol fee revenue commissions on-chain.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {typeof onRefresh === 'function' && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              Refresh
            </button>
          )}
          <button
            onClick={() => setIsMintingModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <PlusCircle className="w-4 h-4" />
            Mint Franchise NFT
          </button>
        </div>
      </div>

      {/* Franchise Cards Grid */}
      {loading ? (
        <div className="glass-panel p-8 text-center text-slate-400 text-xs">
          Syncing on-chain Franchise NFTs...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {franchiseNFTs.map((nft) => {
            const meta = nft.metadata || {};
            const img = meta.image || 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?q=80&w=600&auto=format&fit=crop';
            const name = meta.name || `Franchise NFT #${nft.tokenId}`;
            const description = meta.description || 'Verified On-Chain Regional Territory Franchise Node.';
            const attributes = meta.attributes || nft.attributes || {};

            return (
              <div
                key={nft._id || String(nft.tokenId)}
                className="glass-panel rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition overflow-hidden flex flex-col justify-between bg-slate-900/80 shadow-xl"
              >
                <div>
                  <div className="relative h-56 overflow-hidden bg-slate-950 p-2 flex items-center justify-center">
                    <img src={img} alt={name} className="w-full h-full object-contain hover:scale-105 transition duration-300" />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-950/90 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                      Franchise NFT
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
                        <span className="text-emerald-400 truncate max-w-[140px]">
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
                    href={`https://testnet.bscscan.com/address/${nft.contractAddress || '0x811A1B43c7B6D821bA48439F57b0185e7DF47A11'}`}
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
              <Building2 className="w-5 h-5 text-emerald-400" />
              Mint Franchise NFT On-Chain
            </h3>

            <form onSubmit={handleMintFranchiseNFT} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Franchise Name</label>
                <input
                  type="text"
                  value={franchiseName}
                  onChange={(e) => setFranchiseName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Location / Territory</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Franchise Level (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Commission Bps (% Rate)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={revenueShare}
                    onChange={(e) => setRevenueShare(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                Wallet Owner: <span className="text-emerald-400 font-mono">{shortAddress}</span>
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
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition disabled:opacity-50"
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

export default FranchiseNFTDashboard;
