import { BrowserProvider, Contract } from 'ethers';
import { ONE_Q_CONTRACTS } from '../Config/oneQRuntime';

export type FranchiseStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type FranchiseEvent = { eventName: string; args?: Record<string, unknown>; blockNumber: string; transactionIndex: number; logIndex: number; transactionHash: string };
export type FranchiseCertificate = { tokenId: string; legionContract: string; legionTokenId: string; owner: string; operator: string; status: FranchiseStatus; operatorVersion: string; metadataURI: string; activeTransferRequestId: string };
export type FranchiseApplication = { applicationId: string; applicant: string; legionTokenId: string; metadataURI: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'MINTED' };
export type FranchiseTransferRequest = { requestId: string; tokenId: string; currentOperator: string; proposedOperator: string; operatorVersion: string; active: boolean; approved: boolean };
export type FranchiseSource = { kind: 'canonical-indexed-on-chain'; chainId: string; legionAddress: string; nftAddress: string; registryAddress: string; deploymentVersion: string };
export type FranchiseAvailability = { available: boolean; status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNDEPLOYED'; checkpoint?: string | null; paused?: boolean; reason?: string; source?: FranchiseSource; roles?: Record<string, string> };
type Envelope<T> = FranchiseAvailability & { data?: T; page?: { nextCursor: string | null }; message?: string };
type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
const api = '/api/franchise-v2'; const wallet = /^0x[a-fA-F0-9]{40}$/;
const registryAbi = [
  'function submitApplication(uint256 legionTokenId,string metadataURI) returns (uint256)', 'function cancelApplication(uint256 applicationId)',
  'function requestTransfer(uint256 tokenId,address proposedOperator) returns (uint256)', 'function cancelTransfer(uint256 requestId)',
  'function approveApplication(uint256 applicationId)', 'function rejectApplication(uint256 applicationId)', 'function mintApprovedApplication(uint256 applicationId) returns (uint256)',
  'function approveTransfer(uint256 requestId)', 'function invalidateTransfer(uint256 requestId)', 'function suspend(uint256 tokenId)', 'function reactivate(uint256 tokenId)', 'function revoke(uint256 tokenId)', 'function updateMetadata(uint256 tokenId,string metadataURI)',
  'function hasRole(bytes32,address) view returns (bool)', 'function FRANCHISE_ADMIN_ROLE() view returns (bytes32)', 'function FRANCHISE_MINTER_ROLE() view returns (bytes32)', 'function FRANCHISE_TRANSFER_APPROVER_ROLE() view returns (bytes32)', 'function PAUSER_ROLE() view returns (bytes32)',
];
async function read<T>(url: string, fetcher: FetchLike): Promise<Envelope<T>> { const response = await fetcher(url); const body = await response.json().catch(() => ({})) as Envelope<T>; if (!response.ok) throw new Error(body.reason || body.message || `Canonical Franchise V2 API request failed (${response.status}).`); return body; }
async function readAll<T>(path: string, fetcher: FetchLike): Promise<T[]> {
  const records: T[] = []; let cursor: string | null = null;
  do { const separator = path.includes('?') ? '&' : '?'; const page: Envelope<T[]> = await read<T[]>(`${api}${path}${separator}limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, fetcher); records.push(...(page.data || [])); cursor = page.page?.nextCursor || null; } while (cursor);
  return records;
}
export async function getFranchiseAvailability(fetcher: FetchLike = fetch): Promise<FranchiseAvailability> { const body = await read<null>(`${api}/status`, fetcher); return { available: Boolean(body.available), status: body.status, checkpoint: body.checkpoint, paused: body.paused, reason: body.reason, source: body.source, roles: body.roles }; }
export async function getFranchiseWalletSnapshot(address: string, fetcher: FetchLike = fetch): Promise<FranchiseAvailability & { franchises: FranchiseCertificate[]; applications: FranchiseApplication[]; history: Record<string, FranchiseEvent[]> }> {
  if (!wallet.test(address)) throw new Error('Connected wallet address is invalid.'); const normalized = address.toLowerCase(); const availability = await getFranchiseAvailability(fetcher); if (!availability.available) return { ...availability, franchises: [], applications: [], history: {} };
  const [certificates, applications] = await Promise.all([read<FranchiseCertificate[]>(`${api}/wallet/${encodeURIComponent(normalized)}`, fetcher), read<FranchiseApplication[]>(`${api}/applications/wallet/${encodeURIComponent(normalized)}`, fetcher)]);
  const franchises = certificates.data || []; const history = Object.fromEntries(await Promise.all(franchises.map(async (item) => [item.tokenId, (await read<FranchiseEvent[]>(`${api}/franchises/${item.tokenId}/history`, fetcher)).data || []])));
  return { ...availability, franchises, applications: applications.data || [], history };
}
/** Admin lists are still API-read-only; every write below is authorized by a live Registry role. */
export async function getFranchiseAdminSnapshot(fetcher: FetchLike = fetch): Promise<FranchiseAvailability & { franchises: FranchiseCertificate[]; applications: FranchiseApplication[]; transferRequests: FranchiseTransferRequest[] }> {
  const availability = await getFranchiseAvailability(fetcher);
  if (!availability.available) return { ...availability, franchises: [], applications: [], transferRequests: [] };
  const [franchises, applications, transferRequests] = await Promise.all([
    readAll<FranchiseCertificate>('/franchises', fetcher),
    readAll<FranchiseApplication>('/applications', fetcher),
    readAll<FranchiseTransferRequest>('/transfer-requests', fetcher),
  ]);
  return { ...availability, franchises, applications, transferRequests };
}
function injectedEthereum(): unknown { return (window as Window & { ethereum?: unknown }).ethereum; }
async function writer(source: FranchiseSource) { if (source.legionAddress.toLowerCase() !== ONE_Q_CONTRACTS.LegionNFTV2.toLowerCase() || source.nftAddress.toLowerCase() !== ONE_Q_CONTRACTS.FranchiseNFTV2.toLowerCase() || source.registryAddress.toLowerCase() !== ONE_Q_CONTRACTS.FranchiseRegistryV2.toLowerCase()) throw new Error('Canonical Franchise V2 API source does not match the selected 1Q deployment.'); const injected = injectedEthereum(); if (!injected) throw new Error('Connect a browser wallet before submitting an on-chain Franchise V2 request.'); const provider = new BrowserProvider(injected as any); if ((await provider.getNetwork()).chainId !== BigInt(source.chainId)) throw new Error(`Switch wallet to chain ${source.chainId} before continuing.`); return new Contract(source.registryAddress, registryAbi, await provider.getSigner()); }
async function submit(source: FranchiseSource | undefined, action: (registry: Contract) => Promise<any>, onSubmitted?: (hash: string) => void) { if (!source) throw new Error('Canonical Franchise V2 deployment is unavailable.'); const transaction = await action(await writer(source)); onSubmitted?.(transaction.hash); const receipt = await transaction.wait(); if (!receipt || receipt.status !== 1) throw new Error('Franchise V2 transaction did not confirm successfully.'); return { transactionHash: transaction.hash, receipt }; }
export const submitFranchiseApplication = (source: FranchiseSource | undefined, legionTokenId: string, metadataURI: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.submitApplication(legionTokenId, metadataURI), onSubmitted);
export const cancelFranchiseApplication = (source: FranchiseSource | undefined, applicationId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.cancelApplication(applicationId), onSubmitted);
export const requestFranchiseTransfer = (source: FranchiseSource | undefined, tokenId: string, proposedOwner: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.requestTransfer(tokenId, proposedOwner), onSubmitted);
export const cancelFranchiseTransfer = (source: FranchiseSource | undefined, requestId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.cancelTransfer(requestId), onSubmitted);
export const approveFranchiseApplication = (source: FranchiseSource | undefined, applicationId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.approveApplication(applicationId), onSubmitted);
export const rejectFranchiseApplication = (source: FranchiseSource | undefined, applicationId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.rejectApplication(applicationId), onSubmitted);
export const mintApprovedFranchiseApplication = (source: FranchiseSource | undefined, applicationId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.mintApprovedApplication(applicationId), onSubmitted);
export const approveFranchiseTransfer = (source: FranchiseSource | undefined, requestId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.approveTransfer(requestId), onSubmitted);
export const invalidateFranchiseTransfer = (source: FranchiseSource | undefined, requestId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.invalidateTransfer(requestId), onSubmitted);
export const suspendFranchise = (source: FranchiseSource | undefined, tokenId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.suspend(tokenId), onSubmitted);
export const reactivateFranchise = (source: FranchiseSource | undefined, tokenId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.reactivate(tokenId), onSubmitted);
export const revokeFranchise = (source: FranchiseSource | undefined, tokenId: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.revoke(tokenId), onSubmitted);
export const updateFranchiseMetadata = (source: FranchiseSource | undefined, tokenId: string, metadataURI: string, onSubmitted?: (hash: string) => void) => submit(source, (registry) => registry.updateMetadata(tokenId, metadataURI), onSubmitted);
export async function getFranchiseRoleStatus(source: FranchiseSource | undefined, address: string | null) { if (!source || !address || !wallet.test(address)) return { wallet: address, roles: [] as { label: string; held: boolean }[] }; const injected = injectedEthereum(); if (!injected) return { wallet: address, roles: [] as { label: string; held: boolean }[] }; const provider = new BrowserProvider(injected as any); if ((await provider.getNetwork()).chainId !== BigInt(source.chainId)) return { wallet: address, roles: [] as { label: string; held: boolean }[] }; const registry = new Contract(source.registryAddress, registryAbi, provider); const roles = await Promise.all(['FRANCHISE_ADMIN_ROLE', 'FRANCHISE_MINTER_ROLE', 'FRANCHISE_TRANSFER_APPROVER_ROLE', 'PAUSER_ROLE'].map(async (label) => ({ label, held: Boolean(await registry.hasRole(await registry[label](), address)) }))); return { wallet: address.toLowerCase(), roles }; }
export const franchiseRegistryWrite = submit;
