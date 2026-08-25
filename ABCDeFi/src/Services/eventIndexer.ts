// ============================================================================
// Step 3 – Event Indexer Service
// Backend listens to blockchain events and stores them in the database.
// Flow: Smart Contract ➔ Blockchain Event ➔ Backend Listener ➔ Database
// ============================================================================

import { TransactionRecord } from './transactionHistory';

export interface BlockchainEvent {
  eventName:
    | 'LoanCreated'
    | 'CollateralLocked'
    | 'LoanFunded'
    | 'InstallmentPaid'
    | 'InterestClaimed'
    | 'LoanCompleted'
    | 'LoanDefaulted'
    | 'NFTMinted';
  txHash: string;
  blockNumber: number;
  contractAddress: string;
  args: Record<string, any>;
  timestamp: string;
}

export class EventIndexerService {
  private isListening: boolean = false;
  private indexedCount: number = 0;
  private listeners: Array<(event: BlockchainEvent) => void> = [];

  // Browser-side indexing is deliberately disabled. The durable backend
  // indexer owns all canonical event persistence and reorg handling.
  public startListening() {
    this.isListening = false;
    console.warn('[EventIndexer] Browser-side indexing is disabled; use the canonical backend indexer.');
  }

  // Stop listening
  public stopListening() {
    this.isListening = false;
    console.log('[EventIndexer] Stopped listener.');
  }

  // Process incoming smart contract event and store in database
  public async handleBlockchainEvent(_event: BlockchainEvent): Promise<TransactionRecord> {
    throw new Error('The browser-side simulated event indexer is disabled. Use the canonical backend indexer and /api/transactions.');
  }

  public subscribe(callback: (event: BlockchainEvent) => void) {
    this.listeners.push(callback);
  }

  public getStatus() {
    return {
      isListening: this.isListening,
      indexedCount: this.indexedCount,
      activeChain: 'Disabled — canonical backend indexer required',
    };
  }
}

export const eventIndexer = new EventIndexerService();
