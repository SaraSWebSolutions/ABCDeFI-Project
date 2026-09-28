export type TreasuryAsset = { asset: string; supported: boolean; accountedBalance: string };
export type TreasuryHistoryEvent = { eventName: string; blockNumber: string; transactionHash: string; logIndex: number; args: Record<string, unknown>; indexedAt?: string };
export type TreasurySnapshot = { available: boolean; status: 'AVAILABLE' | 'UNAVAILABLE'; checkpoint?: string | null; reason?: string; source?: { chainId: string; treasuryAddress: string; abcdAddress: string }; assets: TreasuryAsset[]; history: TreasuryHistoryEvent[] };

const api = '/api/treasury-v2';
const responseJson = async (path: string) => { const response = await fetch(`${api}${path}`); const body = await response.json(); if (!response.ok && body?.status !== 'UNAVAILABLE') throw new Error(body?.message || 'Treasury API request failed.'); return body; };

export async function getTreasuryV2Snapshot(): Promise<TreasurySnapshot> {
  const status = await responseJson('/status');
  if (!status.available) return { available: false, status: 'UNAVAILABLE', checkpoint: status.checkpoint, reason: status.reason, source: status.source, assets: [], history: [] };
  const [assets, history] = await Promise.all([responseJson('/assets'), responseJson('/history')]);
  if (!assets.available || !history.available) return { available: false, status: 'UNAVAILABLE', checkpoint: status.checkpoint, reason: assets.reason || history.reason, source: status.source, assets: [], history: [] };
  const orderedHistory = Array.isArray(history.data) ? history.data.slice().sort((left: TreasuryHistoryEvent, right: TreasuryHistoryEvent) => Number(left.blockNumber) - Number(right.blockNumber) || Number(left.logIndex) - Number(right.logIndex)) : [];
  return { available: true, status: 'AVAILABLE', checkpoint: status.checkpoint, source: status.source, assets: Array.isArray(assets.data) ? assets.data : [], history: orderedHistory };
}
