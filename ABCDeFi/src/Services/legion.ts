import { Contract, formatEther, Interface, isAddress, parseEther, Signer } from 'ethers';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID, requireContractAddress } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getSigner } from './wallet';
import LegionArtifact from '../../artifacts/contracts/LegionNFT.sol/LegionNFT.json';
import MarketplaceArtifact from '../../artifacts/contracts/marketplace/NFTMarketplace.sol/NFTMarketplace.json';
import deploymentManifest from '../../deployments.json';
import { isAcceptedMetadataUri } from './nftMetadata';

export type LegionLevel = 'Continent' | 'Country' | 'State' | 'District' | 'Unavailable';

export interface LegionRecord {
  tokenId: string;
  owner: string;
  name: string;
  territory: string;
  level: LegionLevel;
  parentId: string;
  children: string[];
  character: string;
  metadataUri: string;
  population: string;
  treasuryShareBps: string;
  createdAt: string;
}

export interface LegionSnapshot {
  contractAddress: string;
  isMinter: boolean;
  paused: boolean;
  legions: LegionRecord[];
  activeListings: LegionMarketplaceListing[];
}

export interface LegionMarketplaceListing {
  listingId: string;
  tokenId: string;
  seller: string;
  priceEth: string;
}

export interface MintLegionInput {
  recipient: string;
  name: string;
  territory: string;
  level: number | string;
  parentId: string;
  character: string;
  metadataURI: string;
  population: string;
  treasuryShareBps: string;
}

export type LegionTransactionSubmitted = (hash: string, stage: string) => void;

const legionInterface = new Interface(LegionArtifact.abi);
const marketplaceInterface = new Interface(MarketplaceArtifact.abi);
const levelNames: LegionLevel[] = ['Continent', 'Country', 'State', 'District'];

/** A real ERC-721 metadata reference is required; placeholders are not accepted. */
export function isAcceptedLegionMetadataUri(value: string): boolean {
  return isAcceptedMetadataUri(value);
}

function legionAddress() {
  return requireContractAddress('legionNFT');
}

function marketplaceAddress() {
  return requireContractAddress('marketplace');
}

function hasBytecode(code: string) {
  return code !== '0x' && code !== '0x0';
}

function nestedErrorData(error: unknown): string | null {
  const detail = error as { data?: unknown; error?: { data?: unknown }; info?: { error?: { data?: unknown } } };
  for (const candidate of [detail?.data, detail?.error?.data, detail?.info?.error?.data]) {
    if (typeof candidate === 'string' && /^0x[\da-fA-F]+$/.test(candidate)) return candidate;
  }
  return null;
}

export function legionErrorMessage(error: unknown): string {
  const detail = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; info?: { error?: { code?: string | number; message?: string } } };
  const code = detail?.code ?? detail?.info?.error?.code;
  const message = detail?.shortMessage || detail?.reason || detail?.message || detail?.info?.error?.message || 'LegionNFT transaction failed.';
  if (code === 'ACTION_REJECTED' || code === 4001 || code === '4001' || /user rejected|user denied/i.test(message)) return 'Transaction rejected in MetaMask. No on-chain state was changed.';
  if (/insufficient funds|insufficient balance/i.test(message)) return 'Insufficient ETH to pay network gas.';
  const errorData = nestedErrorData(error);
  if (errorData) {
    try {
      const decoded = legionInterface.parseError(errorData);
      if (decoded?.name === 'AccessControlUnauthorizedAccount') return 'The connected wallet does not have the LegionNFT minter role.';
      if (decoded?.name === 'EnforcedPause') return 'LegionNFT is paused.';
      return `LegionNFT reverted: ${decoded?.name || 'unknown custom error'}.`;
    } catch {
      // Use the provider message when no custom error can be decoded.
    }
  }
  if (/Invalid hierarchy level progression/i.test(message)) return 'The selected parent does not belong to the preceding hierarchy level.';
  if (/Invalid parent token ID/i.test(message)) return 'The selected parent Legion token does not exist.';
  if (/Name cannot be empty/i.test(message)) return 'Legion name is required.';
  if (/Invalid recipient/i.test(message)) return 'Recipient wallet address is invalid.';
  return message;
}

export function waitForLegionReceipt(receipt: { status?: number | null } | null, label: string) {
  if (!receipt || receipt.status !== 1) throw new Error(`${label} was reverted or not confirmed on-chain.`);
  return receipt;
}

