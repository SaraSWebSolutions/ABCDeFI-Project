import { Contract, formatEther, Interface, isAddress, parseEther, Signer } from 'ethers';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID, requireContractAddress } from '../Config/contracts';
import { getSigner } from './wallet';
import { provider as canonicalProvider } from './contractProvider';
import ParticipantArtifact from '../../artifacts/contracts/nft/ParticipantNFT.sol/ParticipantNFT.json';
import ReputationArtifact from '../../artifacts/contracts/nft/ReputationNFT.sol/ReputationNFT.json';
import GuruArtifact from '../../artifacts/contracts/nft/GuruNFT.sol/GuruNFT.json';
import LoanArtifact from '../../artifacts/contracts/nft/LoanNFT.sol/LoanNFT.json';
import MarketplaceArtifact from '../../artifacts/contracts/marketplace/NFTMarketplace.sol/NFTMarketplace.json';

export interface MarketplaceListing { listingId: string; nftAddress: string; tokenId: string; seller: string; priceEth: string; active: boolean; }
export interface ReputationSnapshot { tokenId: string; creditScore: string; totalLoansCount: string; totalDefaultsCount: string; metadataUri: string; }
export interface NftEcosystemSnapshot { participantBalance: string; reputation: ReputationSnapshot | null; guruBalance: string; loanBalance: string; activeListings: MarketplaceListing[]; userListings: MarketplaceListing[]; marketplaceFeeBps: string; }
export interface LoanNftCertificateEvent { name: string; transactionHash: string | null; blockNumber: string | null; logIndex: number | null; }
export interface LoanNftCertificate {
  tokenId: string;
  loanId: string;
  certificateType: 'Borrower' | 'Lender' | 'Platform' | 'Not available';
  borrower: string;
  lender: string;
  owner: string | null;
  principalAbcd: string;
  collateralEth: string;
  interestRateBps: string;
  durationMonths: string;
  status: string;
  mintDate: string | null;
  metadataUri: string | null;
  mintTransactionHash: string | null;
  mintBlock: string | null;
  createdAt: string | null;
  indexedAt: string | null;
  burned: boolean;
  events: LoanNftCertificateEvent[];
}
export interface LoanNftCertificateSnapshot {
  certificates: LoanNftCertificate[];
  historyUnavailable: string | null;
}
export type TransactionSubmitted = (hash: string, stage: string) => void;

const participantAddress = () => requireContractAddress('participantNFT');
const reputationAddress = () => requireContractAddress('reputationNFT');
const guruAddress = () => requireContractAddress('guruNFT');
const loanAddress = () => requireContractAddress('loanNFT');
const marketplaceAddress = () => requireContractAddress('marketplace');
const marketplaceInterface = new Interface(MarketplaceArtifact.abi);
const LOAN_NFT_STATUS = ['ACTIVE', 'COMPLETED', 'DEFAULTED', 'LIQUIDATED'];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function waitForNftMarketplaceReceipt(receipt: { status?: number | null } | null, label: string) {
  if (!receipt || receipt.status !== 1) throw new Error(`${label} was reverted or not confirmed on-chain.`);
  return receipt;
}

interface ListingResult { listingId: bigint; nftAddress: string; tokenId: bigint; seller: string; price: bigint; active: boolean; }

function toListing(listing: ListingResult): MarketplaceListing {
  return { listingId: listing.listingId.toString(), nftAddress: listing.nftAddress, tokenId: listing.tokenId.toString(), seller: listing.seller, priceEth: formatEther(listing.price), active: Boolean(listing.active) };
}

function isDeployedBytecode(bytecode: string) {
  return bytecode !== '0x' && bytecode !== '0x0';
}

/** The canonical RPC, not MetaMask, establishes whether the manifest deployment exists. */
export async function assertNftMarketplaceBytecode(
  deploymentProvider: Pick<typeof canonicalProvider, 'getCode'> = canonicalProvider,
) {
  const address = marketplaceAddress();
  const bytecode = await deploymentProvider.getCode(address);
  if (!isDeployedBytecode(bytecode)) {
    throw new Error(`No NFTMarketplace bytecode exists at ${address} on Hardhat Local (31337). The active local chain does not match deployments.json.`);
  }
}

