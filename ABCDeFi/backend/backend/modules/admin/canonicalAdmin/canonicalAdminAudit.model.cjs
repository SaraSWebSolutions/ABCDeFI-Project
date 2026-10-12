const mongoose = require('mongoose');

const { Schema } = mongoose;
const hash = { type: String, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const address = { type: String, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const reconciliation = new Schema({
  receiptBlockHash: hash,
  targetContract: address,
  sender: address,
  expectedEvent: String,
  eventLogIndex: Number,
  indexerTransactionHash: hash,
  indexerBlockHash: hash,
  indexerLogIndex: Number,
  reconciledAt: Date,
}, { _id: false });

const auditSchema = new Schema({
  administratorId: { type: Schema.Types.ObjectId, required: true, index: true },
  module: { type: String, required: true, enum: ['ABCDTokenV2', 'ICO V3', 'Lending V2', 'P2P', 'EMIManagerV2', 'Referral', 'Reserve', 'Treasury', 'Legion', 'Marketplace', 'Legion Marketplace'] },
  action: { type: String, required: true, enum: ['pause', 'unpause', 'setEligibility', 'setOracle', 'setProceedsRecipient', 'configureTge', 'finalize', 'cancel', 'withdrawProceeds', 'updateMetadata', 'approveTransfer', 'invalidateTransfer'] },
  state: { type: String, required: true, enum: ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REVERTED', 'STALE', 'UNAVAILABLE'], default: 'PENDING' },
  runtimeFamily: { type: String, required: true },
  chainId: { type: String, required: true, match: /^\d+$/ },
  rpcUrl: { type: String, required: true },
  deploymentIdentity: { type: String, required: true },
  transactionHash: { type: String, default: null, match: /^0x[a-fA-F0-9]{64}$/ },
  blockNumber: { type: String, default: null, match: /^\d+$/ },
  expectedEventObserved: { type: Boolean, default: null },
  indexerObserved: { type: Boolean, default: null },
  reconciliation: { type: reconciliation, default: null },
  detail: { type: String, default: null, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

auditSchema.index({ administratorId: 1, createdAt: -1 });
auditSchema.index({ runtimeFamily: 1, deploymentIdentity: 1, createdAt: -1 });

module.exports = mongoose.models.CanonicalAdminAudit
  || mongoose.model('CanonicalAdminAudit', auditSchema, 'canonical_admin_audits');
