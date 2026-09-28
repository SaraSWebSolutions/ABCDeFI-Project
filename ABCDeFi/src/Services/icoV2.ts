import { Contract, Interface, formatEther, parseEther } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, ICO_V2_CONTRACT } from '../Config/contracts';
import { assertCanonicalContractDeployment, provider as canonicalProvider } from './contractProvider';
import { getProvider, getSigner } from './wallet';

export const ICO_V2_ABI = [
  'function lifecycle() view returns (uint8)',
  'function stage(uint8) view returns (uint256 startTime,uint256 endTime,uint256 inventory,uint256 sold,uint256 priceUsdWad)',
  'function totalAllocated() view returns (uint256)',
  'function totalBnbCollected() view returns (uint256)',
  'function tgeTimestamp() view returns (uint256)',
  'function purchaseOf(address) view returns (uint256 allocation,uint256 bnbPaid,uint256 claimed,uint256 stageOneAllocation,uint256 stageTwoAllocation,bool refunded)',
  'function claimable(address) view returns (uint256)',
  'function eligibleWallet(address) view returns (bool)',
  'function currentStage() view returns (uint8)',
  'function buy(uint8 stageId,uint256 requestedAllocation) payable',
  'function claim()',
  'function claimRefund()',
];

export type IcoV2Snapshot = {
  lifecycle: 'Pending' | 'Active' | 'Finalized' | 'Cancelled' | 'Unknown';
  stages: Array<{ startTime: string; endTime: string; inventory: string; sold: string; priceUsdWad: string }>;
  totalAllocated: string;
  totalBnbCollected: string;
  tgeTimestamp: string;
  purchase: null | { allocation: string; bnbPaid: string; claimed: string; refunded: boolean; vestedTotal: string; claimableNow: string };
};
export type IcoV2Transaction = { hash: string; blockNumber: string };
export type IcoV2IndexedSnapshot = IcoV2Snapshot & { manifest: { chainId: number; deploymentVersion: string; address: string }; checkpoint: { lastProcessedBlock: string; lastProcessedBlockHash: string }; paused: boolean; oracle: { feed: string; feedDecimals: string; maxPriceAge: string }; eligibility: boolean; history: Array<{ eventName: string; blockNumber: string; logIndex: number; transactionHash: string; args: Record<string, string> }> };

const lifecycle = (value: bigint): IcoV2Snapshot['lifecycle'] => {
  const labels = ['Pending', 'Active', 'Finalized', 'Cancelled'] as const;
  return labels[Number(value)] ?? 'Unknown';
};

function address() {
  if (!ICO_V2_CONTRACT) throw new Error('ICOManagerV2 is not configured in the canonical deployment manifest. Legacy Presale data is intentionally unavailable here.');
  return ICO_V2_CONTRACT;
}

async function readContract() {
  const value = address();
  await assertCanonicalContractDeployment('ICOManagerV2', value);
  return new Contract(value, ICO_V2_ABI, canonicalProvider);
}

async function writeContract() {
  const [contract, walletProvider, signer] = await Promise.all([readContract(), getProvider(), getSigner()]);
  if ((await walletProvider.getNetwork()).chainId !== DEPLOYMENT_CHAIN_ID) throw new Error('Switch MetaMask to the canonical configured chain before participating in the ICO.');
  return contract.connect(signer) as any;
}

