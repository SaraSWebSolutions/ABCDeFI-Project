import { Contract, formatEther, parseEther } from 'ethers';
import { CONTRACTS, requireContractAddress } from '../Config/contracts';
import { getProvider, getSigner } from './wallet';
import ParticipantArtifact from '../../artifacts/contracts/nft/ParticipantNFT.sol/ParticipantNFT.json';
import ReputationArtifact from '../../artifacts/contracts/nft/ReputationNFT.sol/ReputationNFT.json';
import GuruArtifact from '../../artifacts/contracts/nft/GuruNFT.sol/GuruNFT.json';
import LoanArtifact from '../../artifacts/contracts/nft/LoanNFT.sol/LoanNFT.json';
import MarketplaceArtifact from '../../artifacts/contracts/marketplace/NFTMarketplace.sol/NFTMarketplace.json';

export interface MarketplaceListing { listingId: string; nftAddress: string; tokenId: string; seller: string; priceEth: string; active: boolean; }
export interface ReputationSnapshot { tokenId: string; creditScore: string; totalLoansCount: string; totalDefaultsCount: string; metadataUri: string; }
export interface NftEcosystemSnapshot { participantBalance: string; reputation: ReputationSnapshot | null; guruBalance: string; loanBalance: string; activeListings: MarketplaceListing[]; marketplaceFeeBps: string; }
export type TransactionSubmitted = (hash: string, stage: string) => void;

const participantAddress = () => requireContractAddress('participantNFT');
const reputationAddress = () => requireContractAddress('reputationNFT');
const guruAddress = () => requireContractAddress('guruNFT');
const loanAddress = () => requireContractAddress('loanNFT');
const marketplaceAddress = () => requireContractAddress('marketplace');

function confirmed(receipt: { status?: number | null } | null, label: string) {
  if (!receipt || receipt.status !== 1) throw new Error(`${label} was reverted or not confirmed on-chain.`);
  return receipt;
}

interface ListingResult { listingId: bigint; nftAddress: string; tokenId: bigint; seller: string; price: bigint; active: boolean; }

function toListing(listing: ListingResult): MarketplaceListing {
  return { listingId: listing.listingId.toString(), nftAddress: listing.nftAddress, tokenId: listing.tokenId.toString(), seller: listing.seller, priceEth: formatEther(listing.price), active: Boolean(listing.active) };
}

export async function getNftEcosystemSnapshot(walletAddress: string): Promise<NftEcosystemSnapshot> {
  const provider = await getProvider();
  const participant = new Contract(participantAddress(), ParticipantArtifact.abi, provider);
  const reputation = new Contract(reputationAddress(), ReputationArtifact.abi, provider);
  const guru = new Contract(guruAddress(), GuruArtifact.abi, provider);
  const loan = new Contract(loanAddress(), LoanArtifact.abi, provider);
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, provider);
  const [participantBalance, reputationTokenId, guruBalance, loanBalance, listings, marketplaceFeeBps] = await Promise.all([
    participant.balanceOf(walletAddress), reputation.getUserTokenId(walletAddress), guru.balanceOf(walletAddress), loan.balanceOf(walletAddress), marketplace.getAllActiveListings(), marketplace.marketplaceFeeBps(),
  ]);
  let reputationSnapshot: ReputationSnapshot | null = null;
  if (reputationTokenId !== 0n) {
    const [details, metadataUri] = await Promise.all([reputation.getReputation(reputationTokenId), reputation.tokenURI(reputationTokenId)]);
    reputationSnapshot = { tokenId: reputationTokenId.toString(), creditScore: details.creditScore.toString(), totalLoansCount: details.totalLoansCount.toString(), totalDefaultsCount: details.totalDefaultsCount.toString(), metadataUri };
  }
  return { participantBalance: participantBalance.toString(), reputation: reputationSnapshot, guruBalance: guruBalance.toString(), loanBalance: loanBalance.toString(), activeListings: (listings as ListingResult[]).map(toListing), marketplaceFeeBps: marketplaceFeeBps.toString() };
}

export async function listParticipantNft(tokenIdInput: string, priceEth: string, onSubmitted?: TransactionSubmitted) {
  if (!/^\d+$/.test(tokenIdInput) || BigInt(tokenIdInput) === 0n) throw new Error('Enter a valid ParticipantNFT token ID.');
  if (!/^\d+(?:\.\d+)?$/.test(priceEth) || Number(priceEth) <= 0) throw new Error('Enter a positive ETH listing price.');
  const signer = await getSigner();
  const seller = await signer.getAddress();
  const participant = new Contract(participantAddress(), ParticipantArtifact.abi, signer);
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, signer);
  const tokenId = BigInt(tokenIdInput);
  if ((await participant.ownerOf(tokenId)).toLowerCase() !== seller.toLowerCase()) throw new Error('The connected wallet does not own this ParticipantNFT.');
  const approval = await participant.approve(marketplaceAddress(), tokenId);
  onSubmitted?.(approval.hash, 'ParticipantNFT approval');
  confirmed(await approval.wait(), 'ParticipantNFT approval');
  const listing = await marketplace.listNFT(participantAddress(), tokenId, parseEther(priceEth));
  onSubmitted?.(listing.hash, 'Marketplace listing');
  return confirmed(await listing.wait(), 'Marketplace listing');
}

