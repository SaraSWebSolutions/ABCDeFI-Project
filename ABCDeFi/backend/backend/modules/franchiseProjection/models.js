const mongoose = require('mongoose');
const { Schema } = mongoose;

const uint = { type: String, required: true, match: /^\d+$/ };
const address = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const hash = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const evidence = new Schema({ transactionHash: hash, blockNumber: uint, logIndex: { type: Number, required: true, min: 0 }, blockHash: hash, eventName: { type: String, required: true } }, { _id: false });
function model(name, schema, collection) { return mongoose.models[name] || mongoose.model(name, schema, collection); }

const checkpointSchema = new Schema({ chainId: uint, deploymentVersion: { type: String, required: true }, contractAddress: address, lastProcessedBlock: { type: String, default: null, match: /^\d+$/ }, lastProcessedBlockHash: { type: String, default: null }, indexedAt: { type: Date, default: Date.now } }, { versionKey: false });
checkpointSchema.index({ chainId: 1, deploymentVersion: 1, contractAddress: 1 }, { unique: true });
const eventSchema = new Schema({ chainId: uint, contractAddress: address, transactionHash: hash, blockNumber: uint, logIndex: { type: Number, required: true }, blockHash: hash, eventName: { type: String, required: true }, args: { type: Schema.Types.Mixed, required: true }, removed: { type: Boolean, default: false }, indexedAt: { type: Date, default: Date.now } }, { versionKey: false });
eventSchema.index({ chainId: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
const franchiseSchema = new Schema({
  chainId: uint, contractAddress: address, tokenId: uint, owner: address,
  franchiseName: { type: String, required: true }, territoryCode: { type: String, required: true }, territoryName: { type: String, required: true },
  level: uint, legionNFTId: uint, priceUSD: uint, commissionBps: uint, purchaseTimestamp: uint, lockExpiryTimestamp: uint, status: uint,
  tokenUri: { type: String, default: '' }, ipfsCID: { type: String, default: '' }, mintEvidence: evidence, latestEvidence: evidence, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
franchiseSchema.index({ chainId: 1, contractAddress: 1, tokenId: 1 }, { unique: true });
franchiseSchema.index({ chainId: 1, owner: 1 });
const historySchema = new Schema({ chainId: uint, contractAddress: address, tokenId: uint, from: { ...address, required: false, default: null }, to: { ...address, required: false, default: null }, eventName: { type: String, required: true }, evidence, indexedAt: { type: Date, default: Date.now } }, { versionKey: false });
historySchema.index({ chainId: 1, 'evidence.transactionHash': 1, 'evidence.logIndex': 1 }, { unique: true });
historySchema.index({ chainId: 1, contractAddress: 1, tokenId: 1, 'evidence.blockNumber': -1, 'evidence.logIndex': -1 });

module.exports = {
  FranchiseCheckpoint: model('FranchiseCheckpoint', checkpointSchema, 'franchise_checkpoints'),
  FranchiseEvent: model('FranchiseEvent', eventSchema, 'franchise_events'),
  FranchiseCertificate: model('FranchiseCertificate', franchiseSchema, 'franchise_certificates'),
  FranchiseHistory: model('FranchiseHistory', historySchema, 'franchise_history'),
};