async function confirmed(action: string, send: () => Promise<any>, onSubmitted?: (hash: string) => void): Promise<IcoV2Transaction> {
  const tx = await send();
  onSubmitted?.(tx.hash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${action} failed on-chain.`);
  return { hash: tx.hash, blockNumber: String(receipt.blockNumber) };
}

export async function getIcoV2Snapshot(account?: string): Promise<IcoV2Snapshot> {
  const contract = await readContract();
  const common = await Promise.all([contract.lifecycle(), contract.stage(0), contract.stage(1), contract.totalAllocated(), contract.totalBnbCollected(), contract.tgeTimestamp()]);
  const purchase = account ? await Promise.all([contract.purchaseOf(account), contract.claimable(account)]) : null;
  const vestedTotal = purchase ? purchase[1] : 0n;
  const claimableNow = purchase && vestedTotal > purchase[0].claimed ? vestedTotal - purchase[0].claimed : 0n;
  return {
    lifecycle: lifecycle(common[0]),
    stages: [common[1], common[2]].map((stage: any) => ({ startTime: stage.startTime.toString(), endTime: stage.endTime.toString(), inventory: stage.inventory.toString(), sold: stage.sold.toString(), priceUsdWad: stage.priceUsdWad.toString() })),
    totalAllocated: common[3].toString(), totalBnbCollected: common[4].toString(), tgeTimestamp: common[5].toString(),
    purchase: purchase ? { allocation: purchase[0].allocation.toString(), bnbPaid: purchase[0].bnbPaid.toString(), claimed: purchase[0].claimed.toString(), refunded: Boolean(purchase[0].refunded), vestedTotal: vestedTotal.toString(), claimableNow: claimableNow.toString() } : null,
  };
}

/** Read state is checkpoint-gated: legacy ICO API data is never a fallback. */
export async function getIndexedIcoV2Snapshot(account?: string): Promise<IcoV2IndexedSnapshot> {
  const status = await fetch('/api/ico-v2/status'); const root = await status.json().catch(() => ({}));
  if (!status.ok || root.status !== 'AVAILABLE' || !root.manifest || !root.checkpoint) throw new Error(root.reason || 'Canonical ICO V2 indexed state is unavailable.');
  const buyer = account ? await fetch(`/api/ico-v2/buyers/${encodeURIComponent(account)}`) : null;
  const wallet = buyer ? await buyer.json().catch(() => ({})) : null;
  if (buyer && (!buyer.ok || wallet.status !== 'AVAILABLE')) throw new Error(wallet.reason || 'Canonical ICO V2 wallet state is unavailable.');
  const data = root.data; const purchase = wallet?.data?.purchase;
  return { lifecycle: lifecycle(BigInt(data.lifecycle)), stages: data.stages.map((stage: any) => ({ startTime:String(stage.startTime),endTime:String(stage.endTime),inventory:String(stage.inventory),sold:String(stage.sold),priceUsdWad:String(stage.priceUsdWad) })), totalAllocated:String(data.totalAllocated), totalBnbCollected:String(data.totalBnbCollected), tgeTimestamp:String(data.tgeTimestamp), purchase: purchase ? { allocation:String(purchase.allocation), bnbPaid:String(purchase.bnbPaid), claimed:String(purchase.claimed), refunded:Boolean(purchase.refunded), vestedTotal:String(wallet.data.vestedTotal), claimableNow:String(wallet.data.claimableNow) } : null, manifest: root.manifest, checkpoint: root.checkpoint, paused:Boolean(data.paused), oracle:data.oracle, eligibility:Boolean(wallet?.data?.eligibility ?? false), history:wallet?.data?.history || [] };
}

export async function buyIcoV2(stageId: 0 | 1, allocation: string, bnbAmount: string, onSubmitted?: (hash: string) => void) {
  const value = parseEther(bnbAmount);
  const requestedAllocation = parseEther(allocation);
  if (value <= 0n || requestedAllocation <= 0n) throw new Error('BNB contribution and requested ABCD allocation must be greater than zero.');
  const contract = await writeContract();
  return confirmed('ICO purchase', () => contract.buy(stageId, requestedAllocation, { value }), onSubmitted);
}

export async function claimIcoV2(onSubmitted?: (hash: string) => void) {
  const contract = await writeContract();
  return confirmed('ICO vesting claim', () => contract.claim(), onSubmitted);
}

export async function refundIcoV2(onSubmitted?: (hash: string) => void) {
  const contract = await writeContract();
  return confirmed('ICO cancellation refund', () => contract.claimRefund(), onSubmitted);
}

export function icoV2ErrorMessage(error: unknown) {
  const item = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string; data?: string };
  const message = item.shortMessage || item.reason || item.message || 'ICO transaction failed.';
  if (item.code === 4001 || item.code === 'ACTION_REJECTED' || /rejected|denied/i.test(message)) return 'Transaction rejected in MetaMask.';
  if (item.data) try { return `Contract reverted: ${new Interface(ICO_V2_ABI).parseError(item.data)?.name || 'unknown error'}.`; } catch { /* use original message */ }
  return message;
}

export const icoV2Amount = (value: string) => formatEther(value);
