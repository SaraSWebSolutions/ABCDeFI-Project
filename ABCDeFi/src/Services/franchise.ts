import { Contract, Interface, isAddress, parseEther, Signer } from 'ethers';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID, requireContractAddress } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getSigner } from './wallet';
import FranchiseArtifact from '../../artifacts/contracts/nft/FranchiseNFT.sol/FranchiseNFT.json';
import MarketplaceArtifact from '../../artifacts/contracts/marketplace/NFTMarketplace.sol/NFTMarketplace.json';
import deploymentManifest from '../../deployments.json';
import { isAcceptedMetadataUri } from './nftMetadata';

export type FranchiseStatus = 'Active' | 'Suspended' | 'Revoked' | 'Pending' | 'Unavailable';

export interface FranchiseRecord {
  tokenId: string;
  franchiseName: string;
  territoryCode: string;
  territoryName: string;
  level: string;
  legionNFTId: string;
  owner: string;
  priceUSD: string;
  commissionBps: string;
  purchaseTimestamp: string;
  lockExpiryTimestamp: string;
  remainingLockSeconds: string;
  transferLocked: boolean;
  status: FranchiseStatus;
  tokenUri: string;
  ipfsCID: string;
  mintTransactionHash: string | null;
  mintBlockNumber: string | null;
}

export interface FranchiseSnapshot {
  contractAddress: string;
  isMinter: boolean;
  franchises: FranchiseRecord[];
}

export interface MintFranchiseInput {
  franchisee: string;
  franchiseName: string;
  territoryCode: string;
  territoryName: string;
  level: number;
  legionNFTId: string;
  priceUSD: string;
  commissionBps: string;
  tokenURI: string;
  ipfsCID: string;
}

export type TransactionSubmitted = (hash: string, stage: string) => void;

const statusNames: FranchiseStatus[] = ['Active', 'Suspended', 'Revoked', 'Pending'];
const franchiseInterface = new Interface(FranchiseArtifact.abi);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function franchiseAddress() {
  return requireContractAddress('franchiseNFT');
}

function marketplaceAddress() {
  return requireContractAddress('marketplace');
}

function hasBytecode(code: string) {
  return code !== '0x' && code !== '0x0';
}

function isValidIpfsCid(value: string): boolean {
  // CIDv1 base32 values use the `b` multibase prefix. Pinata may return
  // bafy..., bafk..., or another valid CIDv1 codec prefix; do not restrict
  // this check to one codec while retaining strict CID formatting.
  return /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/.test(value);
}

export function isAcceptedFranchiseMetadataUri(value: string): boolean {
  return isAcceptedMetadataUri(value);
}

function nestedErrorData(error: unknown): string | null {
  const detail = error as { data?: unknown; error?: { data?: unknown }; info?: { error?: { data?: unknown } } };
  for (const candidate of [detail?.data, detail?.error?.data, detail?.info?.error?.data]) {
    if (typeof candidate === 'string' && /^0x[\da-fA-F]+$/.test(candidate)) return candidate;
  }
  return null;
}

/** Produces user-safe messages without disguising wallet or contract failures. */
export function franchiseErrorMessage(error: unknown): string {
  const detail = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; info?: { error?: { code?: string | number; message?: string } } };
  const code = detail?.code ?? detail?.info?.error?.code;
  const message = detail?.shortMessage || detail?.reason || detail?.message || detail?.info?.error?.message || 'Franchise transaction failed.';
  if (code === 'ACTION_REJECTED' || code === 4001 || code === '4001' || /user rejected|user denied/i.test(message)) {
    return 'Transaction rejected in MetaMask. No on-chain state was changed.';
  }
  if (/insufficient funds|insufficient balance/i.test(message)) return 'Insufficient ETH to pay network gas.';
  const data = nestedErrorData(error);
  if (data) {
    try {
      const decoded = franchiseInterface.parseError(data);
      if (decoded?.name === 'AccessControlUnauthorizedAccount') return 'The connected wallet does not have the Franchise minter role.';
      if (decoded?.name === 'EnforcedPause') return 'FranchiseNFT is paused.';
      return `FranchiseNFT reverted: ${decoded?.name || 'unknown custom error'}.`;
    } catch {
      // The original provider message remains more accurate for undecodable data.
    }
  }
  if (/Territory already minted/i.test(message)) return 'This territory code is already assigned to a Franchise NFT.';
  if (/Territory code required/i.test(message)) return 'A territory code is required.';
  if (/Invalid franchisee address/i.test(message)) return 'The franchisee wallet address is invalid.';
  return message;
}