async function assertMarketplaceDeployment(
  deploymentProvider: Pick<typeof canonicalProvider, 'getCode' | 'getNetwork'> = canonicalProvider,
) {
  const network = await deploymentProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) throw new Error(`Canonical NFTMarketplace RPC is not Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}).`);
  const address = marketplaceAddress();
  const code = await deploymentProvider.getCode(address);
  if (!hasBytecode(code)) throw new Error(`No NFTMarketplace bytecode exists at ${address} on Hardhat Local (31337). The active local chain does not match deployments.json.`);
  return address;
}

export async function assertLegionDeployment(
  deploymentProvider: Pick<typeof canonicalProvider, 'getCode' | 'getNetwork'> = canonicalProvider,
) {
  const network = await deploymentProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) throw new Error(`Canonical LegionNFT RPC is not Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}).`);
  const address = legionAddress();
  const code = await deploymentProvider.getCode(address);
  if (!hasBytecode(code)) throw new Error(`No LegionNFT bytecode exists at ${address} on Hardhat Local (31337). The active local chain does not match deployments.json.`);
  return address;
}

export async function assertLegionSignerNetwork(signer: Pick<Signer, 'provider'>) {
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) throw new Error(`Switch MetaMask to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before using LegionNFT.`);
}

async function signerForLegion() {
  await assertLegionDeployment();
  const signer = await getSigner();
  await assertLegionSignerNetwork(signer);
  return signer;
}

async function assertEnoughEthForGas(signer: Signer, estimatedGas: bigint) {
  const signerProvider = signer.provider;
  if (!signerProvider) throw new Error('MetaMask provider is unavailable. Reconnect the wallet and try again.');
  const [balance, feeData] = await Promise.all([signerProvider.getBalance(await signer.getAddress()), signerProvider.getFeeData()]);
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  if (balance < estimatedGas * gasPrice || (balance === 0n && estimatedGas > 0n)) throw new Error('Insufficient ETH to pay network gas.');
}

