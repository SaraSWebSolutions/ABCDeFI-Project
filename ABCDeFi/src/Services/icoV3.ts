import { Contract, Interface, ZeroAddress, formatEther, isAddress, parseEther } from 'ethers';
import { ICO_V3_CONTRACT, DEPLOYMENT_CHAIN_ID } from '../Config/contracts';
import { CANONICAL_DEPLOYMENT_IDENTITY, canonicalDeploymentContext } from '../Config/canonicalDeploymentContext';
import { assertCanonicalContractDeployment } from './contractProvider';
import { checkNetwork, getProvider, getSigner } from './wallet';

export const ICO_V3_ABI = [
  'function lifecycle() view returns (uint8)', 'function paused() view returns (bool)', 'function currentStage() view returns (uint8)',
  'function stage(uint8) view returns (uint256 startTime,uint256 endTime,uint256 inventory,uint256 sold,uint256 priceUsdWad)',
  'function eligibleWallet(address) view returns (bool)', 'function purchaseOf(address) view returns (uint256 allocation,uint256 bnbPaid,uint256 claimed,uint256 stageOneAllocation,uint256 stageTwoAllocation,bool refunded)',
  'function claimable(address) view returns (uint256)', 'function bnbUsdFeed() view returns (address)', 'function feedDecimals() view returns (uint8)', 'function maxPriceAge() view returns (uint256)',
  'function buy(uint8 stageId,uint256 requestedAllocation) payable', 'function claim()', 'function claimRefund()',
  'event IcoPurchase(address indexed buyer,uint8 indexed stage,uint256 bnbPaid,uint256 allocation,uint256 oracleAnswer,uint80 oracleRoundId)',
  'event IcoTokensClaimed(address indexed buyer,uint256 amount,uint256 totalClaimed)', 'event IcoRefundClaimed(address indexed buyer,uint256 bnbAmount,uint256 allocationReversed)',
] as const;

export type IcoV3OperationState = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'REVERTED' | 'STALE' | 'UNAVAILABLE';
export type IcoV3Operation = 'buy' | 'claim' | 'refund';
export type IcoV3Result = { state: IcoV3OperationState; transactionHash?: string; blockNumber?: number; expectedEventObserved?: boolean; indexed?: boolean; detail?: string };
type StatusBody = { status?: string; reason?: string; manifest?: { chainId?: number; deploymentIdentity?: string; address?: string; abcdAddress?: string }; checkpoint?: { lastProcessedBlock?: string }; data?: any };

const expectedEvents: Record<IcoV3Operation, string> = { buy: 'IcoPurchase', claim: 'IcoTokensClaimed', refund: 'IcoRefundClaimed' };
const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function failure(error: unknown): IcoV3Result {
  const value = error as { code?: string | number; shortMessage?: string; reason?: string; message?: string };
  const detail = value.shortMessage || value.reason || value.message || 'ICO V3 transaction failed.';
  const rejected = value.code === 4001 || value.code === 'ACTION_REJECTED' || /rejected|denied/i.test(detail);
  return { state: rejected ? 'REVERTED' : 'FAILED', detail: rejected ? 'Transaction rejected in the wallet. No on-chain state was changed.' : detail };
}

export function icoV3ErrorMessage(error: unknown) { return failure(error).detail || 'ICO V3 transaction failed.'; }

async function canonicalStatus(): Promise<StatusBody> {
  const response = await fetch('/api/ico-v3/status');
  const body: StatusBody = await response.json().catch(() => ({}));
  if (!response.ok || body.status !== 'AVAILABLE') throw new Error(body.reason || 'Canonical ICO V3 state is unavailable.');
  if (body.manifest?.chainId !== Number(DEPLOYMENT_CHAIN_ID) || body.manifest?.deploymentIdentity !== CANONICAL_DEPLOYMENT_IDENTITY.unified || body.manifest?.address?.toLowerCase() !== ICO_V3_CONTRACT.toLowerCase()) throw new Error('ICO V3 API deployment identity does not match the selected canonical runtime.');
  return body;
}

async function canonicalWriter() {
  await canonicalStatus();
  await assertCanonicalContractDeployment('ICOManagerV3', ICO_V3_CONTRACT);
  const network = await checkNetwork();
  if (!network.isCorrect) throw new Error(`Switch the wallet to canonical chain ${DEPLOYMENT_CHAIN_ID.toString()} before an ICO V3 operation.`);
  const signer = await getSigner();
  const contract = new Contract(ICO_V3_CONTRACT, ICO_V3_ABI, signer);
  return { contract, signer, status: await canonicalStatus() };
}

function receiptEvent(contract: Contract, receipt: any, eventName: string) {
  return receipt.logs.some((log: any) => {
    if (String(log.address).toLowerCase() !== ICO_V3_CONTRACT.toLowerCase()) return false;
    try { return contract.interface.parseLog(log)?.name === eventName; } catch { return false; }
  });
}

