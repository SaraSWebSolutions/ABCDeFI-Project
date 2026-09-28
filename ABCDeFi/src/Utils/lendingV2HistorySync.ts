export type LendingV2IndexerCheckpoint = {
  status: string;
  checkpoint: string | null | undefined;
  deploymentVersion: string | null | undefined;
};

export type LendingV2HistorySyncOptions = {
  receiptBlock: string;
  expectedDeploymentVersion: string;
  readCheckpoint: () => Promise<LendingV2IndexerCheckpoint>;
  reloadHistory: () => Promise<unknown>;
  isCurrent: () => boolean;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
  retryDelayMs?: number;
};

const defaultSleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

function blockNumber(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`Canonical Lending V2 ${label} is unavailable.`);
  return BigInt(value);
}

/** Waits for the canonical confirmed-event projection; it never synthesizes wallet history. */
export async function synchronizeLendingV2HistoryAfterReceipt(options: LendingV2HistorySyncOptions): Promise<boolean> {
  const receiptBlock = blockNumber(options.receiptBlock, 'receipt block');
  const maxAttempts = options.maxAttempts ?? 12;
  const retryDelayMs = options.retryDelayMs ?? 250;
  const sleep = options.sleep ?? defaultSleep;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('Canonical Lending V2 history synchronization has an invalid retry limit.');
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0) throw new Error('Canonical Lending V2 history synchronization has an invalid retry delay.');

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!options.isCurrent()) return false;
    const status = await options.readCheckpoint();
    if (status.status !== 'AVAILABLE') throw new Error('Canonical Lending V2 indexed data is unavailable for the current deployment.');
    if (!status.deploymentVersion || status.deploymentVersion !== options.expectedDeploymentVersion) {
      throw new Error('Canonical Lending V2 indexer deployment identity does not match the active deployment.');
    }
    const checkpoint = status.checkpoint === null || status.checkpoint === undefined ? null : blockNumber(status.checkpoint, 'indexer checkpoint');
    if (checkpoint !== null && checkpoint >= receiptBlock) {
      if (!options.isCurrent()) return false;
      await options.reloadHistory();
      return options.isCurrent();
    }
    if (attempt + 1 < maxAttempts && options.isCurrent()) await sleep(retryDelayMs);
  }
  throw new Error(`Canonical Lending V2 indexer checkpoint did not reach receipt block ${receiptBlock.toString()} within the bounded retry window.`);
}
