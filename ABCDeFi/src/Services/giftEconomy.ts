// ============================================================================
// Gift Economy & Appreciating Gift NFTs (Whitepaper Engine)
// Categories: Gifts, Festivals, Weddings, Donations
// Features time-locked yield appreciation over time.
// ============================================================================

export type GiftCategory = 'Gift' | 'Festival' | 'Wedding' | 'Donation';

export interface AppreciatingGiftRecord {
  tokenId: string;
  creator: string;
  recipient: string;
  category: GiftCategory;
  title: string;
  lockedETH: number;
  initialValueUSD: number;
  currentAppreciatedValueUSD: number;
  annualAppreciationRatePct: number; // e.g. 8.5%
  creationDate: string;
  unlockDate: string;
  redeemed: boolean;
}

export const RECENT_GIFT_NFTS: AppreciatingGiftRecord[] = [
  {
    tokenId: '#GIFT-1001',
    creator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    recipient: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    category: 'Wedding',
    title: 'Royal Wedding Endowment Lock',
    lockedETH: 2.5,
    initialValueUSD: 6250,
    currentAppreciatedValueUSD: 6780, // +8.48% Yield Appreciation
    annualAppreciationRatePct: 8.5,
    creationDate: '2026-01-15',
    unlockDate: '2027-01-15',
    redeemed: false,
  },
  {
    tokenId: '#GIFT-1002',
    creator: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    category: 'Festival',
    title: 'Diwali Prosperity Gift NFT',
    lockedETH: 1.0,
    initialValueUSD: 2500,
    currentAppreciatedValueUSD: 2680,
    annualAppreciationRatePct: 7.2,
    creationDate: '2025-11-01',
    unlockDate: '2026-11-01',
    redeemed: false,
  },
  {
    tokenId: '#GIFT-1003',
    creator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    recipient: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    category: 'Donation',
    title: 'Financial Literacy Philanthropic Trust',
    lockedETH: 5.0,
    initialValueUSD: 12500,
    currentAppreciatedValueUSD: 13625,
    annualAppreciationRatePct: 9.0,
    creationDate: '2025-06-20',
    unlockDate: '2026-06-20',
    redeemed: true,
  },
];

/**
 * Mint Appreciating Gift NFT
 */
export async function createGiftNFT(
  recipient: string,
  category: GiftCategory,
  title: string,
  lockedETH: number
): Promise<AppreciatingGiftRecord> {
  const initialValueUSD = lockedETH * 2500; // $2,500/ETH
  const newGift: AppreciatingGiftRecord = {
    tokenId: `#GIFT-${Math.floor(Math.random() * 9000 + 1000)}`,
    creator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    recipient,
    category,
    title,
    lockedETH,
    initialValueUSD,
    currentAppreciatedValueUSD: initialValueUSD,
    annualAppreciationRatePct: 8.5,
    creationDate: new Date().toLocaleDateString(),
    unlockDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    redeemed: false,
  };

  RECENT_GIFT_NFTS.unshift(newGift);
  return newGift;
}
