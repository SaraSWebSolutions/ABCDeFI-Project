import { Contract, Interface, formatUnits, isAddress, parseUnits } from 'ethers';
import MarketplaceArtifact from '../../artifacts/contracts/marketplace/ABCDNFTMarketplaceV2.sol/ABCDNFTMarketplaceV2.json';
import { getProvider, getSigner } from './wallet';

type Source = { chainId: string; marketplaceAddress: string; abcdAddress: string; deploymentVersion: string };
type Revalidation = 'CURRENT' | 'STALE' | 'UNAVAILABLE';
export type MarketplaceListing = { listingId: string; collection: string; tokenId: string; seller: string; buyer?: string | null; price: string; status: 'ACTIVE' | 'SOLD' | 'CANCELLED'; revalidation?: Revalidation; revalidationReason?: string };
export type MarketplaceSnapshot = { available: boolean; status: 'AVAILABLE' | 'UNAVAILABLE'; checkpoint?: string | null; reason?: string; source?: Source; listings: MarketplaceListing[] };
type TransactionResult = { hash: string; receipt: { blockNumber: number | null }; indexed: boolean };
const api = '/api/abcd-nft-marketplace-v2';
const erc20 = ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];
const erc721 = ['function ownerOf(uint256) view returns (address)', 'function getApproved(uint256) view returns (address)', 'function isApprovedForAll(address,address) view returns (bool)', 'function approve(address,uint256)'];
const iface = new Interface(MarketplaceArtifact.abi);
const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

async function request<T>(path: string): Promise<T> { const response = await fetch(`${api}${path}`); const body = await response.json(); if (!response.ok) throw new Error(body.reason || body.message || `Marketplace API request failed (${response.status}).`); return body as T; }
function source(snapshot: MarketplaceSnapshot): Source { if (!snapshot.available || !snapshot.source || snapshot.source.chainId !== '31337') throw new Error(snapshot.reason || 'Canonical ABCD marketplace is unavailable.'); return snapshot.source; }
function expected(receipt: any, name: string) { const found = receipt.logs.some((log: any) => { try { return iface.parseLog(log)?.name === name; } catch { return false; } }); if (!found) throw new Error(`Confirmed receipt did not contain ${name}.`); }
async function confirmed(tx: any, event: string | null, label: string, stage?: (message: string, hash?: string) => void): Promise<TransactionResult> { stage?.('Confirming on-chain receipt', tx.hash); const receipt = await tx.wait(); if (!receipt || Number(receipt.status) !== 1) throw new Error(`${label} reverted or was not confirmed on-chain.`); if (event) expected(receipt, event); return { hash: tx.hash, receipt: { blockNumber: receipt.blockNumber ?? null }, indexed: false }; }

async function revalidate(listing: MarketplaceListing, details: Source): Promise<MarketplaceListing> {
  try {
    const provider = await getProvider();
    if ((await provider.getNetwork()).chainId !== 31337n) throw new Error('Wallet is not on Hardhat Local (31337).');
    const nft = new Contract(listing.collection, erc721, provider);
    const owner = await nft.ownerOf(BigInt(listing.tokenId));
    if (!same(owner, listing.seller)) return { ...listing, revalidation: 'STALE', revalidationReason: 'Seller no longer owns this NFT.' };
    const [approved, approvedForAll] = await Promise.all([nft.getApproved(BigInt(listing.tokenId)), nft.isApprovedForAll(owner, details.marketplaceAddress)]);
    if (!same(approved, details.marketplaceAddress) && !approvedForAll) return { ...listing, revalidation: 'STALE', revalidationReason: 'Marketplace approval was removed.' };
    return { ...listing, revalidation: 'CURRENT' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Current on-chain listing validation failed.';
    return { ...listing, revalidation: 'UNAVAILABLE', revalidationReason: reason };
  }
}

export async function getABCDMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  const status: any = await request('/status');
  if (!status.available) return { available: false, status: 'UNAVAILABLE', checkpoint: status.checkpoint, reason: status.reason, source: status.source, listings: [] };
  const active: any = await request('/listings/active');
  const snapshot: MarketplaceSnapshot = { available: true, status: 'AVAILABLE', checkpoint: status.checkpoint, source: status.source, listings: Array.isArray(active.data) ? active.data : [] };
  const details = source(snapshot);
  return { ...snapshot, listings: await Promise.all(snapshot.listings.map((listing) => revalidate(listing, details))) };
}

