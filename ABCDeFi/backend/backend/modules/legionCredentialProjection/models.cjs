const mongoose = require('mongoose');
const { Schema } = mongoose;

const address = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const hash = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const uint = { type: String, required: true, match: /^\d+$/ };
const model = (name, schema, collection) => mongoose.models[name] || mongoose.model(name, schema, collection);

const evidenceSchema = new Schema({
  transactionHash: hash,
  blockNumber: uint,
  logIndex: { type: Number, required: true },
  blockHash: hash,
  eventName: { type: String, required: true },
}, { _id: false });

const credentialSchema = new Schema({
  chainId: uint,
  deploymentVersion: { type: String, required: true },
  contractAddress: address,
  tokenId: uint,
  owner: address,
  active: { type: Boolean, required: true },
  status: { type: String, required: true, enum: ['ACTIVE', 'SUSPENDED', 'REVOKED'] },
  category: { type: String, required: true },
  metadataURI: { type: String, required: true },
  issuedAt: uint,
  updatedAt: uint,
  mintEvidence: { type: evidenceSchema, required: true },
  latestEvidence: { type: evidenceSchema, required: true },
  indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
credentialSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, tokenId: 1 }, { unique: true });
credentialSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, owner: 1, active: 1 });

const eventSchema = new Schema({
  chainId: uint,
  deploymentVersion: { type: String, required: true },
  contractAddress: address,
  transactionHash: hash,
  blockNumber: uint,
  transactionIndex: { type: Number, required: true },
  logIndex: { type: Number, required: true },
  blockHash: hash,
  eventName: { type: String, required: true },
  tokenId: uint,
  args: { type: Schema.Types.Mixed, required: true },
  removed: { type: Boolean, default: false },
  indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
eventSchema.index({ chainId: 1, deploymentVersion: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
eventSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, tokenId: 1, blockNumber: 1, logIndex: 1 });

const checkpointSchema = new Schema({
  chainId: uint,
  deploymentVersion: { type: String, required: true },
  contractAddress: address,
  scope: { type: String, required: true },
  lastProcessedBlock: { type: String, default: null, match: /^\d+$/ },
  lastProcessedBlockHash: { type: String, default: null },
  indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
checkpointSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, scope: 1 }, { unique: true });

module.exports = Object.freeze({
  LegionCredential: model('LegionCredentialV2', credentialSchema, 'legion_credential_v2'),
  LegionCredentialEvent: model('LegionCredentialV2Event', eventSchema, 'legion_credential_v2_events'),
  LegionCredentialCheckpoint: model('LegionCredentialV2Checkpoint', checkpointSchema, 'legion_credential_v2_checkpoints'),
});