/** Verifies that direct LoanNFT reads target the active manifest deployment. */
export async function assertLoanNftDeployment(
  deploymentProvider: Pick<typeof canonicalProvider, 'getCode' | 'getNetwork'> = canonicalProvider,
) {
  const network = await deploymentProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Canonical LoanNFT RPC is not Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}).`);
  }
  const address = loanAddress();
  const bytecode = await deploymentProvider.getCode(address);
  if (!isDeployedBytecode(bytecode)) {
    throw new Error(`No LoanNFT bytecode exists at ${address} on Hardhat Local (31337). The active local chain does not match deployments.json.`);
  }
}

async function assertContractBytecode(address: string, label: string) {
  const bytecode = await canonicalProvider.getCode(address);
  if (!isDeployedBytecode(bytecode)) {
    throw new Error(`No ${label} bytecode exists at ${address} on Hardhat Local (31337). The active local chain does not match deployments.json.`);
  }
}

export async function assertNftMarketplaceSignerNetwork(
  signer: Pick<Signer, 'provider'>,
) {
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch MetaMask to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before using the NFT marketplace.`);
  }
}

function nestedErrorData(error: unknown): string | null {
  const details = error as { data?: unknown; error?: { data?: unknown }; info?: { error?: { data?: unknown } } };
  for (const candidate of [details?.data, details?.error?.data, details?.info?.error?.data]) {
    if (typeof candidate === 'string' && /^0x[\da-fA-F]+$/.test(candidate)) return candidate;
  }
  return null;
}

/** Converts wallet, RPC, and ABI custom-error failures into safe UI feedback. */
export function nftMarketplaceErrorMessage(error: unknown): string {
  const details = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; info?: { error?: { code?: string | number; message?: string } } };
  const code = details?.code ?? details?.info?.error?.code;
  const message = details?.shortMessage || details?.reason || details?.message || details?.info?.error?.message || 'NFT marketplace transaction failed.';

  if (code === 'ACTION_REJECTED' || code === 4001 || code === '4001' || /user rejected|user denied/i.test(message)) {
    return 'Transaction rejected in MetaMask. No on-chain state was changed.';
  }
  if (/insufficient funds|insufficient balance/i.test(message)) {
    return 'Insufficient ETH to pay the listing price and network gas.';
  }

  const data = nestedErrorData(error);
  if (data) {
    try {
      const decoded = marketplaceInterface.parseError(data);
      if (decoded?.name === 'EnforcedPause') return 'NFT marketplace is paused. This operation is currently unavailable.';
      if (decoded?.name === 'LoanNotActive') return 'This marketplace listing is no longer active.';
      if (decoded?.name === 'ZeroAmount') return 'Listing price must be greater than zero.';
      if (decoded?.name === 'UnauthorizedAccount') return 'The connected wallet is not authorized to change this listing.';
      if (decoded?.name === 'CapExceeded') return 'The supplied ETH amount does not satisfy this listing price.';
      if (decoded?.name === 'NativeTransferFailed') return 'The marketplace could not complete the ETH transfer for this listing.';
      return `NFT marketplace reverted: ${decoded?.name ?? 'unknown custom error'}.`;
    } catch {
      // Preserve the provider message when the returned data is not a marketplace custom error.
    }
  }

  if (/enforcedpause|paused/i.test(message)) return 'NFT marketplace is paused. This operation is currently unavailable.';
  if (/LoanNotActive/i.test(message)) return 'This marketplace listing is no longer active.';
  return message;
}

async function signerForNftMarketplace() {
  await assertNftMarketplaceBytecode();
  const signer = await getSigner();
  await assertNftMarketplaceSignerNetwork(signer);
  return signer;
}

async function assertEnoughEthForTransaction(
  signer: Signer,
  estimatedGas: bigint,
  transactionValue = 0n,
) {
  const wallet = await signer.getAddress();
  const provider = signer.provider;
  if (!provider) throw new Error('MetaMask provider is unavailable. Reconnect the wallet and try again.');
  const [balance, feeData] = await Promise.all([provider.getBalance(wallet), provider.getFeeData()]);
  const unitGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  const required = transactionValue + (estimatedGas * unitGasPrice);
  if (balance < required || (required === 0n && balance === 0n)) {
    throw new Error('Insufficient ETH to pay the listing price and network gas.');
  }
}

async function estimateOrExplain(estimate: Promise<bigint>) {
  try {
    return await estimate;
  } catch (error) {
    throw new Error(nftMarketplaceErrorMessage(error));
  }
}