export function waitForFranchiseReceipt(receipt: { status?: number | null } | null, label: string) {
  if (!receipt || receipt.status !== 1) throw new Error(`${label} was reverted or not confirmed on-chain.`);
  return receipt;
}

/** The canonical localhost RPC establishes manifest consistency before every direct read/write. */
export async function assertFranchiseDeployment(
  deploymentProvider: Pick<typeof canonicalProvider, 'getCode' | 'getNetwork'> = canonicalProvider,
) {
  const network = await deploymentProvider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Canonical FranchiseNFT RPC is not Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}).`);
  }
  const address = franchiseAddress();
  const code = await deploymentProvider.getCode(address);
  if (!hasBytecode(code)) {
    throw new Error(`No FranchiseNFT bytecode exists at ${address} on Hardhat Local (31337). The active local chain does not match deployments.json.`);
  }
  return address;
}

async function assertMarketplaceDeployment() {
  const address = marketplaceAddress();
  const code = await canonicalProvider.getCode(address);
  if (!hasBytecode(code)) throw new Error(`No NFTMarketplace bytecode exists at ${address} on Hardhat Local (31337). The active local chain does not match deployments.json.`);
  return address;
}

export async function assertFranchiseSignerNetwork(signer: Pick<Signer, 'provider'>) {
  const network = await signer.provider?.getNetwork();
  if (!network || network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Switch MetaMask to Hardhat Local (chain ${DEPLOYMENT_CHAIN_ID}) before using FranchiseNFT.`);
  }
}

async function signerForFranchise() {
  await assertFranchiseDeployment();
  const signer = await getSigner();
  await assertFranchiseSignerNetwork(signer);
  return signer;
}

async function assertEnoughEthForGas(signer: Signer, estimatedGas: bigint) {
  const provider = signer.provider;
  if (!provider) throw new Error('MetaMask provider is unavailable. Reconnect the wallet and try again.');
  const [balance, feeData] = await Promise.all([provider.getBalance(await signer.getAddress()), provider.getFeeData()]);
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  if (balance < estimatedGas * gasPrice || (balance === 0n && estimatedGas > 0n)) {
    throw new Error('Insufficient ETH to pay network gas.');
  }
}

