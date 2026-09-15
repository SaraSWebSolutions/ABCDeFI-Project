export type FranchiseStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type FranchiseEvent = { eventName: string; args?: Record<string, unknown>; evidence: { blockNumber: string; transactionHash: string; logIndex: number } };
export type FranchiseCertificate = { tokenId: string; owner: string; territoryKey: string; level: string; status: string; operatorVersion: string; metadataURI: string };
export type FranchiseSource = { kind: 'canonical-indexed-on-chain'; chainId: string; nftAddress: string; registryAddress: string; deploymentVersion: string };
export type FranchiseAvailability = { available: boolean; status: 'AVAILABLE' | 'UNAVAILABLE'; checkpoint?: string | null; reason?: string; source?: FranchiseSource };
type Envelope<T> = FranchiseAvailability & { data?: T; message?: string };
type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const api = '/api/franchise';
const wallet = /^0x[a-fA-F0-9]{40}$/;
const levels = ['CONTINENTAL', 'NATIONAL', 'STATE', 'DISTRICT'];
const statuses: FranchiseStatus[] = ['ACTIVE', 'SUSPENDED', 'REVOKED'];

function normalizeCertificate(value: FranchiseCertificate): FranchiseCertificate {
  const level = levels[Number(value.level)] || 'UNAVAILABLE';
  const status = statuses[Number(value.status)] || 'UNAVAILABLE';
  return { ...value, level, status };
}
async function read<T>(url: string, fetcher: FetchLike): Promise<Envelope<T>> {
  const response = await fetcher(url); const body = await response.json().catch(() => ({})) as Envelope<T>;
  if (!response.ok) throw new Error(body.reason || body.message || `Franchise registry API request failed (${response.status}).`);
  return body;
}
export async function getFranchiseAvailability(fetcher: FetchLike = fetch): Promise<FranchiseAvailability> {
  const body = await read<null>(`${api}/status`, fetcher); return { available: Boolean(body.available), status: body.status, checkpoint: body.checkpoint, reason: body.reason, source: body.source };
}
export async function getFranchiseWalletSnapshot(address: string, fetcher: FetchLike = fetch): Promise<FranchiseAvailability & { franchises: FranchiseCertificate[]; history: Record<string, FranchiseEvent[]> }> {
  if (!wallet.test(address)) throw new Error('Connected wallet address is invalid.');
  const availability = await getFranchiseAvailability(fetcher);
  if (!availability.available) return { ...availability, franchises: [], history: {} };
  const response = await read<FranchiseCertificate[]>(`${api}/wallet/${encodeURIComponent(address)}`, fetcher);
  const franchises = (response.data || []).map(normalizeCertificate);
  const history = Object.fromEntries(await Promise.all(franchises.map(async (franchise) => [franchise.tokenId, (await read<FranchiseEvent[]>(`${api}/${franchise.tokenId}/history`, fetcher)).data || []])));
  return { ...availability, franchises, history };
}
