const assert = require('node:assert/strict');
const test = require('node:test');
const { Interface } = require('ethers');

const artifact = require('../../../artifacts/contracts/marketplace/ABCDNFTMarketplaceV2.sol/ABCDNFTMarketplaceV2.json');
const { ABCDMarketplaceIndexer } = require('../modules/abcdMarketplaceProjection/indexer.cjs');
const iface = new Interface(artifact.abi);
const address = (value) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value) => `0x${value.toString(16).padStart(64, '0')}`;
const MARKET = address(99); const ABCD = address(100); const COLLECTION = address(101); const SELLER = address(2); const BUYER = address(3); const ADMIN = address(4);
const manifest = { chainId: 31337, deploymentVersion: 'marketplace-fixture', deploymentBlock: 10, marketplaceAddress: MARKET, abcdAddress: ABCD };

function log(name, values, blockNumber, index, transactionHash) {
  const encoded = iface.encodeEventLog(iface.getEvent(name), values);
  return { address: MARKET, ...encoded, blockNumber, index, transactionHash: hash(transactionHash), blockHash: hash(10_000 + blockNumber) };
}

class Provider {
  constructor(logs) { this.logs = logs; }
  async getNetwork() { return { chainId: 31337n }; }
  async getCode() { return '0x6000'; }
  async getBlockNumber() { return 20; }
  async getBlock(number) { return { number, hash: hash(10_000 + Number(number)) }; }
  async getLogs(filter) { return this.logs.filter((item) => item.blockNumber >= Number(filter.fromBlock) && item.blockNumber <= Number(filter.toBlock)); }
}

class Models {
  constructor() {
    this.events = []; this.listings = []; this.collections = []; this.checkpoint = null;
    this.MarketplaceEvent = { updateOne: async (filter, update) => { if (this.events.some((item) => item.transactionHash === filter.transactionHash && item.logIndex === filter.logIndex)) return { upsertedCount: 0 }; this.events.push(update.$setOnInsert); return { upsertedCount: 1 }; } };
    this.MarketplaceListing = { updateOne: async (filter, update) => { const index = this.listings.findIndex((item) => item.listingId === filter.listingId); if (index < 0) this.listings.push({ ...update.$set }); else this.listings[index] = { ...this.listings[index], ...update.$set }; } };
    this.MarketplaceCollection = { updateOne: async (filter, update) => { const index = this.collections.findIndex((item) => item.collection === filter.collection); if (index < 0) this.collections.push({ ...update.$set }); else this.collections[index] = { ...this.collections[index], ...update.$set }; } };
    this.MarketplaceCheckpoint = { findOne: () => ({ lean: async () => this.checkpoint }), updateOne: async (_filter, update) => { this.checkpoint = { ...update.$set }; } };
  }
}

test('projects canonical marketplace events in block/log order and preserves the sold listing state', async () => {
  const logs = [
    log('CollectionConfigured', [COLLECTION, true, ADMIN], 10, 0, 1),
    log('ListingCreated', [1n, COLLECTION, 7n, SELLER, 25n], 11, 0, 2),
    log('ListingPurchased', [1n, COLLECTION, 7n, SELLER, BUYER, 25n], 12, 0, 3),
  ];
  const models = new Models();
  const indexer = new ABCDMarketplaceIndexer({ manifest, artifact, provider: new Provider(logs), models, confirmations: 0, logger: { error() {}, info() {} } });
  indexer.market.abcdToken = async () => ABCD;
  const result = await indexer.syncOnce();
  assert.equal(result.processed, 3);
  assert.equal(models.events.length, 3);
  assert.equal(models.collections[0].supported, true);
  assert.equal(models.listings[0].status, 'SOLD');
  assert.equal(models.listings[0].buyer, BUYER);
  assert.equal(models.checkpoint.lastProcessedBlock, '20');
});

test('fails closed when the marketplace bytecode or immutable ABCD binding is invalid', async () => {
  const models = new Models();
  const indexer = new ABCDMarketplaceIndexer({ manifest, artifact, provider: new Provider([]), models, logger: { error() {}, info() {} } });
  indexer.market.abcdToken = async () => ABCD;
  indexer.provider.getCode = async () => '0x';
  await assert.rejects(indexer.assertDeployment(), /bytecode or ABCD binding is invalid/);
});