export async function getNftEcosystemSnapshot(walletAddress: string): Promise<NftEcosystemSnapshot> {
  const participant = new Contract(participantAddress(), ParticipantArtifact.abi, canonicalProvider);
  const reputation = new Contract(reputationAddress(), ReputationArtifact.abi, canonicalProvider);
  const guru = new Contract(guruAddress(), GuruArtifact.abi, canonicalProvider);
  const loan = new Contract(loanAddress(), LoanArtifact.abi, canonicalProvider);
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, canonicalProvider);
  const [participantBalance, reputationTokenId, guruBalance, loanBalance, listings, marketplaceFeeBps] = await Promise.all([
    participant.balanceOf(walletAddress), reputation.getUserTokenId(walletAddress), guru.balanceOf(walletAddress), loan.balanceOf(walletAddress), marketplace.getAllActiveListings(), marketplace.marketplaceFeeBps(),
  ]);
  let reputationSnapshot: ReputationSnapshot | null = null;
  if (reputationTokenId !== 0n) {
    const [details, metadataUri] = await Promise.all([reputation.getReputation(reputationTokenId), reputation.tokenURI(reputationTokenId)]);
    reputationSnapshot = { tokenId: reputationTokenId.toString(), creditScore: details.creditScore.toString(), totalLoansCount: details.totalLoansCount.toString(), totalDefaultsCount: details.totalDefaultsCount.toString(), metadataUri };
  }
  const activeListings = (listings as ListingResult[]).map(toListing);
  const userListings = activeListings.filter((listing) => listing.seller.toLowerCase() === walletAddress.toLowerCase());
  return { participantBalance: participantBalance.toString(), reputation: reputationSnapshot, guruBalance: guruBalance.toString(), loanBalance: loanBalance.toString(), activeListings, userListings, marketplaceFeeBps: marketplaceFeeBps.toString() };
}