async function waitForIndexer(result: TransactionResult, eventName: string, stage?: (message: string, hash?: string) => void): Promise<TransactionResult> {
  stage?.('Confirmed on chain — waiting for indexer', result.hash);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const status: any = await request('/status');
      if (status.available && result.receipt.blockNumber !== null && BigInt(status.checkpoint || 0) >= BigInt(result.receipt.blockNumber)) {
        const history: any = await request('/history?limit=100');
        if (Array.isArray(history.data) && history.data.some((entry: any) => same(entry.transactionHash, result.hash) && entry.eventName === eventName)) {
          stage?.('Confirmed and indexed', result.hash);
          return { ...result, indexed: true };
        }
      }
    } catch { /* Preserve the confirmed chain result while indexer evidence is pending. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stage?.('Confirmed on chain — waiting for indexer', result.hash);
  return result;
}

async function market(snapshot: MarketplaceSnapshot) { const details = source(snapshot); const signer = await getSigner(); const network = await signer.provider?.getNetwork(); if (network?.chainId !== 31337n) throw new Error('Switch MetaMask to Hardhat Local (31337) before using the canonical ABCD marketplace.'); return { details, signer, contract: new Contract(details.marketplaceAddress, MarketplaceArtifact.abi, signer) }; }
export async function createABCDListing(collection: string, tokenIdText: string, priceText: string, stage?: (message: string, hash?: string) => void) { if (!isAddress(collection) || !/^\d+$/.test(tokenIdText) || BigInt(tokenIdText) === 0n) throw new Error('Collection and token ID are invalid.'); const price = parseUnits(priceText, 18); if (price <= 0n) throw new Error('Price must be greater than zero ABCD.'); const snapshot = await getABCDMarketplaceSnapshot(); const { details, signer, contract } = await market(snapshot); const nft = new Contract(collection, erc721, signer); const owner = await signer.getAddress(); const approved = await nft.getApproved(BigInt(tokenIdText)); const approvedForAll = await nft.isApprovedForAll(owner, details.marketplaceAddress); if (!same(approved, details.marketplaceAddress) && !approvedForAll) { stage?.('Waiting for MetaMask approval'); await confirmed(await nft.approve(details.marketplaceAddress, BigInt(tokenIdText)), null, 'NFT approval', stage); }
  stage?.('Waiting for MetaMask listing confirmation'); return waitForIndexer(await confirmed(await contract.createListing(collection, BigInt(tokenIdText), price), 'ListingCreated', 'Marketplace listing', stage), 'ListingCreated', stage); }
export async function cancelABCDListing(listingId: string, stage?: (message: string, hash?: string) => void) { if (!/^\d+$/.test(listingId) || BigInt(listingId) === 0n) throw new Error('Listing ID is invalid.'); const snapshot = await getABCDMarketplaceSnapshot(); const { contract } = await market(snapshot); stage?.('Waiting for MetaMask cancellation confirmation'); return waitForIndexer(await confirmed(await contract.cancelListing(BigInt(listingId)), 'ListingCancelled', 'Listing cancellation', stage), 'ListingCancelled', stage); }
export async function purchaseABCDListing(listing: MarketplaceListing, stage?: (message: string, hash?: string) => void) { if (listing.revalidation !== 'CURRENT') throw new Error(listing.revalidationReason || 'Listing is not currently purchasable.'); const snapshot = await getABCDMarketplaceSnapshot(); const current = snapshot.listings.find((candidate) => candidate.listingId === listing.listingId); if (!current || current.revalidation !== 'CURRENT') throw new Error(current?.revalidationReason || 'Listing is no longer currently purchasable.'); const { details, signer, contract } = await market(snapshot); const token = new Contract(details.abcdAddress, erc20, signer); const buyer = await signer.getAddress(); const price = BigInt(listing.price); const allowance = await token.allowance(buyer, details.marketplaceAddress); if (allowance < price) { stage?.('Waiting for MetaMask ABCD approval'); await confirmed(await token.approve(details.marketplaceAddress, price), null, 'ABCD approval', stage); }
  stage?.('Waiting for MetaMask purchase confirmation'); return waitForIndexer(await confirmed(await contract.purchaseListing(BigInt(listing.listingId)), 'ListingPurchased', 'Marketplace purchase', stage), 'ListingPurchased', stage); }
export const displayABCD = (amount: string) => formatUnits(BigInt(amount), 18);
export function marketplaceError(error: unknown) { const value = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string }; const message = value.shortMessage || value.reason || value.message || 'Marketplace action failed.'; return value.code === 4001 || value.code === 'ACTION_REJECTED' || /rejected|denied/i.test(message) ? 'Transaction rejected in MetaMask. No on-chain state changed.' : message; }
