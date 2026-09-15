const assert = require('node:assert/strict');
const test = require('node:test');
const { Interface } = require('ethers');

const { loadLegionCredentialArtifact } = require('../config/legionCredentialArtifacts.cjs');
const { LegionCredentialIndexer } = require('../modules/legionCredentialProjection/indexer.cjs');

const artifact = loadLegionCredentialArtifact();
const iface = new Interface(artifact.abi);
const ADDRESS = (value) => `0x${value.toString(16).padStart(40, '0')}`;
const HASH = (value) => `0x${value.toString(16).padStart(64, '0')}`;
const ADMIN = ADDRESS(1);
const HOLDER = ADDRESS(2);
const NEW_HOLDER = ADDRESS(3);
const CONTRACT = ADDRESS(99);

function manifest() { return { chainId: 31337, deploymentVersion: 'legion-v2-fixture', deploymentBlock: 10, contractAddress: CONTRACT }; }
function evidenceBlock(block) { return { number: block, hash: HASH(10_000 + block) }; }
function log(name, values, blockNumber, index, tx) {
  const encoded = iface.encodeEventLog(iface.getEvent(name), values);
  return { address: CONTRACT, ...encoded, blockNumber, transactionIndex: 0, index, transactionHash: HASH(tx), blockHash: HASH(10_000 + blockNumber) };
}

class Provider {
  constructor(logs) { this.logs = logs; this.latest = 20; this.blocks = new Map(Array.from({ length: 21 }, (_, index) => [index, evidenceBlock(index)])); }
  async getNetwork() { return { chainId: 31337n }; }
  async getCode() { return '0x6000'; }
  async getBlockNumber() { return this.latest; }
  async getBlock(number) { return this.blocks.get(Number(number)) || null; }
  async getLogs(filter) { return this.logs.filter((item) => item.blockNumber >= Number(filter.fromBlock) && item.blockNumber <= Number(filter.toBlock)); }
}

class Models {
  constructor() {
    this.events = []; this.credentials = []; this.checkpoint = null;
    this.LegionCredentialEvent = {
      updateOne: async (identity, update) => {
        assert.equal(Object.hasOwn(update.$setOnInsert, 'removed'), false, 'removed must not be written through $setOnInsert');
        assert.equal(Object.hasOwn(update.$setOnInsert, 'indexedAt'), false, 'indexedAt must not be written through $setOnInsert');
        assert.equal(Object.hasOwn(update.$set, 'removed'), true, 'removed must be replayed through $set');
        if (this.events.some((item) => item.transactionHash === identity.transactionHash && item.logIndex === identity.logIndex)) return { upsertedCount: 0 };
        this.events.push(update.$setOnInsert); return { upsertedCount: 1 };
      },
    };
    this.LegionCredential = {
      findOne: (filter) => ({ lean: async () => this.credentials.find((item) => item.tokenId === filter.tokenId && item.contractAddress === filter.contractAddress) || null }),
      updateOne: async (filter, update) => {
        const index = this.credentials.findIndex((item) => item.tokenId === filter.tokenId && item.contractAddress === filter.contractAddress);
        if (index >= 0) this.credentials[index] = { ...this.credentials[index], ...update.$set };
        else this.credentials.push(update.$set);
      },
    };
    this.LegionCredentialCheckpoint = {
      findOne: () => ({ lean: async () => this.checkpoint }),
      updateOne: async (_identity, update) => { this.checkpoint = { ...(this.checkpoint || {}), ...update.$set }; },
    };
  }
}

function subject(logs) {
  const models = new Models();
  const indexer = new LegionCredentialIndexer({ manifest: manifest(), artifact, provider: new Provider(logs), models, confirmations: 0, logger: { error() {}, info() {} } });
  return { indexer, models };
}

function state(owner, status = 'ACTIVE', category = 'Recognized Participant', metadataURI = 'ipfs://bafybeilegion/metadata.json') {
  return { chainId: '31337', deploymentVersion: 'legion-v2-fixture', contractAddress: CONTRACT, tokenId: '1', owner, active: status === 'ACTIVE', status, category, metadataURI, issuedAt: '100', updatedAt: '101' };
}

