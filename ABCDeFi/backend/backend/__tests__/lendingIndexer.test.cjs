const test = require('node:test');
const assert = require('node:assert/strict');
const { Interface } = require('ethers');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadLendingManifest } = require('../config/lendingManifest.cjs');
const { loadCanonicalLendingArtifacts } = require('../config/lendingArtifacts.cjs');
const { LendingIndexer, DeterministicEventError, decodeLog } = require('../modules/lendingProjection/indexer');

// All values below are deterministic test fixtures only. They are never read by production code.
const FIXTURE_HASH = (number) => `0x${number.toString(16).padStart(64, '0')}`;
const FIXTURE_ADDRESS = (number) => `0x${number.toString(16).padStart(40, '0')}`;
const artifacts = loadCanonicalLendingArtifacts();
const baseManifest = loadLendingManifest();

function fixtureManifest() {
  // Test ranges are intentionally anchored at block 1. Do not inherit the
  // mutable deployment block from the currently running local Hardhat chain:
  // doing so would make this deterministic unit suite depend on deployment
  // history rather than the explicit fixture below.
  return {
    ...baseManifest,
    deploymentVersion: 'phase3a-indexer-test-v1',
    deploymentBlock: 1,
    contracts: { ...baseManifest.contracts },
    rawContracts: { ...baseManifest.rawContracts },
  };
}

class FixtureStore {
  constructor() { this.events = new Map(); this.checkpoint = null; this.deployments = []; this.removedFrom = []; this.failInsert = 0; this.insertAttempts = 0; }
  async recordDeployment(manifest) { this.deployments.push(manifest.deploymentVersion); }
  async getCheckpoint() { return this.checkpoint; }
  async saveCheckpoint(_identity, checkpoint) { this.checkpoint = { ...checkpoint }; }
  async insertRawEvent(event) {
    this.insertAttempts += 1;
    if (this.failInsert > 0) { this.failInsert -= 1; throw new Error('fixture database unavailable'); }
    const key = `${event.chainId}:${event.transactionHash}:${event.logIndex}`;
    if (this.events.has(key)) { this.events.get(key).removed = Boolean(event.removed); return { inserted: false }; }
    this.events.set(key, { ...event }); return { inserted: true };
  }
  async markRawEventRemoved(identity) {
    const key = `${identity.chainId}:${identity.transactionHash}:${identity.logIndex}`;
    if (this.events.has(key)) this.events.get(key).removed = true;
  }
  async canonicalEventsDescending(chainId, maxBlock) {
    return [...this.events.values()].filter((event) => event.chainId === String(chainId) && !event.removed && Number(event.blockNumber) <= maxBlock)
      .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber) || b.logIndex - a.logIndex);
  }
  async markEventsRemovedFromBlock(_chainId, firstRemovedBlock) {
    this.removedFrom.push(firstRemovedBlock);
    for (const event of this.events.values()) if (Number(event.blockNumber) >= firstRemovedBlock) event.removed = true;
  }
}

class FixtureProvider {
  constructor({ latest = 4, logs = [], chainId = 31337 } = {}) {
    this.latest = latest; this.logs = logs; this.chainId = chainId; this.calls = { getLogs: [], getBlock: 0, getBlockNumber: 0 };
    this.blocks = new Map(Array.from({ length: latest + 1 }, (_, number) => [number, { number, hash: FIXTURE_HASH(1000 + number) }]));
    this.failGetBlockNumber = 0;
  }
  async getNetwork() { return { chainId: BigInt(this.chainId) }; }
  async getBlockNumber() { this.calls.getBlockNumber += 1; if (this.failGetBlockNumber-- > 0) throw new Error('fixture RPC unavailable'); return this.latest; }
  async getBlock(number) { this.calls.getBlock += 1; return this.blocks.get(Number(number)) || null; }
  async getLogs(filter) {
    this.calls.getLogs.push(filter);
    const addresses = Array.isArray(filter.address) ? filter.address.map((value) => value.toLowerCase()) : [filter.address.toLowerCase()];
    const topicFilter = filter.topics && filter.topics[0];
    const topics = Array.isArray(topicFilter) ? topicFilter.map((value) => value.toLowerCase()) : [topicFilter && topicFilter.toLowerCase()];
    return this.logs.filter((log) =>
      Number(log.blockNumber) >= Number(filter.fromBlock) &&
      Number(log.blockNumber) <= Number(filter.toBlock) &&
      addresses.includes(log.address.toLowerCase()) &&
      (!topicFilter || topics.includes(log.topics[0].toLowerCase()))
    );
  }
}

