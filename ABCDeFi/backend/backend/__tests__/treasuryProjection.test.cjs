const assert = require('node:assert/strict');
const test = require('node:test');
const { Interface } = require('ethers');
const artifact = require('../../../artifacts/contracts/treasury/TreasuryV2.sol/TreasuryV2.json');
const { TreasuryIndexer } = require('../modules/treasuryProjection/indexer.cjs');

const iface = new Interface(artifact.abi);
const address = (value) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value) => `0x${value.toString(16).padStart(64, '0')}`;
const TREASURY = address(99); const ABCD = address(100); const FUNDER = address(2); const RECIPIENT = address(3); const ADMIN = address(4);
const manifest = { chainId: 31337, deploymentVersion: 'treasury-fixture', deploymentBlock: 10, treasuryAddress: TREASURY, abcdAddress: ABCD };

function log(name, values, blockNumber, index, transactionHash) {
  const encoded = iface.encodeEventLog(iface.getEvent(name), values);
  return { address: TREASURY, ...encoded, blockNumber, index, transactionHash: hash(transactionHash), blockHash: hash(10_000 + blockNumber) };
}

class Provider {
  constructor(logs) { this.logs = logs; }
  async getNetwork() { return { chainId: 31337n }; }
  async getCode() { return '0x6000'; }
  async getBlockNumber() { return 20; }
  async getBlock(number) { return { number, hash: hash(10_000 + Number(number)) }; }
  async getLogs(filter) {
    const requestedTopics = filter.topics?.[0] || [];
    return this.logs.filter((item) => (
      item.blockNumber >= Number(filter.fromBlock)
      && item.blockNumber <= Number(filter.toBlock)
      && requestedTopics.includes(item.topics[0])
    ));
  }
}

class Models {
  constructor() {
    this.events = []; this.assets = []; this.checkpoint = null;
    this.TreasuryEvent = {
      updateOne: async (filter, update) => {
        if (this.events.some((item) => item.transactionHash === filter.transactionHash && item.logIndex === filter.logIndex)) return { upsertedCount: 0 };
        this.events.push(update.$setOnInsert); return { upsertedCount: 1 };
      },
    };
    this.TreasuryAsset = {
      updateOne: async (filter, update) => {
        const index = this.assets.findIndex((item) => item.asset === filter.asset);
        if (index < 0) this.assets.push({ ...update.$set }); else this.assets[index] = { ...this.assets[index], ...update.$set };
      },
    };
    this.TreasuryCheckpoint = {
      findOne: () => ({ lean: async () => this.checkpoint }),
      updateOne: async (_filter, update) => { this.checkpoint = { ...this.checkpoint, ...update.$set }; },
    };
  }
}

function createIndexer(logs, models = new Models()) {
  const indexer = new TreasuryIndexer({ manifest, artifact, provider: new Provider(logs), models });
  indexer.contract.supportedAsset = async () => true;
  indexer.contract.accountedBalance = async () => 0n;
  return { indexer, models };
}

test('projects canonical TreasuryV2 events, including inherited pause events, in block/log order and checkpoints the chain', async () => {
  const logs = [
    log('AssetConfigured', [ABCD, true, ADMIN], 10, 0, 1),
    log('FunderConfigured', [FUNDER, true, ADMIN], 11, 0, 2),
    log('TreasuryFunded', [hash(1), ABCD, FUNDER, 25n, 25n], 12, 0, 3),
    log('Paused', [ADMIN], 13, 0, 4),
    log('TreasuryPaused', [ADMIN], 13, 1, 4),
    log('TreasuryTransferExecuted', [hash(2), ABCD, RECIPIENT, 25n, 0n], 14, 0, 5),
    log('Unpaused', [ADMIN], 15, 0, 6),
    log('TreasuryUnpaused', [ADMIN], 15, 1, 6),
  ];
  const { indexer, models } = createIndexer(logs);
  const result = await indexer.syncOnce();
  assert.equal(result.processed, 8);
  assert.deepEqual(models.events.map((event) => event.eventName), [
    'AssetConfigured', 'FunderConfigured', 'TreasuryFunded', 'Paused', 'TreasuryPaused',
    'TreasuryTransferExecuted', 'Unpaused', 'TreasuryUnpaused',
  ]);
  assert.equal(models.assets[0].accountedBalance, '0');
  assert.equal(models.checkpoint.lastProcessedBlock, '20');
});

test('reconciles a newly allowlisted inherited pause event from canonical RPC without rewinding a valid checkpoint', async () => {
  const inheritedPause = log('Paused', [ADMIN], 13, 0, 4);
  const customPause = log('TreasuryPaused', [ADMIN], 13, 1, 4);
  const models = new Models();
  models.checkpoint = { lastProcessedBlock: '20', lastProcessedBlockHash: hash(10_020) };
  models.events.push({ transactionHash: customPause.transactionHash, logIndex: 1, eventName: 'TreasuryPaused' });
  const { indexer } = createIndexer([inheritedPause, customPause], models);
  const result = await indexer.syncOnce();
  assert.equal(result.checkpoint, '20');
  assert.equal(result.processed, 1);
  assert.deepEqual(models.events.map((event) => event.eventName), ['TreasuryPaused', 'Paused']);
  assert.equal(models.checkpoint.lastProcessedBlock, '20');
  assert.equal(models.checkpoint.lastProcessedBlockHash, hash(10_020));
});

test('fails closed when deployment validation or checkpoint continuity is invalid', async () => {
  const { indexer, models } = createIndexer([]);
  indexer.provider.getCode = async () => '0x';
  await assert.rejects(indexer.assertDeployment(), /bytecode or ABCD configuration is invalid/);
  indexer.provider.getCode = async () => '0x6000';
  models.checkpoint = { lastProcessedBlock: '19', lastProcessedBlockHash: hash(1) };
  await assert.rejects(indexer.syncOnce(), /checkpoint does not match active chain/);
});
