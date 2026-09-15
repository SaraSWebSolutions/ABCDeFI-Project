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
  'function purchaseOf(address) view returns (uint256 allocation,uint256 bnbPaid,uint256 claimed,bool refunded)',
  'function claimable(address) view returns (uint256)',
  'function buy(uint8 stageId) payable',
  'function claim()',
  'function claimRefund()',
];

export type IcoV2Snapshot = {
  lifecycle: 'Pending' | 'Active' | 'Finalized' | 'Cancelled' | 'Unknown';
  stages: Array<{ startTime: string; endTime: string; inventory: string; sold: string; priceUsdWad: string }>;
  totalAllocated: string;
  totalBnbCollected: string;
  tgeTimestamp: string;
  purchase: null | { allocation: string; bnbPaid: string; claimed: string; refunded: boolean; claimable: string };
};
export type IcoV2Transaction = { hash: string; blockNumber: string };

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
  return {
    lifecycle: lifecycle(common[0]),
    stages: [common[1], common[2]].map((stage: any) => ({ startTime: stage.startTime.toString(), endTime: stage.endTime.toString(), inventory: stage.inventory.toString(), sold: stage.sold.toString(), priceUsdWad: stage.priceUsdWad.toString() })),
    totalAllocated: common[3].toString(), totalBnbCollected: common[4].toString(), tgeTimestamp: common[5].toString(),
    purchase: purchase ? { allocation: purchase[0].allocation.toString(), bnbPaid: purchase[0].bnbPaid.toString(), claimed: purchase[0].claimed.toString(), refunded: Boolean(purchase[0].refunded), claimable: purchase[1].toString() } : null,
  };
}

export async function buyIcoV2(stageId: 0 | 1, bnbAmount: string, onSubmitted?: (hash: string) => void) {
  const value = parseEther(bnbAmount);
  if (value <= 0n) throw new Error('BNB contribution must be greater than zero.');
  const contract = await writeContract();
  return confirmed('ICO purchase', () => contract.buy(stageId, { value }), onSubmitted);
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
