const mongoose = require('mongoose');
const { Schema } = mongoose;
const model = (name, schema, collection) => mongoose.models[name] || mongoose.model(name, schema, collection);
const address = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const hash = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const uint = { type: String, required: true, match: /^\d+$/ };
const runtime = { runtimeFamily: { type: String, default: null }, rpcUrl: { type: String, default: null }, deploymentIdentity: { type: String, default: null }, contractRuntimeIdentity: { type: String, default: null } };
const scope = { chainId: uint, deploymentVersion: { type: String, required: true }, ...runtime, registryAddress: address };

const franchise = new Schema({
  ...scope, tokenId: uint, legionContract: address, legionTokenId: uint, owner: address, operator: address,
  status: { type: String, required: true, enum: ['ACTIVE', 'SUSPENDED', 'REVOKED'] }, operatorVersion: uint,
  metadataURI: { type: String, required: true }, activeTransferRequestId: { type: String, default: '0', match: /^\d+$/ }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
franchise.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, tokenId: 1 }, { unique: true });
franchise.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, owner: 1, tokenId: 1 });

const application = new Schema({
  ...scope, applicationId: uint, applicant: address, legionTokenId: uint, metadataURI: { type: String, required: true },
  status: { type: String, required: true, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'MINTED'] }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
application.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, applicationId: 1 }, { unique: true });
application.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, applicant: 1, applicationId: 1 });

const request = new Schema({
  ...scope, requestId: uint, tokenId: uint, currentOperator: address, proposedOperator: address, operatorVersion: uint,
  active: { type: Boolean, required: true }, approved: { type: Boolean, required: true }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
request.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, requestId: 1 }, { unique: true });
request.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, tokenId: 1, active: 1 });

const event = new Schema({
  ...scope, transactionHash: hash, blockNumber: uint, transactionIndex: { type: Number, required: true }, logIndex: { type: Number, required: true }, blockHash: hash,
  eventName: { type: String, required: true }, tokenId: { type: String, default: null }, applicationId: { type: String, default: null }, requestId: { type: String, default: null }, args: { type: Schema.Types.Mixed, required: true }, removed: { type: Boolean, default: false }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
event.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
event.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, tokenId: 1, blockNumber: 1, logIndex: 1 });

const checkpoint = new Schema({
  ...scope, scope: { type: String, required: true }, lastProcessedBlock: { type: String, default: null, match: /^\d+$/ }, lastProcessedBlockHash: { type: String, default: null }, paused: { type: Boolean, default: false }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
checkpoint.index({ chainId: 1, deploymentVersion: 1, registryAddress: 1, scope: 1 }, { unique: true });

module.exports = Object.freeze({
  FranchiseV2: model('FranchiseV2', franchise, 'franchise_v2_certificates'),
  FranchiseV2Application: model('FranchiseV2Application', application, 'franchise_v2_applications'),
  FranchiseV2TransferRequest: model('FranchiseV2TransferRequest', request, 'franchise_v2_transfer_requests'),
  FranchiseV2Event: model('FranchiseV2Event', event, 'franchise_v2_events'),
  FranchiseV2Checkpoint: model('FranchiseV2Checkpoint', checkpoint, 'franchise_v2_checkpoints'),
});