function toUnsigned(value: string, label: string) {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole non-negative number.`);
  return BigInt(value);
}

/** Converts the HTML select's numeric option value into the exact Solidity enum value. */
export function normalizeLegionLevel(value: unknown): number {
  const level = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  if (!Number.isInteger(level) || level < 0 || level > 3) {
    throw new Error('Legion level must be between 0 (Continent) and 3 (District).');
  }
  return level;
}

type LegionReadContract = {
  filters: { Transfer: (from?: string | null, to?: string | null, tokenId?: bigint | null) => unknown };
  queryFilter: (filter: unknown, fromBlock?: number | string, toBlock?: number | string) => Promise<any[]>;
  ownerOf: (tokenId: bigint) => Promise<string>;
  getLegionDetails: (tokenId: bigint) => Promise<any>;
  getLegionHierarchy: (tokenId: bigint) => Promise<[bigint, bigint[]]>;
  tokenURI: (tokenId: bigint) => Promise<string>;
  MINTER_ROLE: () => Promise<string>;
  hasRole: (role: string, account: string) => Promise<boolean>;
  paused: () => Promise<boolean>;
};

type MarketplaceReadContract = {
  getAllActiveListings: () => Promise<any[]>;
};

async function readLegionRecord(contract: LegionReadContract, tokenId: bigint): Promise<LegionRecord | null> {
  const [owner, details, hierarchy, metadataUri] = await Promise.all([
    contract.ownerOf(tokenId).catch(() => null),
    contract.getLegionDetails(tokenId).catch(() => null),
    contract.getLegionHierarchy(tokenId).catch(() => null),
    contract.tokenURI(tokenId).catch(() => ''),
  ]);
  if (!owner || !details || !hierarchy) return null;
  return {
    tokenId: tokenId.toString(), owner: String(owner), name: String(details.name), territory: String(details.territory),
    level: levelNames[Number(details.level)] || 'Unavailable', parentId: BigInt(hierarchy[0]).toString(), children: hierarchy[1].map((id) => BigInt(id).toString()),
    character: String(details.character), metadataUri, population: BigInt(details.population).toString(), treasuryShareBps: BigInt(details.treasuryShareBps).toString(), createdAt: BigInt(details.createdAt).toString(),
  };
}

/** LegionNFT has no enumerable extension, so current ownership is derived from Transfer logs and rechecked with ownerOf. */
export async function getLegionSnapshot(
  walletAddress: string,
  options: { deploymentProvider?: Pick<typeof canonicalProvider, 'getCode' | 'getNetwork'>; contract?: LegionReadContract; marketplaceContract?: MarketplaceReadContract; deploymentBlock?: number } = {},
): Promise<LegionSnapshot> {
  if (!isAddress(walletAddress)) throw new Error('Connected wallet address is invalid.');
  const deploymentProvider = options.deploymentProvider || canonicalProvider;
  const address = await assertLegionDeployment(deploymentProvider);
  const contract = options.contract || new Contract(address, LegionArtifact.abi, canonicalProvider) as unknown as LegionReadContract;
  const deploymentBlock = options.deploymentBlock ?? Number(deploymentManifest.contracts.LegionNFT.deploymentBlock);
  if (!Number.isInteger(deploymentBlock) || deploymentBlock < 0) throw new Error('LegionNFT deployment block is unavailable from deployments.json.');
  const marketAddress = await assertMarketplaceDeployment(deploymentProvider);
  const marketplace = options.marketplaceContract || new Contract(marketAddress, MarketplaceArtifact.abi, canonicalProvider) as unknown as MarketplaceReadContract;
  const [received, minterRole, paused, activeMarketplaceListings] = await Promise.all([
    contract.queryFilter(contract.filters.Transfer(null, walletAddress, null), deploymentBlock, 'latest'), contract.MINTER_ROLE(), contract.paused(),
    marketplace.getAllActiveListings(),
  ]);
  const tokenIds = [...new Set(received.map((event) => BigInt(event.args?.tokenId ?? event.args?.[2]).toString()))].map(BigInt);
  const records = (await Promise.all(tokenIds.map((tokenId) => readLegionRecord(contract, tokenId)))).filter((record): record is LegionRecord => Boolean(record));
  const legions = records.filter((record) => record.owner.toLowerCase() === walletAddress.toLowerCase()).sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  const activeListings = activeMarketplaceListings
    .filter((listing) => String(listing.nftAddress).toLowerCase() === address.toLowerCase() && Boolean(listing.active))
    .map((listing) => ({
      listingId: BigInt(listing.listingId).toString(), tokenId: BigInt(listing.tokenId).toString(), seller: String(listing.seller),
      priceEth: formatEther(listing.price),
    }));
  return { contractAddress: address, isMinter: await contract.hasRole(minterRole, walletAddress), paused: Boolean(paused), legions, activeListings };
}

/** Lists an owned Legion NFT on the canonical ETH marketplace after the required ERC-721 approval. */
export async function listLegionOnMarketplace(
  tokenIdInput: string,
  priceEth: string,
  onSubmitted?: LegionTransactionSubmitted,
): Promise<{ transactionHash: string; listingId: string | null }> {
  if (!/^\d+$/.test(tokenIdInput) || BigInt(tokenIdInput) === 0n) throw new Error('Enter a valid LegionNFT token ID.');
  if (!/^\d+(?:\.\d+)?$/.test(priceEth) || Number(priceEth) <= 0) throw new Error('Enter a positive ETH listing price.');

  const signer = await signerForLegion();
  const marketAddress = await assertMarketplaceDeployment();
  const legion = new Contract(legionAddress(), LegionArtifact.abi, signer);
  const marketplace = new Contract(marketAddress, MarketplaceArtifact.abi, signer);
  const tokenId = BigInt(tokenIdInput);
  const owner = await signer.getAddress();
  if ((await legion.ownerOf(tokenId)).toLowerCase() !== owner.toLowerCase()) throw new Error('The connected wallet does not own this LegionNFT.');

  const [approved, approvedForAll] = await Promise.all([
    legion.getApproved(tokenId), legion.isApprovedForAll(owner, marketAddress),
  ]);
  if (approved.toLowerCase() !== marketAddress.toLowerCase() && !approvedForAll) {
    let approvalGas: bigint;
    try { approvalGas = await legion.approve.estimateGas(marketAddress, tokenId); } catch (error) { throw new Error(legionErrorMessage(error)); }
    await assertEnoughEthForGas(signer, approvalGas);
    let approval: any;
    try { approval = await legion.approve(marketAddress, tokenId); } catch (error) { throw new Error(legionErrorMessage(error)); }
    onSubmitted?.(approval.hash, 'LegionNFT marketplace approval');
    waitForLegionReceipt(await approval.wait(), 'LegionNFT marketplace approval');
  }

  const price = parseEther(priceEth);
  let listingGas: bigint;
  try { listingGas = await marketplace.listNFT.estimateGas(legionAddress(), tokenId, price); } catch (error) { throw new Error(legionErrorMessage(error)); }
  await assertEnoughEthForGas(signer, listingGas);
  let transaction: any;
  try { transaction = await marketplace.listNFT(legionAddress(), tokenId, price); } catch (error) { throw new Error(legionErrorMessage(error)); }
  onSubmitted?.(transaction.hash, 'LegionNFT marketplace listing');
  const receipt: any = waitForLegionReceipt(await transaction.wait(), 'LegionNFT marketplace listing');
  let listingId: string | null = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = marketplaceInterface.parseLog(log);
      if (parsed?.name === 'NFTListed') listingId = BigInt(parsed.args.listingId).toString();
    } catch { /* Ignore unrelated receipt logs. */ }
  }
  return { transactionHash: transaction.hash, listingId };
}

/** Cancels an active Legion listing only when the connected signer is the recorded marketplace seller. */
export async function cancelLegionMarketplaceListing(
  listingIdInput: string,
  onSubmitted?: LegionTransactionSubmitted,
): Promise<{ transactionHash: string }> {
  if (!/^\d+$/.test(listingIdInput) || BigInt(listingIdInput) === 0n) throw new Error('Enter a valid marketplace listing ID.');
  const signer = await signerForLegion();
  const marketAddress = await assertMarketplaceDeployment();
  const marketplace = new Contract(marketAddress, MarketplaceArtifact.abi, signer);
  const listing = await marketplace.getListing(BigInt(listingIdInput));
  const seller = await signer.getAddress();
  if (!listing.active) throw new Error('This Legion marketplace listing is not active.');
  if (String(listing.nftAddress).toLowerCase() !== legionAddress().toLowerCase()) throw new Error('This listing does not escrow a LegionNFT.');
  if (String(listing.seller).toLowerCase() !== seller.toLowerCase()) throw new Error('Only the Legion listing seller can cancel it.');
  let estimatedGas: bigint;
  try { estimatedGas = await marketplace.cancelListing.estimateGas(BigInt(listingIdInput)); } catch (error) { throw new Error(legionErrorMessage(error)); }
  await assertEnoughEthForGas(signer, estimatedGas);
  let transaction: any;
  try { transaction = await marketplace.cancelListing(BigInt(listingIdInput)); } catch (error) { throw new Error(legionErrorMessage(error)); }
  onSubmitted?.(transaction.hash, 'LegionNFT listing cancellation');
  waitForLegionReceipt(await transaction.wait(), 'LegionNFT listing cancellation');
  return { transactionHash: transaction.hash };
}

export async function mintLegion(input: MintLegionInput, onSubmitted?: LegionTransactionSubmitted): Promise<{ transactionHash: string; tokenId: string | null }> {
  if (!isAddress(input.recipient)) throw new Error('Recipient wallet address is invalid.');
  if (!input.name.trim() || !input.territory.trim() || !input.character.trim()) throw new Error('Name, territory, and character are required.');
  if (!isAcceptedLegionMetadataUri(input.metadataURI.trim())) throw new Error('Metadata URI must be an explicit HTTPS or ipfs:// ERC-721 metadata URI.');
  const level = normalizeLegionLevel(input.level);
  const parentId = toUnsigned(input.parentId, 'Parent token ID');
  if ((level === 0 && parentId !== 0n) || (level > 0 && parentId === 0n)) throw new Error(level === 0 ? 'A Continent Legion must use parent token ID 0.' : 'Country, State, and District Legions require a parent token ID.');
  const population = toUnsigned(input.population, 'Population');
  const treasuryShareBps = toUnsigned(input.treasuryShareBps, 'Treasury share BPS');
  if (treasuryShareBps > 10_000n) throw new Error('Treasury share BPS cannot exceed 10,000.');

  const signer = await signerForLegion();
  const contract = new Contract(legionAddress(), LegionArtifact.abi, signer);
  const [minterRole, signerAddress] = await Promise.all([contract.MINTER_ROLE(), signer.getAddress()]);
  if (!await contract.hasRole(minterRole, signerAddress)) {
    throw new Error('The connected wallet does not have MINTER_ROLE on LegionNFT.');
  }
  const args = [input.recipient, input.name.trim(), input.territory.trim(), level, parentId, input.character.trim(), input.metadataURI.trim(), population, treasuryShareBps] as const;
  let estimatedGas: bigint;
  try { estimatedGas = await contract.mintLegion.estimateGas(...args); } catch (error) { throw new Error(legionErrorMessage(error)); }
  await assertEnoughEthForGas(signer, estimatedGas);
  let transaction: any;
  try { transaction = await contract.mintLegion(...args); } catch (error) { throw new Error(legionErrorMessage(error)); }
  onSubmitted?.(transaction.hash, 'Legion certificate mint');
  const receipt = waitForLegionReceipt(await transaction.wait(), 'Legion certificate mint') as any;
  let tokenId: string | null = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = legionInterface.parseLog(log);
      if (parsed?.name === 'LegionNFTMinted') tokenId = BigInt(parsed.args.nftId).toString();
    } catch {
      // Ignore unrelated logs in the confirmed receipt.
    }
  }
  return { transactionHash: transaction.hash, tokenId };
}
