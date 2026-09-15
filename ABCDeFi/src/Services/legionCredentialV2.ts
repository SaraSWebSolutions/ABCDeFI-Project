export type LegionCredentialStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type LegionCredentialEvidence = {
  transactionHash: string;
  blockNumber: string;
  logIndex: number;
  blockHash: string;
  eventName: string;
};
export type LegionCredential = {
  tokenId: string;
  owner: string;
  active: boolean;
  status: LegionCredentialStatus;
  category: string;
  metadataURI: string;
  issuedAt: string;
  updatedAt: string;
  mintEvidence?: LegionCredentialEvidence;
  latestEvidence?: LegionCredentialEvidence;
};
export type LegionCredentialEvent = {
  tokenId: string;
  eventName: string;
  args: Record<string, string>;
  blockNumber: string;
  transactionHash: string;
  logIndex: number;
};
export type LegionCredentialAvailability = {
  available: boolean;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNDEPLOYED';
  reason?: string;
  checkpoint?: string | null;
};
export type LegionCredentialSnapshot = LegionCredentialAvailability & {
  credentials: LegionCredential[];
  history: Record<string, LegionCredentialEvent[]>;
};

const walletPattern = /^0x[a-fA-F0-9]{40}$/;
const api = '/api/legion-v2';

export const legionCredentialWalletEndpoint = (wallet: string) => `${api}/wallet/${encodeURIComponent(wallet)}`;
export const legionCredentialEndpoint = (tokenId: string) => `${api}/credentials/${encodeURIComponent(tokenId)}`;
export const legionCredentialHistoryEndpoint = (tokenId: string) => `${legionCredentialEndpoint(tokenId)}/history`;

type FetchLike = (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
type ApiEnvelope<T> = LegionCredentialAvailability & { data?: T; message?: string };

async function read<T>(endpoint: string, fetcher: FetchLike): Promise<ApiEnvelope<T>> {
  const response = await fetcher(endpoint);
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(payload.reason || payload.message || `Legion credential API request failed (${response.status}).`);
  }
  return payload;
}

/** Reads only the canonical backend/indexer availability state. */
export async function getLegionCredentialAvailability(fetcher: FetchLike = fetch): Promise<LegionCredentialAvailability> {
  const payload = await read<null>(`${api}/status`, fetcher);
  return { available: Boolean(payload.available), status: payload.status, reason: payload.reason, checkpoint: payload.checkpoint };
}

/** Reads a wallet's canonical, indexed LegionCredentialV2 records; no local fallback exists. */
export async function getLegionCredentialSnapshot(wallet: string, fetcher: FetchLike = fetch): Promise<LegionCredentialSnapshot> {
  if (!walletPattern.test(wallet)) throw new Error('Connected wallet address is invalid.');
  const availability = await getLegionCredentialAvailability(fetcher);
  if (!availability.available) return { ...availability, credentials: [], history: {} };
  const walletPayload = await read<LegionCredential[]>(legionCredentialWalletEndpoint(wallet), fetcher);
  const credentials = Array.isArray(walletPayload.data) ? walletPayload.data : [];
  const history = Object.fromEntries(await Promise.all(credentials.map(async (credential) => {
    const payload = await read<LegionCredentialEvent[]>(legionCredentialHistoryEndpoint(credential.tokenId), fetcher);
    return [credential.tokenId, Array.isArray(payload.data) ? payload.data : []];
  })));
  return { ...availability, credentials, history };
}

/** A future restricted admin write must not treat submission or a failed receipt as success. */
export function requireLegionCredentialReceipt(receipt: { status?: number | bigint | null } | null | undefined, action: string) {
  if (!receipt || Number(receipt.status) !== 1) throw new Error(`${action} was reverted or not confirmed on-chain.`);
  return receipt;
}

export function legionCredentialErrorMessage(error: unknown) {
  const value = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string };
  const message = value.shortMessage || value.reason || value.message || 'Legion credential request failed.';
  return value.code === 4001 || value.code === 'ACTION_REJECTED' || /rejected|denied/i.test(message)
    ? 'Transaction rejected in MetaMask. No on-chain state was changed.' : message;
}