test('projects canonical mint events without territorial, financial, or mock fields', async () => {
  const events = [
    log('Transfer', [ADDRESS(0), HOLDER, 1n], 11, 0, 1),
    log('LegionCredentialMinted', [1n, HOLDER, 'Recognized Participant', 'ipfs://bafybeilegion/metadata.json'], 11, 1, 1),
  ];
  const { indexer, models } = subject(events);
  indexer.readCredential = async (_tokenId, latestEvidence) => ({ ...state(HOLDER), latestEvidence });
  await indexer.syncOnce();
  assert.equal(models.events.length, 2);
  assert.equal(models.credentials.length, 1);
  assert.deepEqual(Object.keys(models.credentials[0]).filter((key) => ['territory', 'population', 'treasuryShareBps', 'commission'].includes(key)), []);
  assert.equal(models.credentials[0].owner, HOLDER);
  assert.equal(models.credentials[0].active, true);
  assert.equal(models.credentials[0].mintEvidence.eventName, 'LegionCredentialMinted');
});

test('reconciles metadata, category/status, suspension, reactivation, revocation, and migration from canonical events', async () => {
  const events = [
    log('LegionCredentialMetadataUpdated', [1n, 'ipfs://old', 'ipfs://new'], 11, 0, 2),
    log('LegionCredentialCategoryUpdated', [1n, 'Participant', 'Contributor'], 12, 0, 3),
    log('LegionCredentialSuspended', [1n, HOLDER], 13, 0, 4),
    log('LegionCredentialReactivated', [1n, HOLDER], 14, 0, 5),
    log('Transfer', [HOLDER, NEW_HOLDER, 1n], 15, 0, 6),
    log('LegionCredentialMigrated', [1n, HOLDER, NEW_HOLDER], 15, 1, 6),
    log('LegionCredentialRevoked', [1n, NEW_HOLDER], 16, 0, 7),
  ];
  const states = [
    state(HOLDER, 'ACTIVE', 'Recognized Participant', 'ipfs://new'),
    state(HOLDER, 'ACTIVE', 'Contributor', 'ipfs://new'),
    state(HOLDER, 'SUSPENDED', 'Contributor', 'ipfs://new'),
    state(HOLDER, 'ACTIVE', 'Contributor', 'ipfs://new'),
    state(NEW_HOLDER, 'ACTIVE', 'Contributor', 'ipfs://new'),
    state(NEW_HOLDER, 'ACTIVE', 'Contributor', 'ipfs://new'),
    state(NEW_HOLDER, 'REVOKED', 'Contributor', 'ipfs://new'),
  ];
  const { indexer, models } = subject(events);
  indexer.readCredential = async (_tokenId, latestEvidence) => ({ ...states.shift(), latestEvidence });
  await indexer.syncOnce();
  assert.equal(models.events.length, 7);
  assert.equal(models.credentials[0].owner, NEW_HOLDER);
  assert.equal(models.credentials[0].status, 'REVOKED');
  assert.equal(models.credentials[0].active, false);
  assert.equal(models.credentials[0].category, 'Contributor');
  assert.equal(models.credentials[0].metadataURI, 'ipfs://new');
});

test('does not duplicate projected state or historical events when a block range is replayed', async () => {
  const events = [log('LegionCredentialMinted', [1n, HOLDER, 'Participant', 'ipfs://bafybeilegion/metadata.json'], 11, 0, 8)];
  const { indexer, models } = subject(events);
  indexer.readCredential = async (_tokenId, latestEvidence) => ({ ...state(HOLDER), latestEvidence });
  await indexer.syncOnce();
  models.checkpoint = { lastProcessedBlock: '10', lastProcessedBlockHash: HASH(10_010) };
  await indexer.syncOnce();
  assert.equal(models.events.length, 1);
  assert.equal(models.credentials.length, 1);
});

test('fails closed when the canonical manifest address has no deployed bytecode', async () => {
  const { indexer } = subject([]);
  indexer.provider.getCode = async () => '0x';
  await assert.rejects(indexer.assertDeployment(), /No LegionCredentialV2 bytecode exists/);
});

test('keeps BSC Testnet checkpoints distinct from isolated-local checkpoints', () => {
  const local = subject([]).indexer;
  const bscManifest = { ...manifest(), chainId: 97, deploymentVersion: 'legion-v2-bsc-testnet-fixture', contractAddress: ADDRESS(98) };
  const bsc = new LegionCredentialIndexer({ manifest: bscManifest, artifact, provider: new Provider([]), models: new Models(), confirmations: 0, logger: { error() {}, info() {} } });
  assert.notDeepEqual(local.identity(), bsc.identity());
  assert.equal(bsc.identity().chainId, '97');
});
