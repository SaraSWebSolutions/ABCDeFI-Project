const assert = require('node:assert/strict');
const test = require('node:test');
const { Interface } = require('ethers');
const artifact = require('../../../artifacts/contracts/marketplace/LegionMarketplaceSettlementAdapterV2.sol/LegionMarketplaceSettlementAdapterV2.json');
const legionArtifact = require('../../../artifacts/contracts/nft/LegionNFTV2.sol/LegionNFTV2.json');
const { LegionMarketplaceIndexer } = require('../modules/legionMarketplaceProjection/indexer.cjs');
const iface = new Interface(artifact.abi);
const legionIface = new Interface(legionArtifact.abi);
const address = (value) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value) => `0x${value.toString(16).padStart(64, '0')}`;
const SETTLEMENT = address(99); const LEGION = address(100); const ABCD = address(101); const SELLER = address(2); const BUYER = address(3);
const manifest = { chainId: 31337, deploymentVersion: 'legion-marketplace-fixture', deploymentBlock: 10, settlementAddress: SETTLEMENT, legionAddress: LEGION, abcdAddress: ABCD };
function log(name, values, blockNumber, index, transactionHash) { const encoded = iface.encodeEventLog(iface.getEvent(name), values); return { address: SETTLEMENT, ...encoded, blockNumber, index, transactionHash: hash(transactionHash), blockHash: hash(10_000 + blockNumber) }; }
function legionLog(name, values, blockNumber, index, transactionHash) { const encoded = legionIface.encodeEventLog(legionIface.getEvent(name), values); return { address: LEGION, ...encoded, blockNumber, index, transactionHash: hash(transactionHash), blockHash: hash(10_000 + blockNumber) }; }
class Provider { constructor(logs) { this.logs = logs; } async getNetwork() { return { chainId: 31337n }; } async getCode() { return '0x6000'; } async getBlockNumber() { return 20; } async getBlock(number) { return { number, hash: hash(10_000 + Number(number)) }; } async getLogs(filter) { return this.logs.filter((item) => item.address === filter.address && item.blockNumber >= Number(filter.fromBlock) && item.blockNumber <= Number(filter.toBlock)); } }
class Models {
  constructor() { this.events = []; this.sales = []; this.checkpoint = null; this.LegionMarketplaceEvent = { updateOne: async (filter, update) => { if (this.events.some((item) => item.contractAddress === filter.contractAddress && item.transactionHash === filter.transactionHash && item.logIndex === filter.logIndex)) return { upsertedCount: 0 }; this.events.push(update.$setOnInsert); return { upsertedCount: 1 }; } }; this.LegionMarketplaceSale = { findOne: (filter) => ({ lean: async () => this.sales.find((item) => Object.entries(filter).every(([key, value]) => item[key] === value)) || null }), updateOne: async (filter, update) => { const index = this.sales.findIndex((item) => item.saleId === filter.saleId); if (index < 0) this.sales.push({ ...update.$set }); else this.sales[index] = { ...this.sales[index], ...update.$set }; } }; this.LegionMarketplaceCheckpoint = { findOne: () => ({ lean: async () => this.checkpoint }), updateOne: async (_filter, update) => { this.checkpoint = { ...update.$set }; } }; }
}
test('projects correlated Legion settlement events in numeric block/log order', async () => {
  const logs = [log('SaleCreated', [1n, 7n, SELLER, BUYER, 25n], 10, 0, 1), log('SaleRequestLinked', [1n, 9n, SELLER], 11, 0, 2), log('SaleSettled', [1n, 9n, 7n, SELLER, BUYER, 25n], 12, 0, 3)];
  const models = new Models(); const indexer = new LegionMarketplaceIndexer({ manifest, artifact, provider: new Provider(logs), models }); indexer.settlement.legion = async () => LEGION; indexer.settlement.abcdToken = async () => ABCD;
  const result = await indexer.syncOnce();
  assert.equal(result.processed, 3); assert.equal(models.events.length, 3); assert.equal(models.sales[0].status, 'SETTLED'); assert.equal(models.sales[0].requestId, '9'); assert.equal(models.checkpoint.lastProcessedBlock, '20');
});
test('fails closed when the canonical Legion or ABCD binding is invalid', async () => {
  const models = new Models(); const indexer = new LegionMarketplaceIndexer({ manifest, artifact, provider: new Provider([]), models }); indexer.settlement.legion = async () => LEGION; indexer.settlement.abcdToken = async () => ABCD; indexer.provider.getCode = async () => '0x'; await assert.rejects(indexer.assertDeployment(), /bytecode or bindings are invalid/);
});
test('projects the canonical Legion request and approval lifecycle before settlement', async () => {
  const logs = [log('SaleCreated', [1n, 7n, SELLER, BUYER, 25n], 10, 0, 1), legionLog('TransferRequested', [9n, 7n, SELLER, BUYER], 11, 0, 2), log('SaleRequestLinked', [1n, 9n, SELLER], 12, 0, 3), legionLog('TransferApproved', [9n, address(4)], 13, 0, 4)];
  const models = new Models(); const indexer = new LegionMarketplaceIndexer({ manifest, artifact, legionArtifact, provider: new Provider(logs), models }); indexer.settlement.legion = async () => LEGION; indexer.settlement.abcdToken = async () => ABCD;
  await indexer.syncOnce();
  assert.equal(models.sales[0].requestId, '9'); assert.equal(models.sales[0].status, 'READY_FOR_SETTLEMENT'); assert.equal(models.events.length, 4);
});
