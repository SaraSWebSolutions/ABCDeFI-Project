// ============================================================================
// Barter Economy & RWA Barter NFTs (Whitepaper Engine)
// Asset Classes: Gold, Diamonds, Artwork, Property, Collectibles
// Enables peer-to-peer cashless asset swaps without traditional money.
// ============================================================================

export type RWAAssetClass = 'Gold' | 'Diamonds' | 'Artwork' | 'Property' | 'Collectibles';

export interface RWAAssetRecord {
  tokenId: string;
  owner: string;
  assetClass: RWAAssetClass;
  assetName: string;
  estimatedValueUSD: number;
  custodianVaultRegistry: string;
  icon: string;
  inEscrow: boolean;
}

export interface BarterSwapListing {
  listingId: string;
  offeredAsset: RWAAssetRecord;
  desiredAssetClass: RWAAssetClass;
  sellerAddress: string;
  status: 'Open' | 'Matched' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export const RWA_ASSETS_CATALOG: RWAAssetRecord[] = [
  {
    tokenId: '#RWA-GOLD-2001',
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    assetClass: 'Gold',
    assetName: '1kg 999.9 Fine Gold Bullion Bar (Brinks Zurich Vault)',
    estimatedValueUSD: 68500,
    custodianVaultRegistry: 'BRINKS-ZH-88910',
    icon: '🥇',
    inEscrow: false,
  },
  {
    tokenId: '#RWA-DIA-2002',
    owner: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    assetClass: 'Diamonds',
    assetName: '5.2 Carat Flawless D-Color Diamond (GIA Cert #44190)',
    estimatedValueUSD: 145000,
    custodianVaultRegistry: 'MALCA-AMIT-HK-551',
    icon: '💎',
    inEscrow: true,
  },
  {
    tokenId: '#RWA-ART-2003',
    owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    assetClass: 'Artwork',
    assetName: 'Original Masterpiece "Genesis of Ether" (1885 Oil Painting)',
    estimatedValueUSD: 220000,
    custodianVaultRegistry: 'SOTHEBYS-NY-0912',
    icon: '🎨',
    inEscrow: false,
  },
  {
    tokenId: '#RWA-PROP-2004',
    owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    assetClass: 'Property',
    assetName: 'Commercial Office Suite #402 (Financial District Dubai)',
    estimatedValueUSD: 450000,
    custodianVaultRegistry: 'DLD-DEED-99104',
    icon: '🏢',
    inEscrow: false,
  },
  {
    tokenId: '#RWA-COLL-2005',
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    assetClass: 'Collectibles',
    assetName: 'Patek Philippe Nautilus 5711/1A Rose Gold Watch',
    estimatedValueUSD: 110000,
    custodianVaultRegistry: 'CHUBB-GENEVA-7712',
    icon: '⌚',
    inEscrow: false,
  },
];

export const BARTER_SWAP_LISTINGS: BarterSwapListing[] = [
  {
    listingId: 'SWAP-5001',
    offeredAsset: RWA_ASSETS_CATALOG[1], // Diamonds
    desiredAssetClass: 'Property',
    sellerAddress: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    status: 'Open',
    createdAt: '2026-07-30 10:15:00',
  },
  {
    listingId: 'SWAP-5002',
    offeredAsset: RWA_ASSETS_CATALOG[0], // Gold
    desiredAssetClass: 'Collectibles',
    sellerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    status: 'Open',
    createdAt: '2026-07-29 15:30:00',
  },
];

/**
 * Execute Cashless Barter Swap
 */
export async function executeBarterSwap(listingId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  const listing = BARTER_SWAP_LISTINGS.find((l) => l.listingId === listingId);
  if (listing) {
    listing.status = 'Completed';
    listing.offeredAsset.inEscrow = false;
  }
}
