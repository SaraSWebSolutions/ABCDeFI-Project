const mongoose = require('mongoose');

const { Schema } = mongoose;

// EVM uint values and token amounts are stored as decimal strings. Converting them
// to JavaScript numbers would silently lose precision for valid uint256 values.
const uintString = {
  type: String,
  required: true,
  match: /^\d+$/,
};

const optionalUintString = {
  type: String,
  default: null,
  match: /^\d+$/,
};

const address = {
  type: String,
  required: true,
  lowercase: true,
  match: /^0x[a-f0-9]{40}$/,
};

const transactionHash = {
  type: String,
  required: true,
  lowercase: true,
  match: /^0x[a-f0-9]{64}$/,
};

const chainProvenanceSchema = new Schema(
  {
    chainId: uintString,
    contractAddress: address,
    transactionHash,
    blockNumber: uintString,
    transactionIndex: { type: Number, required: true, min: 0 },
    logIndex: { type: Number, required: true, min: 0 },
    blockHash: transactionHash,
    eventName: { type: String, required: true },
  },
  { _id: false }
);

const indexedRecordOptions = {
  timestamps: { createdAt: true, updatedAt: true },
  versionKey: false,
};

function indexedAt() {
  return { type: Date, required: true, default: Date.now, immutable: true };
}

function defineModel(name, schema, collection) {
  return mongoose.models[name] || mongoose.model(name, schema, collection);
}