function fixtureLog({ blockNumber = 1, transactionIndex = 0, logIndex = 0, transaction = 1, eventName = 'RequestCreated', args = ['1', FIXTURE_ADDRESS(1), '100', '50'], removed = false } = {}) {
  const iface = new Interface(artifacts.loanMarketplace.abi);
  const fragment = iface.getEvent(eventName);
  const encoded = iface.encodeEventLog(fragment, args);
  return {
    address: baseManifest.contracts.loanMarketplace,
    topics: encoded.topics,
    data: encoded.data,
    blockNumber,
    transactionIndex,
    index: logIndex,
    transactionHash: FIXTURE_HASH(transaction),
    blockHash: FIXTURE_HASH(1000 + blockNumber),
    removed,
  };
}

function indexer(provider, store, overrides = {}) {
  return new LendingIndexer({
    manifest: fixtureManifest(), artifacts, provider, store, logger: { info() {}, warn() {}, error() {} },
    options: { confirmationDepth: 0, blockRange: 2, retryAttempts: 3, retryDelayMs: 0, pollIntervalMs: 100, ...overrides },
    sleep: async () => {},
  });
}

test('discovers the deployment block when no checkpoint exists', async () => {
  const subject = indexer(new FixtureProvider({ latest: 1 }), new FixtureStore());
  assert.equal(await subject.getStartBlock(), 1);
});

test('backfills historical logs from the manifest deployment block', async () => {
  const store = new FixtureStore(); const provider = new FixtureProvider({ latest: 3, logs: [fixtureLog({ blockNumber: 1 }), fixtureLog({ blockNumber: 3, transaction: 2 })] });
  const result = await indexer(provider, store).syncOnce();
  assert.equal(result.startBlock, 1); assert.equal(store.events.size, 2); assert.equal(store.checkpoint.lastProcessedBlock, '3');
});

test('uses bounded block ranges for RPC log requests', async () => {
  const provider = new FixtureProvider({ latest: 5 });
  const subject = indexer(provider, new FixtureStore(), { blockRange: 2 }); await subject.syncOnce();
  assert.equal(provider.calls.getLogs.length, subject.registry.definitions.length * 3);
  assert.deepEqual([...new Set(provider.calls.getLogs.map((filter) => `${filter.fromBlock}-${filter.toBlock}`))], ['1-2', '3-4', '5-5']);
  for (const filter of provider.calls.getLogs) {
    assert.equal(typeof filter.address, 'string');
    assert.equal(typeof filter.topics[0], 'string');
  }
});

test('decodes a canonical artifact event and normalizes uint values', () => {
  const subject = indexer(new FixtureProvider(), new FixtureStore());
  const event = decodeLog({ ...fixtureLog(), chainId: '31337' }, subject.registry.registry);
  assert.equal(event.eventName, 'RequestCreated'); assert.equal(event.eventSignature, 'RequestCreated(uint256,address,uint256,uint256)');
  assert.equal(event.args.requestId, '1'); assert.equal(event.args.principal, '100');
});

test('inserts raw ChainEvent data with the canonical identity', async () => {
  const store = new FixtureStore(); const subject = indexer(new FixtureProvider(), store);
  const result = await subject.processEvent(fixtureLog());
  assert.equal(result.inserted, true); assert.equal(store.events.size, 1);
  const event = [...store.events.values()][0]; assert.equal(event.chainId, '31337'); assert.equal(event.logIndex, 0);
});

