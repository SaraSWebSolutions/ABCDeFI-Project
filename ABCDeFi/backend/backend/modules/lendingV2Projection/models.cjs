const mongoose = require('mongoose');
const { Schema } = mongoose;
const address = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const hash = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const uint = { type: String, required: true, match: /^\d+$/ };
function model(name, schema, collection) { return mongoose.models[name] || mongoose.model(name, schema, collection); }

const eventSchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, contractAddress: address, contractName: { type: String, required: true },
  transactionHash: hash, blockNumber: uint, blockNumberNumeric: { type: Number, required: true, min: 0 }, blockTimestamp: uint,
  transactionIndex: { type: Number, required: true }, logIndex: { type: Number, required: true },
  blockHash: hash, eventName: { type: String, required: true }, args: { type: Schema.Types.Mixed, required: true }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
eventSchema.index({ chainId: 1, deploymentVersion: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
eventSchema.index({ chainId: 1, deploymentVersion: 1, blockNumberNumeric: 1, transactionIndex: 1, logIndex: 1 });

const checkpointSchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, scope: { type: String, required: true },
  lastProcessedBlock: { type: String, default: null, match: /^\d+$/ }, lastProcessedBlockHash: { type: String, default: null }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
checkpointSchema.index({ chainId: 1, deploymentVersion: 1, scope: 1 }, { unique: true });

// This is an off-chain audit of a public-IPFS preparation request, not a
// substitute for the immutable LoanNFT provenance written on settlement.
// It lets an operator distinguish a validated result from an upload whose
// provider outcome is unknown, so an automatic retry never creates a second
// public record blindly.
const completionMetadataAuditSchema = new Schema({
  correlationId: { type: String, required: true, unique: true },
  chainId: uint,
  deploymentVersion: { type: String, required: true },
  loanId: uint,
  borrower: address,
  requestedAt: { type: Date, required: true },
  status: { type: String, required: true, enum: ['PENDING_UPLOAD', 'VALIDATED', 'OUTCOME_UNKNOWN', 'POST_UPLOAD_VALIDATION_FAILED'] },
  records: [{
    role: { type: String, required: true, enum: ['Lender', 'Borrower', 'Platform'] },
    fingerprint: { type: String, required: true, match: /^0x[a-f0-9]{64}$/ },
    metadataHash: { type: String, required: true, match: /^0x[a-f0-9]{64}$/ },
    cid: { type: String, default: null },
    metadataUri: { type: String, default: null },
    imageCid: { type: String, default: null },
    imageUri: { type: String, default: null },
    validationStatus: { type: String, required: true, enum: ['PLANNED', 'VALIDATED', 'FAILED'] },
  }],
  failureReason: { type: String, default: null },
}, { versionKey: false });
completionMetadataAuditSchema.index({ chainId: 1, deploymentVersion: 1, loanId: 1, borrower: 1, requestedAt: -1 });

module.exports = Object.freeze({
  V2ChainEvent: model('LendingV2ChainEvent', eventSchema, 'lending_v2_chain_events'),
  V2BlockCheckpoint: model('LendingV2BlockCheckpoint', checkpointSchema, 'lending_v2_block_checkpoints'),
  V2CompletionMetadataAudit: model('LendingV2CompletionMetadataAudit', completionMetadataAuditSchema, 'lending_v2_completion_metadata_audits'),
});
