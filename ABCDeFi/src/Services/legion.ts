import { Contract, Interface, isAddress, Signer } from 'ethers';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID, requireContractAddress } from '../Config/contracts';
import { provider as canonicalProvider } from './contractProvider';
import { getSigner } from './wallet';
import LegionArtifact from '../../artifacts/contracts/LegionNFT.sol/LegionNFT.json';
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
}

export interface MintLegionInput {
  recipient: string;
  name: string;
  territory: string;
  level: number;
  parentId: string;
  character: string;
  metadataURI: string;
  population: string;
  treasuryShareBps: string;
}

export type LegionTransactionSubmitted = (hash: string, stage: string) => void;

const legionInterface = new Interface(LegionArtifact.abi);
const levelNames: LegionLevel[] = ['Continent', 'Country', 'State', 'District'];

/** A real ERC-721 metadata reference is required; placeholders are not accepted. */
export function isAcceptedLegionMetadataUri(value: string): boolean {
  return isAcceptedMetadataUri(value);
}

function legionAddress() {
  return requireContractAddress('legionNFT');
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
  options: { deploymentProvider?: Pick<typeof canonicalProvider, 'getCode' | 'getNetwork'>; contract?: LegionReadContract; deploymentBlock?: number } = {},
): Promise<LegionSnapshot> {
  if (!isAddress(walletAddress)) throw new Error('Connected wallet address is invalid.');
  const deploymentProvider = options.deploymentProvider || canonicalProvider;
  const address = await assertLegionDeployment(deploymentProvider);
  const contract = options.contract || new Contract(address, LegionArtifact.abi, canonicalProvider) as unknown as LegionReadContract;
  const deploymentBlock = options.deploymentBlock ?? Number(deploymentManifest.contracts.LegionNFT.deploymentBlock);
  if (!Number.isInteger(deploymentBlock) || deploymentBlock < 0) throw new Error('LegionNFT deployment block is unavailable from deployments.json.');
  const [received, minterRole, paused] = await Promise.all([
    contract.queryFilter(contract.filters.Transfer(null, walletAddress, null), deploymentBlock, 'latest'), contract.MINTER_ROLE(), contract.paused(),
  ]);
  const tokenIds = [...new Set(received.map((event) => BigInt(event.args?.tokenId ?? event.args?.[2]).toString()))].map(BigInt);
  const records = (await Promise.all(tokenIds.map((tokenId) => readLegionRecord(contract, tokenId)))).filter((record): record is LegionRecord => Boolean(record));
  const legions = records.filter((record) => record.owner.toLowerCase() === walletAddress.toLowerCase()).sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  return { contractAddress: address, isMinter: await contract.hasRole(minterRole, walletAddress), paused: Boolean(paused), legions };
}

export async function mintLegion(input: MintLegionInput, onSubmitted?: LegionTransactionSubmitted): Promise<{ transactionHash: string; tokenId: string | null }> {
  if (!isAddress(input.recipient)) throw new Error('Recipient wallet address is invalid.');
  if (!input.name.trim() || !input.territory.trim() || !input.character.trim()) throw new Error('Name, territory, and character are required.');
  if (!isAcceptedLegionMetadataUri(input.metadataURI.trim())) throw new Error('Metadata URI must be an explicit HTTPS or ipfs:// ERC-721 metadata URI.');
  if (!Number.isInteger(input.level) || input.level < 0 || input.level > 3) throw new Error('Legion level must be between 0 (Continent) and 3 (District).');
  const parentId = toUnsigned(input.parentId, 'Parent token ID');
  if ((input.level === 0 && parentId !== 0n) || (input.level > 0 && parentId === 0n)) throw new Error(input.level === 0 ? 'A Continent Legion must use parent token ID 0.' : 'Country, State, and District Legions require a parent token ID.');
  const population = toUnsigned(input.population, 'Population');
  const treasuryShareBps = toUnsigned(input.treasuryShareBps, 'Treasury share BPS');
  if (treasuryShareBps > 10_000n) throw new Error('Treasury share BPS cannot exceed 10,000.');

  const signer = await signerForLegion();
  const contract = new Contract(legionAddress(), LegionArtifact.abi, signer);
  const [minterRole, signerAddress] = await Promise.all([contract.MINTER_ROLE(), signer.getAddress()]);
  if (!await contract.hasRole(minterRole, signerAddress)) {
    throw new Error('The connected wallet does not have MINTER_ROLE on LegionNFT.');
  }
  const args = [input.recipient, input.name.trim(), input.territory.trim(), input.level, parentId, input.character.trim(), input.metadataURI.trim(), population, treasuryShareBps] as const;
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