test('protects against duplicate raw events', async () => {
  const store = new FixtureStore(); const subject = indexer(new FixtureProvider(), store); const log = fixtureLog();
  assert.equal((await subject.processEvent(log)).inserted, true); assert.equal((await subject.processEvent(log)).inserted, false); assert.equal(store.events.size, 1);
});

test('creates a persistent checkpoint after a processed block', async () => {
  const store = new FixtureStore(); await indexer(new FixtureProvider({ latest: 1 }), store).syncOnce();
  assert.equal(store.checkpoint.lastProcessedBlock, '1'); assert.equal(store.checkpoint.lastProcessedBlockHash, FIXTURE_HASH(1001));
});

test('resumes from the block after a valid checkpoint', async () => {
  const store = new FixtureStore(); store.checkpoint = { lastProcessedBlock: '2', lastProcessedBlockHash: FIXTURE_HASH(1002) };
  const provider = new FixtureProvider({ latest: 3 }); const subject = indexer(provider, store); const result = await subject.syncOnce();
  assert.equal(result.startBlock, 3); assert.equal(provider.calls.getLogs.length, subject.registry.definitions.length);
  assert.ok(provider.calls.getLogs.every((filter) => filter.fromBlock === 3 && filter.toBlock === 3));
});

test('holds the unconfirmed chain tip back by configured confirmation depth', async () => {
  const store = new FixtureStore(); const result = await indexer(new FixtureProvider({ latest: 8 }), store, { confirmationDepth: 2 }).syncOnce();
  assert.equal(result.targetBlock, 6); assert.equal(store.checkpoint.lastProcessedBlock, '6');
});

test('retries transient RPC failures', async () => {
  const provider = new FixtureProvider({ latest: 1 }); provider.failGetBlockNumber = 1;
  await indexer(provider, new FixtureStore()).syncOnce(); assert.equal(provider.calls.getBlockNumber, 2);
});

test('bounds permanent RPC retries to the configured attempt count', async () => {
  const provider = new FixtureProvider({ latest: 1 }); provider.getBlockNumber = async () => { provider.calls.getBlockNumber += 1; throw new Error('fixture RPC unavailable'); };
  await assert.rejects(() => indexer(provider, new FixtureStore(), { retryAttempts: 3 }).syncOnce());
  assert.equal(provider.calls.getBlockNumber, 3);
});

test('retries transient database insertion failures', async () => {
  const store = new FixtureStore(); store.failInsert = 1;
  await indexer(new FixtureProvider({ latest: 1, logs: [fixtureLog()] }), store).syncOnce(); assert.equal(store.events.size, 1);
});

test('bounds permanent database retries to the configured attempt count', async () => {
  const store = new FixtureStore(); store.failInsert = 10;
  await assert.rejects(() => indexer(new FixtureProvider({ latest: 1, logs: [fixtureLog()] }), store, { retryAttempts: 3 }).syncOnce());
  assert.equal(store.insertAttempts, 3);
});

test('restarts gracefully without duplicating an already indexed event', async () => {
  const store = new FixtureStore(); const provider = new FixtureProvider({ latest: 1, logs: [fixtureLog()] });
  const first = indexer(provider, store); await first.syncOnce(); await first.stop();
  const second = indexer(provider, store); await second.syncOnce(); assert.equal(store.events.size, 1);
});

test('waits for the in-flight block and its checkpoint during graceful shutdown', async () => {
  const store = new FixtureStore(); const provider = new FixtureProvider({ latest: 1 });
  let entered; const enteredBlockRead = new Promise((resolve) => { entered = resolve; });
  let release; const releaseBlockRead = new Promise((resolve) => { release = resolve; });
  provider.getBlock = async (number) => { entered(); await releaseBlockRead; return provider.blocks.get(Number(number)); };
  const subject = indexer(provider, store); const started = subject.start(); await enteredBlockRead;
  const stopping = subject.stop(); release(); await Promise.all([started, stopping]);
  assert.equal(store.checkpoint.lastProcessedBlock, '1'); assert.equal(subject.running, false);
});

