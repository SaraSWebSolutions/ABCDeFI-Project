const mongoose = require('mongoose');
const { Schema } = mongoose;
const address = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{40}$/ };
const hash = { type: String, required: true, lowercase: true, match: /^0x[a-f0-9]{64}$/ };
const uint = { type: String, required: true, match: /^\d+$/ };
function model(name, schema, collection) { return mongoose.models[name] || mongoose.model(name, schema, collection); }

const eventSchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, contractAddress: address, contractName: { type: String, required: true },
  transactionHash: hash, blockNumber: uint, transactionIndex: { type: Number, required: true }, logIndex: { type: Number, required: true },
  blockHash: hash, eventName: { type: String, required: true }, args: { type: Schema.Types.Mixed, required: true }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
eventSchema.index({ chainId: 1, deploymentVersion: 1, transactionHash: 1, logIndex: 1 }, { unique: true });
eventSchema.index({ chainId: 1, deploymentVersion: 1, blockNumber: 1, logIndex: 1 });

const checkpointSchema = new Schema({
  chainId: uint, deploymentVersion: { type: String, required: true }, scope: { type: String, required: true },
  lastProcessedBlock: { type: String, default: null, match: /^\d+$/ }, lastProcessedBlockHash: { type: String, default: null }, indexedAt: { type: Date, default: Date.now },
}, { versionKey: false });
checkpointSchema.index({ chainId: 1, deploymentVersion: 1, scope: 1 }, { unique: true });

module.exports = Object.freeze({
  V2ChainEvent: model('LendingV2ChainEvent', eventSchema, 'lending_v2_chain_events'),
  V2BlockCheckpoint: model('LendingV2BlockCheckpoint', checkpointSchema, 'lending_v2_block_checkpoints'),
});