interface IndexedEvidence { transactionHash?: string; blockNumber?: string; logIndex?: number; eventName?: string; }
interface IndexedLoanNftRecord {
  tokenId?: string; loanId?: string; borrower?: string; lender?: string; owner?: string | null;
  loanAmount?: string; collateral?: string; interestRateBps?: string; durationMonths?: string;
  status?: string; mintDate?: string; ipfsUri?: string; burned?: boolean;
  mintedEvidence?: IndexedEvidence | null; latestStateEvidence?: IndexedEvidence | null; burnedEvidence?: IndexedEvidence | null;
  createdAt?: string; indexedAt?: string;
}
interface LendingWalletHistoryResponse {
  source?: { kind?: string }; available?: boolean; status?: string; reason?: string;
  data?: { loanNfts?: IndexedLoanNftRecord[] };
}
type FetchJson = (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function loanNftWalletHistoryEndpoint(walletAddress: string) {
  return `/api/lending/wallet/${encodeURIComponent(walletAddress)}?limit=100`;
}

/** Reads only the existing canonical lending projection; it never falls back to mock NFT history. */
export async function readIndexedLoanNftHistory(
  walletAddress: string,
  fetchJson: FetchJson = (input) => fetch(input) as Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
): Promise<{ certificates: IndexedLoanNftRecord[]; historyUnavailable: string | null }> {
  try {
    const response = await fetchJson(loanNftWalletHistoryEndpoint(walletAddress));
    const payload = await response.json() as LendingWalletHistoryResponse;
    if (!response.ok) throw new Error((payload as { message?: string })?.message || `Canonical lending API returned HTTP ${response.status}.`);
    if (payload.source?.kind !== 'canonical-indexed-on-chain') throw new Error('LoanNFT history response is not canonical indexed on-chain data.');
    if (!payload.available || payload.status !== 'AVAILABLE') {
      return { certificates: [], historyUnavailable: payload.reason || 'LoanNFT history is not available from the canonical lending indexer.' };
    }
    if (!Array.isArray(payload.data?.loanNfts)) throw new Error('Canonical lending API returned an invalid LoanNFT history response.');
    return { certificates: payload.data.loanNfts, historyUnavailable: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Canonical lending API request failed.';
    return { certificates: [], historyUnavailable: `Indexed LoanNFT history is unavailable: ${message}` };
  }
}

function eventFromEvidence(name: string, evidence?: IndexedEvidence | null): LoanNftCertificateEvent | null {
  if (!evidence) return null;
  return { name: evidence.eventName || name, transactionHash: evidence.transactionHash || null, blockNumber: evidence.blockNumber || null, logIndex: typeof evidence.logIndex === 'number' ? evidence.logIndex : null };
}

function indexedEvents(record: IndexedLoanNftRecord): LoanNftCertificateEvent[] {
  const evidence = [
    eventFromEvidence('LoanNFTMinted', record.mintedEvidence),
    eventFromEvidence('Loan status updated', record.latestStateEvidence),
    eventFromEvidence('LoanNFTBurned', record.burnedEvidence),
  ].filter((item): item is LoanNftCertificateEvent => Boolean(item));
  return evidence.filter((event, index) => evidence.findIndex((candidate) => candidate.transactionHash === event.transactionHash && candidate.logIndex === event.logIndex && candidate.name === event.name) === index);
}

function toStatus(value: bigint | number | undefined) {
  return value === undefined ? 'Not available' : LOAN_NFT_STATUS[Number(value)] ?? 'Not available';
}

function certificateType(initialOwner: string | null, borrower: string, lender: string): LoanNftCertificate['certificateType'] {
  if (!initialOwner) return 'Not available';
  if (initialOwner.toLowerCase() === borrower.toLowerCase()) return 'Borrower';
  if (initialOwner.toLowerCase() === lender.toLowerCase()) return 'Lender';
  return 'Platform';
}

function eventFromLog(name: string, log: any): LoanNftCertificateEvent {
  return { name, transactionHash: log?.transactionHash || null, blockNumber: log?.blockNumber === undefined ? null : String(log.blockNumber), logIndex: typeof log?.index === 'number' ? log.index : null };
}

async function directOwnedLoanNftTokenIds(loanNft: Contract, walletAddress: string): Promise<string[]> {
  const count = await loanNft.balanceOf(walletAddress) as bigint;
  if (count > 100n) throw new Error('LoanNFT ownership exceeds the safe direct-read limit (100).');
  return Promise.all(Array.from({ length: Number(count) }, async (_, index) => String(await loanNft.tokenOfOwnerByIndex(walletAddress, index))));
}

async function directCertificateEvents(loanNft: Contract, tokenId: bigint): Promise<{ events: LoanNftCertificateEvent[]; initialOwner: string | null }> {
  const [minted, statusUpdates, transfers] = await Promise.all([
    loanNft.queryFilter(loanNft.filters.LoanNFTMinted(tokenId)),
    loanNft.queryFilter(loanNft.filters.LoanStatusUpdated(tokenId)),
    loanNft.queryFilter(loanNft.filters.Transfer(null, null, tokenId)),
  ]);
  const initialTransfer: any = transfers.find((event: any) => String(event.args?.from || '').toLowerCase() === ZERO_ADDRESS);
  const initialOwner = initialTransfer?.args?.to ? String(initialTransfer.args.to) : null;
  const events = [
    ...minted.map((event: any) => eventFromLog('LoanNFTMinted', event)),
    ...statusUpdates.map((event: any) => eventFromLog('LoanStatusUpdated', event)),
    ...transfers.map((event: any) => eventFromLog('Transfer', event)),
  ];
  return { initialOwner, events: events.sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0) || Number(a.logIndex || 0) - Number(b.logIndex || 0)) };
}