async function waitForIndexed(transactionHash: string, blockNumber: number, eventName: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const [statusResponse, historyResponse] = await Promise.all([fetch('/api/ico-v3/status'), fetch('/api/ico-v3/history')]);
      const status: StatusBody = await statusResponse.json().catch(() => ({}));
      const history = await historyResponse.json().catch(() => ({}));
      const checkpoint = BigInt(status.checkpoint?.lastProcessedBlock || '-1');
      const matchesRuntime = status.status === 'AVAILABLE' && status.manifest?.deploymentIdentity === CANONICAL_DEPLOYMENT_IDENTITY.unified && status.manifest?.address?.toLowerCase() === ICO_V3_CONTRACT.toLowerCase();
      const event = Array.isArray(history?.data?.events) && history.data.events.some((item: any) => String(item.transactionHash).toLowerCase() === transactionHash.toLowerCase() && item.eventName === eventName);
      if (matchesRuntime && checkpoint >= BigInt(blockNumber) && event) return true;
    } catch { /* fail closed after the bounded reconciliation window */ }
    await sleep(1_000);
  }
  return false;
}

async function submit(operation: IcoV3Operation, action: (contract: Contract) => Promise<any>, onState?: (state: IcoV3OperationState, detail?: string) => void): Promise<IcoV3Result> {
  try {
    onState?.('PENDING', 'Verifying the canonical runtime, wallet network, bytecode, and ICO V3 API context.');
    const { contract } = await canonicalWriter();
    const transaction = await action(contract);
    onState?.('SUBMITTED', transaction.hash);
    const receipt = await transaction.wait();
    if (!receipt || Number(receipt.status) !== 1) { onState?.('REVERTED', 'The transaction receipt did not report success.'); return { state: 'REVERTED', transactionHash: transaction.hash, detail: 'The ICO V3 transaction reverted or was not confirmed.' }; }
    const eventObserved = receiptEvent(contract, receipt, expectedEvents[operation]);
    if (!eventObserved) { onState?.('FAILED', 'The expected canonical ICO V3 event was absent.'); return { state: 'FAILED', transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber), expectedEventObserved: false, detail: 'The transaction receipt did not contain the expected canonical ICO V3 event.' }; }
    onState?.('PENDING', 'Receipt confirmed; waiting for the canonical ICO V3 indexer and API checkpoint.');
    const indexed = await waitForIndexed(transaction.hash, Number(receipt.blockNumber), expectedEvents[operation]);
    if (!indexed) { onState?.('STALE', 'Confirmed on chain, but the canonical ICO V3 indexer/API did not reconcile within the bounded wait.'); return { state: 'STALE', transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber), expectedEventObserved: true, indexed: false }; }
    onState?.('CONFIRMED', transaction.hash);
    return { state: 'CONFIRMED', transactionHash: transaction.hash, blockNumber: Number(receipt.blockNumber), expectedEventObserved: true, indexed: true };
  } catch (error) { const result = failure(error); onState?.(result.state, result.detail); return result; }
}

export function quoteIcoV3Purchase(requestedAllocation: string, priceUsdWad: string, oracleAnswer: string, feedDecimals: string) {
  const allocation = parseEther(requestedAllocation);
  const price = BigInt(priceUsdWad); const answer = BigInt(oracleAnswer); const decimals = BigInt(feedDecimals);
  if (allocation <= 0n || price <= 0n || answer <= 0n || decimals > 18n) throw new Error('Canonical ICO V3 quote inputs are unavailable.');
  const bnbUsdWad = answer * 10n ** (18n - decimals);
  return (allocation * price + bnbUsdWad - 1n) / bnbUsdWad;
}

export function buyIcoV3(stageId: 0 | 1, requestedAllocation: string, bnbValueWei: bigint, onState?: (state: IcoV3OperationState, detail?: string) => void) {
  const allocation = parseEther(requestedAllocation);
  if (allocation < parseEther('100') || bnbValueWei <= 0n) return Promise.resolve({ state: 'FAILED' as const, detail: 'The canonical ICO V3 minimum purchase is 100 ABCD and a positive native-BNB value is required.' });
  return submit('buy', (contract) => contract.buy(stageId, allocation, { value: bnbValueWei }), onState);
}
export const claimIcoV3 = (onState?: (state: IcoV3OperationState, detail?: string) => void) => submit('claim', (contract) => contract.claim(), onState);
export const refundIcoV3 = (onState?: (state: IcoV3OperationState, detail?: string) => void) => submit('refund', (contract) => contract.claimRefund(), onState);
export const icoV3Amount = (value: string) => formatEther(value);
export const validIcoV3Address = (value: string) => isAddress(value) && value.toLowerCase() !== ZeroAddress.toLowerCase();
export const ICO_V3_DEPLOYMENT_CONTEXT = canonicalDeploymentContext.ico;
