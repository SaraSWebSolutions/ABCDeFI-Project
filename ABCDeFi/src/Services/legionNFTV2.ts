import { Contract, Interface, isAddress } from 'ethers';
import LegionNFTV2Artifact from '../../artifacts/contracts/nft/LegionNFTV2.sol/LegionNFTV2.json';
import { getSigner } from './wallet';

export type LegionNFTV2Level = 'COUNTRY' | 'STATE' | 'DISTRICT';
export type LegionNFTV2Event = { eventName: string; blockNumber: string; transactionHash: string; logIndex: number; args: Record<string, string> };
export type LegionNFTV2TransferRequest = { requestId: string; tokenId: string; currentOwner: string; proposedOwner: string; active: boolean; approved: boolean };
export type LegionNFTV2Territory = { tokenId: string; owner: string; level: LegionNFTV2Level; parentId: string; population: string; displayName: string; canonicalIdentifier: string; metadataURI: string; territoryKey: string; activeTransferRequestId: string };
export type LegionNFTV2Availability = { available: boolean; status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNDEPLOYED'; paused: boolean; checkpoint?: string | null; reason?: string; source?: { chainId: string; contractAddress: string; deploymentVersion: string }; roles?: Record<string, string> };
export type LegionNFTV2Snapshot = LegionNFTV2Availability & { territories: LegionNFTV2Territory[]; history: Record<string, LegionNFTV2Event[]>; requests: Record<string, LegionNFTV2TransferRequest> };
type Envelope<T> = LegionNFTV2Availability & { data?: T; message?: string };
type FetchLike = (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
const api = '/api/legion-nft-v2';
const walletPattern = /^0x[a-fA-F0-9]{40}$/;

async function read<T>(url: string, fetcher: FetchLike): Promise<Envelope<T>> { const response = await fetcher(url); const body = await response.json().catch(() => ({})) as Envelope<T>; if (!response.ok) throw new Error(body.reason || body.message || `LegionNFTV2 API request failed (${response.status}).`); return body; }
export async function getLegionNFTV2Availability(fetcher: FetchLike = fetch): Promise<LegionNFTV2Availability> { const body = await read<null>(`${api}/status`, fetcher); return { available: Boolean(body.available), status: body.status, paused: Boolean(body.paused), checkpoint: body.checkpoint, reason: body.reason, source: body.source, roles: body.roles }; }
export async function getLegionNFTV2Snapshot(wallet: string, fetcher: FetchLike = fetch): Promise<LegionNFTV2Snapshot> {
  if (!walletPattern.test(wallet)) throw new Error('Connected wallet address is invalid.');
  const availability = await getLegionNFTV2Availability(fetcher); if (!availability.available) return { ...availability, territories: [], history: {}, requests: {} };
  const payload = await read<LegionNFTV2Territory[]>(`${api}/wallet/${encodeURIComponent(wallet)}`, fetcher); const territories = Array.isArray(payload.data) ? payload.data : [];
  const history = Object.fromEntries(await Promise.all(territories.map(async (territory) => [territory.tokenId, (await read<LegionNFTV2Event[]>(`${api}/territories/${territory.tokenId}/history`, fetcher)).data || []])));
  const requestEntries = await Promise.all(territories.filter((territory) => territory.activeTransferRequestId !== '0').map(async (territory) => { const request = await read<LegionNFTV2TransferRequest>(`${api}/transfer-requests/${territory.activeTransferRequestId}`, fetcher); return [territory.tokenId, request.data] as const; }));
  return { ...availability, territories, history, requests: Object.fromEntries(requestEntries.filter(([, request]) => Boolean(request))) as Record<string, LegionNFTV2TransferRequest> };
}

function requireSource(availability: LegionNFTV2Availability) { if (!availability.available || !availability.source?.contractAddress || availability.source.chainId !== '31337') throw new Error(availability.reason || 'Canonical LegionNFTV2 is not available from the indexer.'); return availability.source.contractAddress; }
async function write(method: string, args: unknown[], label: string, onStage?: (stage: string, hash?: string) => void) { const availability = await getLegionNFTV2Availability(); const address = requireSource(availability); const signer = await getSigner(); const network = await signer.provider?.getNetwork(); if (network?.chainId !== 31337n) throw new Error('Switch MetaMask to Hardhat Local (31337) before a LegionNFTV2 action.'); const contract = new Contract(address, LegionNFTV2Artifact.abi, signer); onStage?.('Waiting for MetaMask confirmation'); const transaction = await contract[method](...args); onStage?.('Confirming on-chain receipt', transaction.hash); const receipt = await transaction.wait(); if (!receipt || Number(receipt.status) !== 1) throw new Error(`${label} reverted or was not confirmed on-chain.`); onStage?.('Confirmed', transaction.hash); return { hash: transaction.hash, receipt };
}
export async function requestLegionNFTV2Transfer(tokenId: string, proposedOwner: string, onStage?: (stage: string, hash?: string) => void) { if (!/^\d+$/.test(tokenId) || BigInt(tokenId) === 0n || !isAddress(proposedOwner)) throw new Error('A valid token ID and proposed operator address are required.'); return write('requestTransfer', [BigInt(tokenId), proposedOwner], 'Transfer request', onStage); }
export async function approveLegionNFTV2Transfer(requestId: string, onStage?: (stage: string, hash?: string) => void) { if (!/^\d+$/.test(requestId) || BigInt(requestId) === 0n) throw new Error('A valid request ID is required.'); return write('approveTransfer', [BigInt(requestId)], 'Transfer approval', onStage); }
export async function executeLegionNFTV2Transfer(requestId: string, onStage?: (stage: string, hash?: string) => void) { if (!/^\d+$/.test(requestId) || BigInt(requestId) === 0n) throw new Error('A valid request ID is required.'); return write('executeTransfer', [BigInt(requestId)], 'Transfer execution', onStage); }
export function legionNFTV2ErrorMessage(error: unknown) { const issue = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string }; const message = issue.shortMessage || issue.reason || issue.message || 'LegionNFTV2 action failed.'; return issue.code === 4001 || issue.code === 'ACTION_REJECTED' || /rejected|denied/i.test(message) ? 'Transaction rejected in MetaMask. No on-chain state changed.' : message; }