async function readLoanNftCertificate(loanNft: Contract, tokenIdText: string, indexed?: IndexedLoanNftRecord): Promise<LoanNftCertificate> {
  const tokenId = BigInt(tokenIdText);
  const [detailsResult, ownerResult, eventResult] = await Promise.allSettled([
    loanNft.getLoanNFTDetails(tokenId), loanNft.ownerOf(tokenId), directCertificateEvents(loanNft, tokenId),
  ]);
  const details = detailsResult.status === 'fulfilled' ? detailsResult.value : null;
  const owner = ownerResult.status === 'fulfilled' ? String(ownerResult.value) : indexed?.owner || null;
  const events = eventResult.status === 'fulfilled' ? eventResult.value.events : indexedEvents(indexed || {});
  const mintEvent = events.find((event) => event.name === 'LoanNFTMinted') || eventFromEvidence('LoanNFTMinted', indexed?.mintedEvidence);
  const initialOwner = eventResult.status === 'fulfilled' ? eventResult.value.initialOwner : null;
  const borrower = details ? String(details.borrower) : indexed?.borrower || 'Not available';
  const lender = details ? String(details.lender) : indexed?.lender || 'Not available';
  const canClassify = borrower !== 'Not available' && lender !== 'Not available';

  return {
    tokenId: tokenIdText,
    loanId: details ? String(details.loanId) : indexed?.loanId || 'Not available',
    certificateType: canClassify ? certificateType(initialOwner, borrower, lender) : 'Not available',
    borrower,
    lender,
    owner,
    principalAbcd: details ? formatEther(details.loanAmount) : indexed?.loanAmount ? formatEther(BigInt(indexed.loanAmount)) : 'Not available',
    collateralEth: details ? formatEther(details.collateral) : indexed?.collateral ? formatEther(BigInt(indexed.collateral)) : 'Not available',
    interestRateBps: details ? String(details.interestRateBps) : indexed?.interestRateBps || 'Not available',
    durationMonths: details ? String(details.durationMonths) : indexed?.durationMonths || 'Not available',
    status: details ? toStatus(details.status) : indexed?.status || 'Not available',
    mintDate: details ? String(details.mintDate) : indexed?.mintDate || null,
    metadataUri: details ? String(details.ipfsUri || '') || null : indexed?.ipfsUri || null,
    mintTransactionHash: mintEvent?.transactionHash || null,
    mintBlock: mintEvent?.blockNumber || null,
    createdAt: indexed?.createdAt || null,
    indexedAt: indexed?.indexedAt || null,
    burned: Boolean(indexed?.burned),
    events,
  };
}

/**
 * Combines the existing canonical lending indexer history with direct LoanNFT
 * reads. Direct ownership ensures account switches are reflected immediately;
 * indexed evidence supplies persisted mint/index timestamps when available.
 */
export async function getLoanNftCertificateSnapshot(walletAddress: string): Promise<LoanNftCertificateSnapshot> {
  if (!isAddress(walletAddress)) throw new Error('Wallet must be a valid Ethereum address.');
  await assertLoanNftDeployment();
  const loanNft = new Contract(loanAddress(), LoanArtifact.abi, canonicalProvider);
  const [indexed, ownedTokenIds] = await Promise.all([
    readIndexedLoanNftHistory(walletAddress), directOwnedLoanNftTokenIds(loanNft, walletAddress),
  ]);
  const indexedByTokenId = new Map(indexed.certificates.filter((record) => /^\d+$/.test(record.tokenId || '')).map((record) => [record.tokenId!, record]));
  const tokenIds = [...new Set([...indexedByTokenId.keys(), ...ownedTokenIds])].sort((a, b) => Number(a) - Number(b));
  const certificates = await Promise.all(tokenIds.map((tokenId) => readLoanNftCertificate(loanNft, tokenId, indexedByTokenId.get(tokenId))));
  return { certificates, historyUnavailable: indexed.historyUnavailable };
}

export async function listParticipantNft(tokenIdInput: string, priceEth: string, onSubmitted?: TransactionSubmitted) {
  if (!/^\d+$/.test(tokenIdInput) || BigInt(tokenIdInput) === 0n) throw new Error('Enter a valid ParticipantNFT token ID.');
  if (!/^\d+(?:\.\d+)?$/.test(priceEth) || Number(priceEth) <= 0) throw new Error('Enter a positive ETH listing price.');
  const signer = await signerForNftMarketplace();
  const seller = await signer.getAddress();
  await assertContractBytecode(participantAddress(), 'ParticipantNFT');
  const participant = new Contract(participantAddress(), ParticipantArtifact.abi, signer);
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, signer);
  const tokenId = BigInt(tokenIdInput);
  if ((await participant.ownerOf(tokenId)).toLowerCase() !== seller.toLowerCase()) throw new Error('The connected wallet does not own this ParticipantNFT.');
  const [approvedAddress, approvedForAll] = await Promise.all([
    participant.getApproved(tokenId), participant.isApprovedForAll(seller, marketplaceAddress()),
  ]);
  if (approvedAddress.toLowerCase() !== marketplaceAddress().toLowerCase() && !approvedForAll) {
    const approvalGas = await estimateOrExplain(participant.approve.estimateGas(marketplaceAddress(), tokenId));
    await assertEnoughEthForTransaction(signer, approvalGas);
    const approval = await participant.approve(marketplaceAddress(), tokenId);
    onSubmitted?.(approval.hash, 'ParticipantNFT approval');
    waitForNftMarketplaceReceipt(await approval.wait(), 'ParticipantNFT approval');
  }
  const listingGas = await estimateOrExplain(marketplace.listNFT.estimateGas(participantAddress(), tokenId, parseEther(priceEth)));
  await assertEnoughEthForTransaction(signer, listingGas);
  const listing = await marketplace.listNFT(participantAddress(), tokenId, parseEther(priceEth));
  onSubmitted?.(listing.hash, 'Marketplace listing');
  return waitForNftMarketplaceReceipt(await listing.wait(), 'Marketplace listing');
}

