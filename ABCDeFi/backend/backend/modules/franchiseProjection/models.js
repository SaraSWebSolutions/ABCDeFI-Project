const mongoose = require('mongoose');
const { Schema } = mongoose;
const uint = { type: String, required: true, match: /^\d+$/ };
const address = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const hash = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const evidence = new Schema({ transactionHash: hash, blockNumber: uint, logIndex: { type: Number, required: true, min: 0 }, blockHash: hash, eventName: { type: String, required: true } }, { _id: false });
const model = (name, schema, collection) => mongoose.models[name] || mongoose.model(name, schema, collection);

const checkpoint = new Schema({ chainId: uint, deploymentVersion: { type: String, required: true }, registryAddress: address, projectionScope: { type: String, default: null }, lastProcessedBlock: { type: String, default: null, match: /^\d+$/ }, lastProcessedBlockHash: { type: String, default: null }, indexedAt: { type: Date, default: Date.now } }, { versionKey: false });
checkpoint.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1 }, { unique: true });
const event = new Schema({ chainId: uint, deploymentVersion: { type: String, required: true }, registryAddress: address, transactionHash: hash, blockNumber: uint, logIndex: { type: Number, required: true }, blockHash: hash, eventName: { type: String, required: true }, args: { type: Schema.Types.Mixed, required: true }, removed: { type: Boolean, default: false }, indexedAt: { type: Date, default: Date.now } }, { versionKey: false });
event.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
const certificate = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, registryAddress: address, nftAddress: address, tokenId: uint, owner: address,
  territoryKey: { type: String, required: true }, level: uint, status: uint, operatorVersion: uint,
  metadataURI: { type: String, required: true }, registrationEvidence: evidence, latestEvidence: evidence, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
certificate.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, tokenId: 1 }, { unique: true });
certificate.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, owner: 1 });
const history = new Schema({ chainId: uint, deploymentVersion: { type: String, required: true }, registryAddress: address, tokenId: uint, eventName: { type: String, required: true }, args: { type: Schema.Types.Mixed, required: true }, evidence, indexedAt: { type: Date, default: Date.now } }, { versionKey: false });
history.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, 'evidence.transactionHash': 1, 'evidence.logIndex': 1 }, { unique: true });

module.exports = {
  FranchiseCheckpoint: model('FranchiseCheckpoint', checkpoint, 'franchise_checkpoints_v2'),
  FranchiseEvent: model('FranchiseEvent', event, 'franchise_events_v2'),
  FranchiseCertificate: model('FranchiseCertificate', certificate, 'franchise_certificates_v2'),
  FranchiseHistory: model('FranchiseHistory', history, 'franchise_history_v2'),
};
