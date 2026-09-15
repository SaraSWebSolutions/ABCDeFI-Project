const mongoose = require('mongoose');
const { Schema } = mongoose;
const address = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const hash = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const uint = { type: String, required: true, match: /^\d+$/ };
const model = (name, schema, collection) => mongoose.models[name] || mongoose.model(name, schema, collection);

const territorySchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, contractAddress: address, tokenId: uint, owner: address,
  level: { type: String, required: true, enum: ['COUNTRY', 'STATE', 'DISTRICT'] }, parentId: uint, population: uint,
  displayName: { type: String, required: true }, canonicalIdentifier: { type: String, required: true }, metadataURI: { type: String, required: true }, territoryKey: { type: String, required: true },
  activeTransferRequestId: { type: String, default: '0', match: /^\d+$/ }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
territorySchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, tokenId: 1 }, { unique: true });
territorySchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, owner: 1 });

const requestSchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, contractAddress: address, requestId: uint, tokenId: uint,
  currentOwner: address, proposedOwner: address, active: { type: Boolean, required: true }, approved: { type: Boolean, required: true }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
requestSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, requestId: 1 }, { unique: true });
requestSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, tokenId: 1, active: 1 });

const eventSchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, contractAddress: address, transactionHash: hash, blockNumber: uint,
  transactionIndex: { type: Number, required: true }, logIndex: { type: Number, required: true }, blockHash: hash,
  eventName: { type: String, required: true }, tokenId: { type: String, default: null }, requestId: { type: String, default: null }, args: { type: Schema.Types.Mixed, required: true }, removed: { type: Boolean, default: false }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
eventSchema.index({ chainId: 1, deploymentVersion: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
eventSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, tokenId: 1, blockNumber: 1, logIndex: 1 });

const checkpointSchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, contractAddress: address, scope: { type: String, required: true },
  lastProcessedBlock: { type: String, default: null, match: /^\d+$/ }, lastProcessedBlockHash: { type: String, default: null }, paused: { type: Boolean, default: false }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
checkpointSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1, scope: 1 }, { unique: true });

module.exports = Object.freeze({
  LegionNFTV2Territory: model('LegionNFTV2Territory', territorySchema, 'legion_nft_v2_territories'),
  LegionNFTV2TransferRequest: model('LegionNFTV2TransferRequest', requestSchema, 'legion_nft_v2_transfer_requests'),
  LegionNFTV2Event: model('LegionNFTV2Event', eventSchema, 'legion_nft_v2_events'),
  LegionNFTV2Checkpoint: model('LegionNFTV2Checkpoint', checkpointSchema, 'legion_nft_v2_checkpoints'),
});