export async function buyNftListing(listingIdInput: string, onSubmitted?: TransactionSubmitted) {
  if (!/^\d+$/.test(listingIdInput) || BigInt(listingIdInput) === 0n) throw new Error('Enter a valid marketplace listing ID.');
  const signer = await getSigner();
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, signer);
  const listing = await marketplace.getListing(BigInt(listingIdInput));
  if (!listing.active) throw new Error('This marketplace listing is not active.');
  const transaction = await marketplace.buyNFT(BigInt(listingIdInput), { value: listing.price });
  onSubmitted?.(transaction.hash, 'NFT purchase');
  return confirmed(await transaction.wait(), 'NFT purchase');
}

// Compatibility exports for the inactive governance portal. They are legacy
// display policy data, not inputs to the active on-chain NFT route above.
export interface FeeDiscountTier { tierName: string; minReputationScore: number; feeDiscountPercent: number; effectiveTradingFeeBps: number; badge: string; }
export const MARKETPLACE_FEE_TIERS: FeeDiscountTier[] = [
  { tierName: 'Standard User', minReputationScore: 300, feeDiscountPercent: 0, effectiveTradingFeeBps: 250, badge: 'Bronze' },
  { tierName: 'Silver Member', minReputationScore: 580, feeDiscountPercent: 15, effectiveTradingFeeBps: 212, badge: 'Silver' },
  { tierName: 'Gold Supporter', minReputationScore: 670, feeDiscountPercent: 50, effectiveTradingFeeBps: 125, badge: 'Gold' },
  { tierName: 'Platinum / Diamond VIP', minReputationScore: 800, feeDiscountPercent: 100, effectiveTradingFeeBps: 0, badge: 'VIP' },
];
export interface AirdropCampaign { id: string; title: string; description: string; rewardType: 'NFT' | 'Tokens' | 'Dual NFT + Token'; rewardAmount: string; snapshotDate: string; eligibilityCriteria: string; totalPoolAllocated: string; totalClaimed: string; status: 'Active' | 'Scheduled' | 'Ended'; icon: string; }
export const AIRDROP_CAMPAIGNS: AirdropCampaign[] = [
  { id: 'AIRDROP-GENESIS-01', title: 'Legion Genesis Founder NFT Drop', description: 'Legacy governance display content.', rewardType: 'Dual NFT + Token', rewardAmount: '1x Genesis Legion NFT + 2,500 ABCD', snapshotDate: 'Jul 01, 2026', eligibilityCriteria: 'Minimum 500 ABCD staked', totalPoolAllocated: '1,000 NFTs + 2.5M ABCD', totalClaimed: '420 / 1,000 (42%)', status: 'Active', icon: '🪂' },
  { id: 'AIRDROP-GOV-02', title: 'Governance Pioneer Loyalty Token Airdrop', description: 'Legacy governance display content.', rewardType: 'Tokens', rewardAmount: '1,000 ABCD', snapshotDate: 'Jul 15, 2026', eligibilityCriteria: 'Voted on at least two proposals', totalPoolAllocated: '500,000 ABCD', totalClaimed: '185,000 / 500,000 (37%)', status: 'Active', icon: '🗳️' },
  { id: 'AIRDROP-SEASON-03', title: 'Season 2 Financial Education Mastery Drop', description: 'Legacy governance display content.', rewardType: 'NFT', rewardAmount: '1x Scholar Master NFT Certificate', snapshotDate: 'Aug 15, 2026', eligibilityCriteria: '100% score on quiz exams', totalPoolAllocated: '500 Certificates', totalClaimed: '0 / 500 (0%)', status: 'Scheduled', icon: '🎓' },
];
export interface GiftAndBarterRulesConfig { giftMinLockDays: number; giftYieldApyPct: number; barterMaxValuationSpreadPct: number; barterEscrowLockHours: number; antiScamEscrowRequired: boolean; }
export const PROTOCOL_GIFT_BARTER_RULES: GiftAndBarterRulesConfig = { giftMinLockDays: 7, giftYieldApyPct: 8.5, barterMaxValuationSpreadPct: 10, barterEscrowLockHours: 24, antiScamEscrowRequired: true };
export function calculateMarketplaceFees(salePriceEth: number, reputationScore = 720) {
  const discountPct = reputationScore >= 800 ? 100 : reputationScore >= 670 ? 50 : reputationScore >= 580 ? 15 : 0;
  const tradingFeeEth = (salePriceEth * 250 * (1 - discountPct / 100)) / 10000;
  const listingFeeEth = (salePriceEth * 100) / 10000;
  const royaltyFeeEth = (salePriceEth * 500) / 10000;
  const totalDeductionEth = listingFeeEth + tradingFeeEth + royaltyFeeEth;
  return { salePriceEth, listingFeeEth: Number(listingFeeEth.toFixed(4)), tradingFeeEth: Number(tradingFeeEth.toFixed(4)), royaltyFeeEth: Number(royaltyFeeEth.toFixed(4)), totalDeductionEth: Number(totalDeductionEth.toFixed(4)), sellerNetProceedsEth: Number((salePriceEth - totalDeductionEth).toFixed(4)), discountPct };
}