function toBigIntInput(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole non-negative number.`);
  return BigInt(value);
}

function levelName(level: number): string {
  return ['World', 'Continent', 'Country', 'State', 'Zone', 'District', 'Pincode', 'Area', 'Locality'][level] || 'Unavailable';
}

function statusName(status: bigint | number): FranchiseStatus {
  return statusNames[Number(status)] || 'Unavailable';
}

type FranchiseReadContract = {
  filters: { Transfer: (from?: string | null, to?: string | null, tokenId?: bigint | null) => unknown };
  queryFilter: (filter: unknown, fromBlock?: number | string, toBlock?: number | string) => Promise<any[]>;
  ownerOf: (tokenId: bigint) => Promise<string>;
  getFranchiseDetails: (tokenId: bigint) => Promise<any>;
  tokenURI: (tokenId: bigint) => Promise<string>;
  isTransferLocked: (tokenId: bigint) => Promise<boolean>;
  MINTER_ROLE: () => Promise<string>;
  hasRole: (role: string, account: string) => Promise<boolean>;
};

async function readFranchiseRecord(
  contract: FranchiseReadContract,
  tokenId: bigint,
  latestTimestamp: bigint,
  mintEvent?: { transactionHash?: string; blockNumber?: number },
): Promise<FranchiseRecord | null> {
  const [owner, details, tokenUri, transferLocked] = await Promise.all([
    contract.ownerOf(tokenId).catch(() => null),
    contract.getFranchiseDetails(tokenId).catch(() => null),
    contract.tokenURI(tokenId).catch(() => ''),
    contract.isTransferLocked(tokenId).catch(() => false),
  ]);
  if (!owner || !details) return null;
  const expiry = BigInt(details.lockExpiryTimestamp);
  return {
    tokenId: tokenId.toString(),
    franchiseName: String(details.franchiseName),
    territoryCode: String(details.territoryCode),
    territoryName: String(details.territoryName),
    level: levelName(Number(details.level)),
    legionNFTId: BigInt(details.legionNFTId).toString(),
    owner: String(owner),
    priceUSD: BigInt(details.priceUSD).toString(),
    commissionBps: BigInt(details.commissionBps).toString(),
    purchaseTimestamp: BigInt(details.purchaseTimestamp).toString(),
    lockExpiryTimestamp: expiry.toString(),
    remainingLockSeconds: expiry > latestTimestamp ? (expiry - latestTimestamp).toString() : '0',
    transferLocked: Boolean(transferLocked),
    status: statusName(details.status),
    tokenUri,
    ipfsCID: String(details.ipfsCID),
    mintTransactionHash: mintEvent?.transactionHash || null,
    mintBlockNumber: mintEvent?.blockNumber?.toString() || null,
  };
}

/**
 * FranchiseNFT is not enumerable. Current ownership is derived from the
 * contract's Transfer logs and rechecked with ownerOf, never from mock data.
 */
export async function getFranchiseSnapshot(
  walletAddress: string,
  options: {
    deploymentProvider?: Pick<typeof canonicalProvider, 'getCode' | 'getNetwork' | 'getBlock'>;
    contract?: FranchiseReadContract;
    deploymentBlock?: number;
  } = {},
): Promise<FranchiseSnapshot> {
  if (!isAddress(walletAddress)) throw new Error('Connected wallet address is invalid.');
  const deploymentProvider = options.deploymentProvider || canonicalProvider;
  const address = await assertFranchiseDeployment(deploymentProvider);
  const contract = options.contract || new Contract(address, FranchiseArtifact.abi, canonicalProvider) as unknown as FranchiseReadContract;
  const deploymentBlock = options.deploymentBlock ?? Number(deploymentManifest.contracts.FranchiseNFT.deploymentBlock);
  const [received, mintEvents, latestBlock, minterRole] = await Promise.all([
    contract.queryFilter(contract.filters.Transfer(null, walletAddress, null), deploymentBlock, 'latest'),
    contract.queryFilter(contract.filters.Transfer(ZERO_ADDRESS, null, null), deploymentBlock, 'latest'),
    deploymentProvider.getBlock('latest'),
    contract.MINTER_ROLE(),
  ]);
  if (!latestBlock) throw new Error('Canonical RPC did not return the latest block for FranchiseNFT state.');
  const mintsByTokenId = new Map(mintEvents.map((event) => [BigInt(event.args?.tokenId ?? event.args?.[2]).toString(), event]));
  const tokenIds = [...new Set(received.map((event) => BigInt(event.args?.tokenId ?? event.args?.[2]).toString()))].map(BigInt);
  const records = (await Promise.all(tokenIds.map((tokenId) => readFranchiseRecord(contract, tokenId, BigInt(latestBlock.timestamp), mintsByTokenId.get(tokenId.toString()))))).filter((record): record is FranchiseRecord => Boolean(record));
  const owned = records.filter((record) => record.owner.toLowerCase() === walletAddress.toLowerCase()).sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  return { contractAddress: address, isMinter: await contract.hasRole(minterRole, walletAddress), franchises: owned };
}

export async function mintFranchise(input: MintFranchiseInput, onSubmitted?: TransactionSubmitted): Promise<{ transactionHash: string; tokenId: string | null }> {
  if (!isAddress(input.franchisee)) throw new Error('Franchisee wallet address is invalid.');
  if (!input.franchiseName.trim() || !input.territoryCode.trim() || !input.territoryName.trim()) throw new Error('Franchise name, territory code, and territory name are required.');
  if (!Number.isInteger(input.level) || input.level < 0 || input.level > 8) throw new Error('Territory level must be between 0 and 8.');
  if (!isAcceptedFranchiseMetadataUri(input.tokenURI.trim())) throw new Error('Metadata URI must come from configured NFT storage.');
  const localStorageUri = input.tokenURI.startsWith('http://127.0.0.1:5000/uploads/nft-assets/') || input.tokenURI.startsWith('http://localhost:5000/uploads/nft-assets/');
  if (!localStorageUri && !isValidIpfsCid(input.ipfsCID.trim())) throw new Error('IPFS CID must be returned by configured production storage.');
  if (localStorageUri && input.ipfsCID.trim()) throw new Error('Local development storage does not provide an IPFS CID.');
  const legionNFTId = toBigIntInput(input.legionNFTId, 'Linked Legion NFT ID');
  const priceUSD = toBigIntInput(input.priceUSD, 'Recorded price USD');
  const commissionBps = toBigIntInput(input.commissionBps, 'Recorded commission BPS');
  if (commissionBps > 10_000n) throw new Error('Recorded commission BPS cannot exceed 10,000.');

  const signer = await signerForFranchise();
  const address = franchiseAddress();
  const contract = new Contract(address, FranchiseArtifact.abi, signer);
  const [minterRole, signerAddress] = await Promise.all([contract.MINTER_ROLE(), signer.getAddress()]);
  if (!await contract.hasRole(minterRole, signerAddress)) {
    throw new Error('The connected wallet does not have MINTER_ROLE on FranchiseNFT.');
  }
  const args = [input.franchisee, input.franchiseName.trim(), input.territoryCode.trim(), input.territoryName.trim(), input.level, legionNFTId, priceUSD, commissionBps, input.tokenURI.trim(), input.ipfsCID.trim()] as const;
  let estimatedGas: bigint;
  try {
    estimatedGas = await contract.mintFranchise.estimateGas(...args);
  } catch (error) {
    throw new Error(franchiseErrorMessage(error));
  }
  await assertEnoughEthForGas(signer, estimatedGas);
  let transaction: any;
  try {
    transaction = await contract.mintFranchise(...args);
  } catch (error) {
    throw new Error(franchiseErrorMessage(error));
  }
  onSubmitted?.(transaction.hash, 'Franchise mint');
  const receipt = waitForFranchiseReceipt(await transaction.wait(), 'Franchise mint') as any;
  let tokenId: string | null = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = franchiseInterface.parseLog(log);
      if (parsed?.name === 'FranchiseNFTMinted') tokenId = BigInt(parsed.args.franchiseId).toString();
    } catch {
      // Ignore unrelated logs.
    }
  }
  return { transactionHash: transaction.hash, tokenId };
}

export async function listFranchiseOnMarketplace(
  tokenIdInput: string,
  priceEth: string,
  onSubmitted?: TransactionSubmitted,
): Promise<{ transactionHash: string; listingId: string | null }> {
  if (!/^\d+$/.test(tokenIdInput) || BigInt(tokenIdInput) === 0n) throw new Error('Enter a valid FranchiseNFT token ID.');
  if (!/^\d+(?:\.\d+)?$/.test(priceEth) || Number(priceEth) <= 0) throw new Error('Enter a positive ETH listing price.');

  const signer = await signerForFranchise();
  const marketplace = await assertMarketplaceDeployment();
  const franchise = new Contract(franchiseAddress(), FranchiseArtifact.abi, signer);
  const market = new Contract(marketplace, MarketplaceArtifact.abi, signer);
  const tokenId = BigInt(tokenIdInput);
  const owner = await signer.getAddress();
  if ((await franchise.ownerOf(tokenId)).toLowerCase() !== owner.toLowerCase()) throw new Error('The connected wallet does not own this FranchiseNFT.');
  if (await franchise.isTransferLocked(tokenId)) throw new Error('This Franchise NFT is currently under the protocol transfer lock.');

  const [approved, approvedForAll] = await Promise.all([
    franchise.getApproved(tokenId),
    franchise.isApprovedForAll(owner, marketplace),
  ]);
  if (approved.toLowerCase() !== marketplace.toLowerCase() && !approvedForAll) {
    let approvalGas: bigint;
    try { approvalGas = await franchise.approve.estimateGas(marketplace, tokenId); } catch (error) { throw new Error(franchiseErrorMessage(error)); }
    await assertEnoughEthForGas(signer, approvalGas);
    let approval: any;
    try { approval = await franchise.approve(marketplace, tokenId); } catch (error) { throw new Error(franchiseErrorMessage(error)); }
    onSubmitted?.(approval.hash, 'FranchiseNFT marketplace approval');
    waitForFranchiseReceipt(await approval.wait(), 'FranchiseNFT marketplace approval');
  }

  const price = parseEther(priceEth);
  let listingGas: bigint;
  try { listingGas = await market.listNFT.estimateGas(franchiseAddress(), tokenId, price); } catch (error) { throw new Error(franchiseErrorMessage(error)); }
  await assertEnoughEthForGas(signer, listingGas);
  let transaction: any;
  try { transaction = await market.listNFT(franchiseAddress(), tokenId, price); } catch (error) { throw new Error(franchiseErrorMessage(error)); }
  onSubmitted?.(transaction.hash, 'FranchiseNFT marketplace listing');
  const receipt: any = waitForFranchiseReceipt(await transaction.wait(), 'FranchiseNFT marketplace listing');
  const marketInterface = new Interface(MarketplaceArtifact.abi);
  let listingId: string | null = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = marketInterface.parseLog(log);
      if (parsed?.name === 'NFTListed') listingId = BigInt(parsed.args.listingId).toString();
    } catch { /* unrelated log */ }
  }
  return { transactionHash: transaction.hash, listingId };
}