export async function buyNftListing(listingIdInput: string, onSubmitted?: TransactionSubmitted) {
  if (!/^\d+$/.test(listingIdInput) || BigInt(listingIdInput) === 0n) throw new Error('Enter a valid marketplace listing ID.');
  const signer = await signerForNftMarketplace();
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, signer);
  const listing = await marketplace.getListing(BigInt(listingIdInput));
  if (!listing.active) throw new Error('This marketplace listing is not active.');
  const buyer = await signer.getAddress();
  if (listing.seller.toLowerCase() === buyer.toLowerCase()) throw new Error('The seller cannot buy their own NFT listing.');
  const purchaseGas = await estimateOrExplain(marketplace.buyNFT.estimateGas(BigInt(listingIdInput), { value: listing.price }));
  await assertEnoughEthForTransaction(signer, purchaseGas, listing.price);
  const transaction = await marketplace.buyNFT(BigInt(listingIdInput), { value: listing.price });
  onSubmitted?.(transaction.hash, 'NFT purchase');
  return waitForNftMarketplaceReceipt(await transaction.wait(), 'NFT purchase');
}

export async function cancelNftListing(listingIdInput: string, onSubmitted?: TransactionSubmitted) {
  if (!/^\d+$/.test(listingIdInput) || BigInt(listingIdInput) === 0n) throw new Error('Enter a valid marketplace listing ID.');
  const signer = await signerForNftMarketplace();
  const seller = await signer.getAddress();
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, signer);
  const listing = await marketplace.getListing(BigInt(listingIdInput));
  if (!listing.active) throw new Error('This marketplace listing is not active.');
  if (listing.seller.toLowerCase() !== seller.toLowerCase()) throw new Error('Only the listing seller can cancel this listing from the user marketplace.');
  const cancellationGas = await estimateOrExplain(marketplace.cancelListing.estimateGas(BigInt(listingIdInput)));
  await assertEnoughEthForTransaction(signer, cancellationGas);
  const transaction = await marketplace.cancelListing(BigInt(listingIdInput));
  onSubmitted?.(transaction.hash, 'Listing cancellation');
  return waitForNftMarketplaceReceipt(await transaction.wait(), 'Listing cancellation');
}

export async function updateNftListingPrice(listingIdInput: string, newPriceEth: string, onSubmitted?: TransactionSubmitted) {
  if (!/^\d+$/.test(listingIdInput) || BigInt(listingIdInput) === 0n) throw new Error('Enter a valid marketplace listing ID.');
  if (!/^\d+(?:\.\d+)?$/.test(newPriceEth) || Number(newPriceEth) <= 0) throw new Error('Enter a positive ETH listing price.');
  const signer = await signerForNftMarketplace();
  const seller = await signer.getAddress();
  const marketplace = new Contract(marketplaceAddress(), MarketplaceArtifact.abi, signer);
  const listing = await marketplace.getListing(BigInt(listingIdInput));
  if (!listing.active) throw new Error('This marketplace listing is not active.');
  if (listing.seller.toLowerCase() !== seller.toLowerCase()) throw new Error('Only the listing seller can change this listing price.');
  const newPrice = parseEther(newPriceEth);
  const updateGas = await estimateOrExplain(marketplace.updateListingPrice.estimateGas(BigInt(listingIdInput), newPrice));
  await assertEnoughEthForTransaction(signer, updateGas);
  const transaction = await marketplace.updateListingPrice(BigInt(listingIdInput), newPrice);
  onSubmitted?.(transaction.hash, 'Listing price update');
  return waitForNftMarketplaceReceipt(await transaction.wait(), 'Listing price update');
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
