const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Interface } = require('ethers');

const { LendingV2Indexer } = require('../modules/lendingV2Projection/indexer.cjs');
const { loadLendingV2Artifacts } = require('../config/lendingV2Artifacts.cjs');

const HASH = (number) => `0x${number.toString(16).padStart(64, '0')}`;
const ADDRESS = (number) => `0x${number.toString(16).padStart(40, '0')}`;
const BORROWER = ADDRESS(900);
const artifacts = loadLendingV2Artifacts();
const CONTRACT_NAMES = [
  'OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2',
  'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2',
];

function manifest() {
  const contracts = Object.fromEntries(CONTRACT_NAMES.map((name, index) => [name, { address: ADDRESS(index + 1) }]));
  return { chainId: 31337, deploymentVersion: 'lending-v2-confirmation-fixture', deploymentBlock: 86, contracts };
}

class FixtureProvider {
  constructor({ latest = 130, logs = [] } = {}) {
    this.latest = latest;
    this.logs = logs;
    this.blocks = new Map(Array.from({ length: latest + 1 }, (_, block) => [block, { number: block, hash: HASH(10_000 + block) }]));
    this.calls = { logs: [] };
  }
  async getNetwork() { return { chainId: 31337n }; }
  async getCode() { return '0x6000'; }
  async getBlockNumber() { return this.latest; }
  async getBlock(block) { return this.blocks.get(Number(block)) || null; }
  async getLogs(filter) {
    this.calls.logs.push(filter);
    const addresses = new Set((Array.isArray(filter.address) ? filter.address : [filter.address]).map((value) => value.toLowerCase()));
    return this.logs.filter((log) => addresses.has(log.address.toLowerCase()) && log.blockNumber >= Number(filter.fromBlock) && log.blockNumber <= Number(filter.toBlock));
  }
}

class FixtureModels {
  constructor(checkpoint = null) {
    this.checkpoint = checkpoint;
    this.events = [];
    this.failEventPersistence = false;
    this.V2BlockCheckpoint = {
      findOne: () => ({ lean: async () => this.checkpoint }),
      updateOne: async (_identity, update) => {
        this.checkpoint = { ...(this.checkpoint || {}), ...update.$set };
      },
    };
    this.V2ChainEvent = {
      updateOne: async (identity, update) => {
        if (this.failEventPersistence) throw new Error('fixture event persistence failed');
        if (!this.events.some((event) => event.transactionHash === identity.transactionHash && event.logIndex === identity.logIndex)) this.events.push(update.$setOnInsert);
      },
    };
  }
}

function depositLogs(activeManifest) {
  const vault = new Interface(artifacts.CollateralVaultV2.abi);
  const pool = new Interface(artifacts.LendingPoolV2.abi);
  const create = (blockNumber, depositId, transaction) => {
    const transactionHash = HASH(transaction);
    const vaultLog = vault.encodeEventLog(vault.getEvent('DirectDepositCollateralDeposited'), [depositId, BORROWER, 500000000000000000n]);
    const poolLog = pool.encodeEventLog(pool.getEvent('CollateralDepositCreated'), [depositId, BORROWER, 500000000000000000n]);
    return [
      { address: activeManifest.contracts.CollateralVaultV2.address, ...vaultLog, blockNumber, transactionIndex: 0, index: 0, transactionHash, blockHash: HASH(10_000 + blockNumber) },
      { address: activeManifest.contracts.LendingPoolV2.address, ...poolLog, blockNumber, transactionIndex: 0, index: 1, transactionHash, blockHash: HASH(10_000 + blockNumber) },
    ];
  };
  return [...create(129, 1n, 129), ...create(130, 2n, 130)];
}

function subject(provider, models, options = {}) {
  return new LendingV2Indexer({ manifest: options.manifest || manifest(), artifacts, provider, models, logger: { error() {} }, ...options });
}

test('the default V2 indexer retains the two-confirmation policy and holds block 129 when latest is 130', async () => {
  const activeManifest = manifest();
  const provider = new FixtureProvider({ logs: depositLogs(activeManifest) });
  const models = new FixtureModels({ lastProcessedBlock: '128', lastProcessedBlockHash: HASH(10_128) });
  const indexer = subject(provider, models, { manifest: activeManifest });

  assert.equal(indexer.confirmations, 2);
  await indexer.syncOnce();
  assert.equal(models.checkpoint.lastProcessedBlock, '128');
  assert.equal(models.events.length, 0);
  assert.equal(provider.calls.logs.length, 0);
});

test('a local zero-confirmation caller indexes canonical vault and pool deposit events through blocks 129 and 130', async () => {
  const activeManifest = manifest();
  const provider = new FixtureProvider({ logs: depositLogs(activeManifest) });
  const models = new FixtureModels({ lastProcessedBlock: '128', lastProcessedBlockHash: HASH(10_128) });
  const indexer = subject(provider, models, { manifest: activeManifest, confirmations: 0 });

  await indexer.syncOnce();
  assert.equal(models.checkpoint.lastProcessedBlock, '130');
  assert.deepEqual(models.events.map((event) => [event.blockNumber, event.contractName, event.eventName]), [
    ['129', 'CollateralVaultV2', 'DirectDepositCollateralDeposited'],
    ['129', 'LendingPoolV2', 'CollateralDepositCreated'],
    ['130', 'CollateralVaultV2', 'DirectDepositCollateralDeposited'],
    ['130', 'LendingPoolV2', 'CollateralDepositCreated'],
  ]);
  assert.ok(models.events.every((event) => event.args.borrower.toLowerCase() === BORROWER.toLowerCase()));
});

test('the checkpoint advances only after all V2 event persistence succeeds', async () => {
  const activeManifest = manifest();
  const provider = new FixtureProvider({ logs: depositLogs(activeManifest) });
  const models = new FixtureModels({ lastProcessedBlock: '128', lastProcessedBlockHash: HASH(10_128) });
  models.failEventPersistence = true;
  const indexer = subject(provider, models, { manifest: activeManifest, confirmations: 0 });

  await assert.rejects(indexer.syncOnce(), /fixture event persistence failed/);
  assert.equal(models.checkpoint.lastProcessedBlock, '128');
  assert.equal(models.events.length, 0);
});

test('the explicitly local runner requests zero confirmations without changing the reusable default', () => {
  const runner = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'runLendingV2Indexer.cjs'), 'utf8');
  assert.match(runner, /loadLendingV2Manifest/);
  assert.match(runner, /confirmations:\s*0/);
  assert.equal(subject(new FixtureProvider(), new FixtureModels()).confirmations, 2);
});