test('validates the previous checkpoint block hash before advancing', async () => {
  const store = new FixtureStore(); store.checkpoint = { lastProcessedBlock: '1', lastProcessedBlockHash: FIXTURE_HASH(9999) };
  const provider = new FixtureProvider({ latest: 2 }); const result = await indexer(provider, store).syncOnce();
  assert.equal(result.startBlock, 1); assert.deepEqual(store.removedFrom, [1]);
});

test('detects a reorg, marks divergent raw events removed, and resumes from an ancestor', async () => {
  const store = new FixtureStore(); const canonical = fixtureLog({ blockNumber: 1 }); const divergent = { ...fixtureLog({ blockNumber: 2, transaction: 2 }), blockHash: FIXTURE_HASH(9002) };
  const provider = new FixtureProvider({ latest: 3, logs: [canonical] });
  const subject = indexer(provider, store); await subject.processEvent(canonical); await subject.processEvent(divergent);
  store.checkpoint = { lastProcessedBlock: '2', lastProcessedBlockHash: FIXTURE_HASH(9999) };
  const result = await subject.syncOnce();
  assert.equal(result.startBlock, 2); assert.equal(store.removedFrom[0], 2);
  assert.equal([...store.events.values()].find((event) => event.blockNumber === '2').removed, true);
});

test('restores a removed raw log when the same canonical event reappears', async () => {
  const store = new FixtureStore(); const subject = indexer(new FixtureProvider(), store); const log = fixtureLog();
  await subject.processEvent(log); await subject.processEvent({ ...log, removed: true }); await subject.processEvent(log);
  assert.equal([...store.events.values()][0].removed, false);
});

test('marks a supplied removed log as reverted without deleting its raw record', async () => {
  const store = new FixtureStore(); const subject = indexer(new FixtureProvider(), store); const log = fixtureLog();
  await subject.processEvent(log); await subject.processEvent({ ...log, removed: true });
  assert.equal([...store.events.values()][0].removed, true);
});

test('surfaces malformed logs without inserting them or retrying deterministic errors', async () => {
  const store = new FixtureStore(); const subject = indexer(new FixtureProvider(), store);
  const malformed = { ...fixtureLog(), data: '0x1234' };
  await assert.rejects(() => subject.processEvent(malformed), DeterministicEventError);
  assert.equal(store.events.size, 0);
});

test('rejects an event from an address outside the canonical manifest', async () => {
  const store = new FixtureStore(); const subject = indexer(new FixtureProvider(), store);
  await assert.rejects(() => subject.processEvent({ ...fixtureLog(), address: FIXTURE_ADDRESS(999) }), DeterministicEventError);
  assert.equal(store.events.size, 0);
});

test('rejects an RPC chain ID that differs from the canonical manifest', async () => {
  await assert.rejects(() => indexer(new FixtureProvider({ chainId: 97 }), new FixtureStore()).syncOnce(), /does not match canonical manifest/);
});

test('rejects a malformed canonical deployment manifest', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'abcdefi-indexer-manifest-fixture-'));
  const fixturePath = path.join(directory, 'deployments.json');
  const invalidManifest = JSON.parse(fs.readFileSync(baseManifest.manifestPath, 'utf8'));
  invalidManifest.chainId = 'not-a-chain-id'; fs.writeFileSync(fixturePath, JSON.stringify(invalidManifest));
  const originalPath = process.env.LENDING_MANIFEST_PATH;
  try {
    process.env.LENDING_MANIFEST_PATH = fixturePath;
    assert.throws(() => loadLendingManifest(), /invalid chainId/);
  } finally {
    if (originalPath === undefined) delete process.env.LENDING_MANIFEST_PATH;
    else process.env.LENDING_MANIFEST_PATH = originalPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('never processes a range before the canonical deployment block', async () => {
  await assert.rejects(() => indexer(new FixtureProvider(), new FixtureStore()).processRange(0, 0), DeterministicEventError);
});
