// ==========================================
// Step 16: Guru NFT — NFT Ecosystem Service
// ==========================================

export interface GuruNFT {
  tokenId: string;
  owner: string;
  name: string;
  title: string;
  rank: 'Apprentice Guru' | 'Rising Guru' | 'Master Guru' | 'Grand Guru' | 'Legend Guru';
  xp: number;
  xpToNext: number;
  specialties: string[];
  mentees: number;
  lessonsCreated: number;
  totalEarnings: string;
  mintedAt: string;
  image: string;
  perks: string[];
  isOwned: boolean;
}

export interface GuruRank {
  rank: GuruNFT['rank'];
  minXP: number;
  icon: string;
  color: string;
  ltv: string;
  stakingBonus: string;
  feeDiscount: string;
  menteeLimit: number;
}

export const GURU_RANKS: GuruRank[] = [
  {
    rank: 'Apprentice Guru',
    minXP: 0,
    icon: '🌱',
    color: 'from-slate-700/40 to-slate-900/40 border-slate-600/40',
    ltv: '60%',
    stakingBonus: '+1% APY',
    feeDiscount: '5%',
    menteeLimit: 5,
  },
  {
    rank: 'Rising Guru',
    minXP: 500,
    icon: '⚡',
    color: 'from-blue-700/30 to-blue-900/30 border-blue-500/40',
    ltv: '70%',
    stakingBonus: '+2% APY',
    feeDiscount: '10%',
    menteeLimit: 15,
  },
  {
    rank: 'Master Guru',
    minXP: 2000,
    icon: '🔥',
    color: 'from-purple-700/30 to-purple-900/30 border-purple-500/40',
    ltv: '78%',
    stakingBonus: '+4% APY',
    feeDiscount: '20%',
    menteeLimit: 50,
  },
  {
    rank: 'Grand Guru',
    minXP: 5000,
    icon: '👑',
    color: 'from-amber-700/30 to-yellow-900/30 border-amber-500/50',
    ltv: '82%',
    stakingBonus: '+6% APY',
    feeDiscount: '35%',
    menteeLimit: 100,
  },
  {
    rank: 'Legend Guru',
    minXP: 10000,
    icon: '💎',
    color: 'from-cyan-600/30 to-indigo-900/30 border-cyan-400/50',
    ltv: '90%',
    stakingBonus: '+10% APY',
    feeDiscount: '100%',
    menteeLimit: 9999,
  },
];

export const SAMPLE_GURU_NFTS: GuruNFT[] = [
  {
    tokenId: '#GURU-0001',
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    name: 'CryptoSage Alex',
    title: 'DeFi Strategy Master',
    rank: 'Master Guru',
    xp: 3420,
    xpToNext: 5000,
    specialties: ['Staking', 'Yield Farming', 'Collateral Management'],
    mentees: 34,
    lessonsCreated: 12,
    totalEarnings: '4,500 ABCD',
    mintedAt: 'May 15, 2026',
    image: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=300',
    perks: ['78% Max LTV', '+4% Staking APY Bonus', '20% Fee Discount', 'Mentor Dashboard', 'Priority Support'],
    isOwned: true,
  },
  {
    tokenId: '#GURU-0042',
    owner: '0x3C44CdD46a9380a46014605930064d7879e96f13',
    name: 'BlockchainBob',
    title: 'Lending Protocol Specialist',
    rank: 'Grand Guru',
    xp: 7200,
    xpToNext: 10000,
    specialties: ['Lending', 'Borrowing', 'Risk Management'],
    mentees: 89,
    lessonsCreated: 28,
    totalEarnings: '18,900 ABCD',
    mintedAt: 'Mar 2, 2026',
    image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300',
    perks: ['82% Max LTV', '+6% Staking APY Bonus', '35% Fee Discount', 'Revenue Sharing', 'VIP Pool Access'],
    isOwned: false,
  },
  {
    tokenId: '#GURU-0007',
    owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    name: 'NFT Empress',
    title: 'NFT Ecosystem Architect',
    rank: 'Legend Guru',
    xp: 12800,
    xpToNext: 99999,
    specialties: ['NFT Design', 'Tokenomics', 'Smart Contract Auditing'],
    mentees: 210,
    lessonsCreated: 47,
    totalEarnings: '86,400 ABCD',
    mintedAt: 'Jan 10, 2026',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300',
    perks: ['90% Max LTV', '+10% Staking APY Bonus', '100% Zero Fee VIP', 'Governance Voting', 'Revenue 15% Share'],
    isOwned: false,
  },
];

export async function mintGuruNFT(walletAddress: string): Promise<GuruNFT> {
  await new Promise((r) => setTimeout(r, 700));
  return {
    ...SAMPLE_GURU_NFTS[0],
    tokenId: `#GURU-${Math.floor(Math.random() * 9000 + 1000)}`,
    owner: walletAddress,
    mintedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    isOwned: true,
  };
}

export function getGuruRank(xp: number): GuruRank {
  return [...GURU_RANKS].reverse().find((r) => xp >= r.minXP) ?? GURU_RANKS[0];
}