const deploymentSchema = new Schema(
  {
    chainId: uintString,
    deploymentVersion: { type: String, required: true },
    network: { type: String, required: true },
    rpcUrl: { type: String, required: true },
    deploymentBlock: uintString,
    deploymentTimestamp: { type: Date, required: true },
    manifestSchemaVersion: { type: String, required: true },
    manifestPath: { type: String, default: null },
    contracts: {
      abcdToken: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
      lendingPool: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
      collateralVault: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
      loanManager: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
      loanMarketplace: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
      emiManager: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
      liquidation: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
      loanNFT: { address, deploymentTransactionHash: transactionHash, deploymentBlock: uintString },
    },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
deploymentSchema.index({ chainId: 1, deploymentVersion: 1 }, { unique: true });

const chainEventSchema = new Schema(
  {
    chainId: uintString,
    contractAddress: address,
    transactionHash,
    blockNumber: uintString,
    transactionIndex: { type: Number, required: true, min: 0 },
    logIndex: { type: Number, required: true, min: 0 },
    blockHash: transactionHash,
    eventName: { type: String, required: true },
    eventSignature: { type: String, required: true },
    topic0: transactionHash,
    topics: { type: [String], required: true },
    data: { type: String, required: true },
    args: { type: Schema.Types.Mixed, required: true },
    removed: { type: Boolean, required: true, default: false },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
chainEventSchema.index({ chainId: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
chainEventSchema.index({ chainId: 1, contractAddress: 1, blockNumber: 1, transactionIndex: 1, logIndex: 1 });

const blockCheckpointSchema = new Schema(
  {
    chainId: uintString,
    deploymentVersion: { type: String, required: true },
    contractScope: { type: String, required: true, default: 'canonical-lending-v2' },
    lastProcessedBlock: optionalUintString,
    lastProcessedBlockHash: { ...transactionHash, required: false, default: null },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
blockCheckpointSchema.index({ chainId: 1, deploymentVersion: 1, contractScope: 1 }, { unique: true });

const loanRequestSchema = new Schema(
  {
    chainId: uintString,
    loanMarketplaceAddress: address,
    requestId: uintString,
    borrower: address,
    lender: { ...address, required: false, default: null },
    principal: uintString,
    collateralETH: uintString,
    interestRateBps: optionalUintString,
    durationMonths: optionalUintString,
    emiAmount: optionalUintString,
    purpose: { type: String, default: null },
    status: { type: String, enum: ['OPEN', 'FUNDED', 'CANCELLED'], required: true },
    loanId: optionalUintString,
    createdEvidence: { type: chainProvenanceSchema, required: true },
    fundedEvidence: { type: chainProvenanceSchema, default: null },
    cancelledEvidence: { type: chainProvenanceSchema, default: null },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
loanRequestSchema.index({ chainId: 1, loanMarketplaceAddress: 1, requestId: 1 }, { unique: true });
loanRequestSchema.index({ chainId: 1, borrower: 1, status: 1 });

const loanSchema = new Schema(
  {
    chainId: uintString,
    loanManagerAddress: address,
    loanMarketplaceAddress: { ...address, required: false, default: null },
    requestId: optionalUintString,
    loanId: uintString,
    borrower: address,
    lender: address,
    principal: uintString,
    collateralETH: uintString,
    interestRateBps: uintString,
    durationMonths: uintString,
    emiAmount: uintString,
    startTime: uintString,
    lastInterestTime: uintString,
    totalRepaid: { type: String, required: true, default: '0', match: /^\d+$/ },
    status: { type: String, required: true },
    createdEvidence: { type: chainProvenanceSchema, required: true },
    latestStateEvidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
loanSchema.index({ chainId: 1, loanManagerAddress: 1, loanId: 1 }, { unique: true });
loanSchema.index({ chainId: 1, borrower: 1, status: 1 });
loanSchema.index({ chainId: 1, lender: 1, status: 1 });

const emiScheduleSchema = new Schema(
  {
    chainId: uintString,
    emiManagerAddress: address,
    loanId: uintString,
    totalInstallments: uintString,
    emiAmount: uintString,
    nextInstallmentIndex: optionalUintString,
    scheduleEvidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
emiScheduleSchema.index({ chainId: 1, emiManagerAddress: 1, loanId: 1 }, { unique: true });

const emiInstallmentSchema = new Schema(
  {
    chainId: uintString,
    emiManagerAddress: address,
    loanId: uintString,
    installmentId: uintString,
    amount: uintString,
    dueDate: uintString,
    paid: { type: Boolean, required: true, default: false },
    paidAt: optionalUintString,
    paymentEvidence: { type: chainProvenanceSchema, default: null },
    defaultEvidence: { type: chainProvenanceSchema, default: null },
    scheduleEvidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
emiInstallmentSchema.index({ chainId: 1, emiManagerAddress: 1, loanId: 1, installmentId: 1 }, { unique: true });
emiInstallmentSchema.index({ chainId: 1, loanId: 1, paid: 1, dueDate: 1 });

const repaymentSchema = new Schema(
  {
    chainId: uintString,
    loanId: uintString,
    installmentId: uintString,
    borrower: address,
    lender: address,
    amount: uintString,
    transactionHash,
    emiEvidence: { type: chainProvenanceSchema, required: true },
    loanRepaymentEvidence: { type: chainProvenanceSchema, required: true },
    tokenTransferEvidence: { type: chainProvenanceSchema, required: true },
    lenderDerivation: {
      source: { type: String, required: true, enum: ['LOAN_MANAGER_GET_LOAN'] },
      loanManagerAddress: address,
      observedAtBlock: uintString,
    },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
repaymentSchema.index({ chainId: 1, transactionHash: 1, 'emiEvidence.logIndex': 1 }, { unique: true });
repaymentSchema.index({ chainId: 1, loanId: 1, installmentId: 1 });

const loanDefaultSchema = new Schema(
  {
    chainId: uintString,
    loanId: uintString,
    installmentId: uintString,
    borrower: address,
    dueDate: uintString,
    emiDefaultEvidence: { type: chainProvenanceSchema, required: true },
    loanDefaultEvidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
loanDefaultSchema.index({ chainId: 1, 'emiDefaultEvidence.contractAddress': 1, loanId: 1, installmentId: 1 }, { unique: true });

const liquidationSchema = new Schema(
  {
    chainId: uintString,
    loanId: uintString,
    requestId: uintString,
    borrower: address,
    lender: address,
    collateralETH: uintString,
    marketplaceEvidence: { type: chainProvenanceSchema, required: true },
    loanLiquidationEvidence: { type: chainProvenanceSchema, required: true },
    collateralEvidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
liquidationSchema.index({ chainId: 1, 'marketplaceEvidence.contractAddress': 1, loanId: 1 }, { unique: true });

const directLendingPositionSchema = new Schema(
  {
    chainId: uintString,
    lendingPoolAddress: address,
    borrower: address,
    collateralETH: uintString,
    borrowedTokens: uintString,
    active: { type: Boolean, required: true },
    latestStateEvidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
directLendingPositionSchema.index({ chainId: 1, lendingPoolAddress: 1, borrower: 1 }, { unique: true });
directLendingPositionSchema.index({ chainId: 1, borrower: 1, active: 1 });

// This event ledger is retained independently from the latest position so a
// wallet's direct-lending history is both auditable and idempotent on replay.
const directLendingActivitySchema = new Schema(
  {
    chainId: uintString,
    lendingPoolAddress: address,
    borrower: address,
    counterparty: { ...address, required: false, default: null },
    action: { type: String, required: true, enum: ['COLLATERAL_DEPOSIT', 'COLLATERAL_WITHDRAWAL', 'BORROW', 'REPAY', 'LIQUIDATION'] },
    asset: { type: String, required: true, enum: ['ETH', 'ABCD'] },
    amount: uintString,
    relatedCollateralETH: optionalUintString,
    evidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
directLendingActivitySchema.index({ chainId: 1, 'evidence.transactionHash': 1, 'evidence.logIndex': 1 }, { unique: true });
directLendingActivitySchema.index({ chainId: 1, borrower: 1, 'evidence.blockNumber': -1, 'evidence.logIndex': -1 });
directLendingActivitySchema.index({ chainId: 1, counterparty: 1, 'evidence.blockNumber': -1, 'evidence.logIndex': -1 });

const directLiquidationSchema = new Schema(
  {
    chainId: uintString,
    lendingPoolAddress: address,
    liquidationAddress: address,
    borrower: address,
    liquidator: address,
    debtCovered: uintString,
    collateralSeizedETH: uintString,
    liquidatorBonusETH: uintString,
    surplusToTreasuryETH: uintString,
    poolSettlementEvidence: { type: chainProvenanceSchema, required: true },
    liquidationEvidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
directLiquidationSchema.index({ chainId: 1, 'liquidationEvidence.contractAddress': 1, 'liquidationEvidence.transactionHash': 1, 'liquidationEvidence.logIndex': 1 }, { unique: true });
directLiquidationSchema.index({ chainId: 1, borrower: 1, liquidator: 1 });

const loanNftCertificateSchema = new Schema(
  {
    chainId: uintString,
    loanNFTAddress: address,
    tokenId: uintString,
    owner: { ...address, required: false, default: null },
    loanId: uintString,
    borrower: address,
    lender: address,
    loanAmount: uintString,
    collateral: uintString,
    interestRateBps: uintString,
    durationMonths: uintString,
    status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'DEFAULTED', 'LIQUIDATED'], required: true },
    mintDate: uintString,
    ipfsUri: { type: String, default: '' },
    burned: { type: Boolean, required: true, default: false },
    mintedEvidence: { type: chainProvenanceSchema, required: true },
    latestStateEvidence: { type: chainProvenanceSchema, required: true },
    burnedEvidence: { type: chainProvenanceSchema, default: null },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
loanNftCertificateSchema.index({ chainId: 1, loanNFTAddress: 1, tokenId: 1 }, { unique: true });
loanNftCertificateSchema.index({ chainId: 1, owner: 1, burned: 1 });
loanNftCertificateSchema.index({ chainId: 1, borrower: 1, lender: 1 });

const loanNftTransferSchema = new Schema(
  {
    chainId: uintString,
    loanNFTAddress: address,
    tokenId: uintString,
    from: address,
    to: address,
    evidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
loanNftTransferSchema.index({ chainId: 1, 'evidence.transactionHash': 1, 'evidence.logIndex': 1 }, { unique: true });
loanNftTransferSchema.index({ chainId: 1, from: 1, to: 1, tokenId: 1 });

const collateralMovementSchema = new Schema(
  {
    chainId: uintString,
    collateralVaultAddress: address,
    transactionHash,
    blockNumber: uintString,
    transactionIndex: { type: Number, required: true, min: 0 },
    logIndex: { type: Number, required: true, min: 0 },
    blockHash: transactionHash,
    eventName: { type: String, required: true },
    borrowerOrRecipient: address,
    tokenAddress: { ...address, required: false, default: null },
    assetType: { type: String, required: true, enum: ['ETH', 'ERC20'] },
    direction: { type: String, required: true, enum: ['CREDIT', 'DEBIT'] },
    amount: uintString,
    requestId: optionalUintString,
    loanId: optionalUintString,
    attribution: {
      type: String,
      required: true,
      enum: ['UNATTRIBUTED', 'SAME_TRANSACTION_UNAMBIGUOUS'],
      default: 'UNATTRIBUTED',
    },
    attributionEvidence: { type: chainProvenanceSchema, default: null },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
collateralMovementSchema.index({ chainId: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
collateralMovementSchema.index({ chainId: 1, borrowerOrRecipient: 1, blockNumber: 1 });

const loanStateTransitionSchema = new Schema(
  {
    chainId: uintString,
    loanManagerAddress: address,
    loanId: uintString,
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    reasonEvent: { type: String, required: true },
    evidence: { type: chainProvenanceSchema, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
loanStateTransitionSchema.index({ chainId: 1, 'evidence.transactionHash': 1, 'evidence.logIndex': 1 }, { unique: true });
loanStateTransitionSchema.index({ chainId: 1, loanManagerAddress: 1, loanId: 1, 'evidence.blockNumber': 1, 'evidence.logIndex': 1 });

const reconciliationErrorSchema = new Schema(
  {
    chainId: uintString,
    code: { type: String, required: true },
    transactionHash,
    logIndex: { type: Number, required: true, min: 0 },
    eventEvidence: { type: chainProvenanceSchema, required: true },
    details: { type: Schema.Types.Mixed, required: true },
    indexedAt: indexedAt(),
  },
  indexedRecordOptions
);
reconciliationErrorSchema.index({ chainId: 1, code: 1, transactionHash: 1, logIndex: 1 }, { unique: true });

module.exports = {
  Deployment: defineModel('LendingDeployment', deploymentSchema, 'deployments'),
  ChainEvent: defineModel('LendingChainEvent', chainEventSchema, 'chain_events'),
  BlockCheckpoint: defineModel('LendingBlockCheckpoint', blockCheckpointSchema, 'block_checkpoints'),
  LoanRequest: defineModel('LendingLoanRequest', loanRequestSchema, 'loan_requests'),
  Loan: defineModel('LendingLoan', loanSchema, 'loans'),
  EMISchedule: defineModel('LendingEMISchedule', emiScheduleSchema, 'emi_schedules'),
  EMIInstallment: defineModel('LendingEMIInstallment', emiInstallmentSchema, 'emi_installments'),
  Repayment: defineModel('LendingRepayment', repaymentSchema, 'repayments'),
  LoanDefault: defineModel('LendingLoanDefault', loanDefaultSchema, 'loan_defaults'),
  Liquidation: defineModel('LendingLiquidation', liquidationSchema, 'liquidations'),
  DirectLendingPosition: defineModel('LendingDirectPosition', directLendingPositionSchema, 'direct_lending_positions'),
  DirectLendingActivity: defineModel('LendingDirectActivity', directLendingActivitySchema, 'direct_lending_activities'),
  DirectLiquidation: defineModel('LendingDirectLiquidation', directLiquidationSchema, 'direct_liquidations'),
  LoanNFTCertificate: defineModel('LendingLoanNFTCertificate', loanNftCertificateSchema, 'loan_nft_certificates'),
  LoanNFTTransfer: defineModel('LendingLoanNFTTransfer', loanNftTransferSchema, 'loan_nft_transfers'),
  CollateralMovement: defineModel('LendingCollateralMovement', collateralMovementSchema, 'collateral_movements'),
  LoanStateTransition: defineModel('LendingLoanStateTransition', loanStateTransitionSchema, 'loan_state_transitions'),
  ReconciliationError: defineModel('LendingReconciliationError', reconciliationErrorSchema, 'lending_reconciliation_errors'),
  chainProvenanceSchema,
};
