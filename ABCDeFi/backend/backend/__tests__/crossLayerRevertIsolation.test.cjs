const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const { Schema } = require('mongoose');
const { IcoV3Indexer } = require('../modules/icoV3Projection/indexer.cjs');
const { canonicalIcoV3Availability } = require('../modules/icoV3/icoV3.controller.cjs');
const { selectedRuntimeFamily } = require('../config/runtimeFamily.cjs');
const {
  CROSS_LAYER_REVERT_TEST, FIXTURE_CHAIN_ID, PROTECTED_RPC_URL,
  PROTECTED_DEPLOYMENT_IDENTITY, assertIsolatedMongoUri, assertCanonicalRuntimeRejected,
  createFixtureDescriptor, createIsolatedMongo, createIsolatedModelFactory, createIsolatedProjectionModels, createIsolatedFactory,
  createCrossLayerRevertProjectionContext,
} = require('../testing/crossLayerRevert/isolation.cjs');

const HASH = (value) => `0x${value.toString(16).padStart(64, '0')}`;
const ADDRESS = (value) => `0x${value.toString(16).padStart(40, '0')}`;
function descriptor(mongoUri = 'mongodb://127.0.0.1:18555/cross_layer_revert_fixture') {
  return createFixtureDescriptor({
    rpcUrl: 'http://127.0.0.1:18545', chainId: FIXTURE_CHAIN_ID,
    deploymentIdentity: HASH(601), manifestIdentity: HASH(602), mongoUri,
    deploymentVersion: 'cross-layer-revert-fixture', deploymentBlock: 1,
    contracts: { ICOManagerV3: { address: ADDRESS(1) }, ABCDTokenV2: { address: ADDRESS(2) } },
  });
}

test('fixture runtime has a dedicated family and cannot be accepted as 1Q_LOCAL or canonical backend selection', async () => {
  const fixture = descriptor();
  assert.equal(fixture.runtimeFamily, CROSS_LAYER_REVERT_TEST);
  assert.notEqual(fixture.chainId, 31337);
  assert.notEqual(fixture.rpcUrl, PROTECTED_RPC_URL);
  assert.notEqual(fixture.deploymentIdentity, PROTECTED_DEPLOYMENT_IDENTITY);
  assert.throws(() => assertCanonicalRuntimeRejected(fixture), /never a canonical 1Q runtime/);
  assert.throws(() => selectedRuntimeFamily({ ABCDEFI_RUNTIME_FAMILY: CROSS_LAYER_REVERT_TEST }), /must be selected explicitly|unsupported/i);
});

test('fixture descriptor rejects canonical chain, RPC, identity, and persistent MongoDB targets', () => {
  assert.throws(() => createFixtureDescriptor({ ...descriptor(), chainId: 31337 }), /fixture chain/);
  assert.throws(() => createFixtureDescriptor({ ...descriptor(), rpcUrl: PROTECTED_RPC_URL }), /must not be port 8546/);
  assert.throws(() => createFixtureDescriptor({ ...descriptor(), deploymentIdentity: PROTECTED_DEPLOYMENT_IDENTITY }), /non-canonical fixture identity/);
  assert.throws(() => assertIsolatedMongoUri('mongodb://127.0.0.1:27017/abcdefi'), /not a generated cross_layer_revert test database/);
});

test('fixture MongoDB and models use a generated isolated connection and cannot use canonical collections', async () => {
  const mongo = await createIsolatedMongo();
  try {
    const models = createIsolatedModelFactory({ descriptor: descriptor(mongo.uri), mongo });
    const Event = models.model('CrossLayerRevertEvent', new Schema({ outcome: String }), 'cross_layer_revert_events');
    assert.equal(mongo.connection.name, mongo.database);
    assert.match(mongo.database, /^cross_layer_revert_/);
    assert.equal(await Event.countDocuments(), 0);
    assert.throws(() => models.model('CanonicalEvent', new Schema({}), 'canonical_events'), /cross-layer scoped/);
  } finally { await mongo.close(); }
});

test('fixture-only factory rejects canonical inputs and canonical indexer/API logic fail closed for a fixture descriptor', async () => {
  const mongo = await createIsolatedMongo();
  try {
    const fixture = descriptor(mongo.uri);
    const models = createIsolatedModelFactory({ descriptor: fixture, mongo });
    const factory = createIsolatedFactory({ descriptor: fixture, mongo, models });
    assert.equal(factory.instantiateIndexer(({ descriptor: current }) => current.runtimeFamily), CROSS_LAYER_REVERT_TEST);
    assert.equal(factory.instantiateApi(({ descriptor: current }) => current.chainId), FIXTURE_CHAIN_ID);
    assert.throws(() => createIsolatedModelFactory({ descriptor: { ...fixture, runtimeFamily: '1Q_LOCAL' }, mongo }), /fixture runtime family/);

    const manifest = { runtimeFamily: CROSS_LAYER_REVERT_TEST, rpcUrl: fixture.rpcUrl, chainId: fixture.chainId, deploymentIdentity: fixture.deploymentIdentity, deploymentVersion: fixture.deploymentVersion, deploymentBlock: 1, address: ADDRESS(1), abcdAddress: ADDRESS(2) };
    const indexer = new IcoV3Indexer({ manifest, artifact: { abi: [] }, provider: {}, models: {} });
    assert.throws(() => indexer.identity(), /invalid runtime identity/);
    const availability = await canonicalIcoV3Availability({ manifest, projectionModels: {}, providerFactory: () => ({}) });
    assert.equal(availability.available, false);
    assert.match(availability.reason, /requires an explicit 1Q_LOCAL deployment identity/);
  } finally { await mongo.close(); }
});

test('canonical runners and frontend selector have no fixture-profile entry point', async () => {
  for (const file of ['runIcoV3Indexer.cjs', 'runABCDMarketplaceIndexer.cjs', 'runLegionMarketplaceIndexer.cjs']) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', file), 'utf8');
    assert.doesNotMatch(source, /CROSS_LAYER_REVERT_TEST/);
  }
  const selector = await import(pathToFileURL(path.resolve(__dirname, '../../../scripts/oneq-frontend-runtime-selector.mjs')).href);
  assert.throws(() => selector.selectOneQFrontendRuntime({ environment: { VITE_ABCDEFI_RUNTIME_FAMILY: CROSS_LAYER_REVERT_TEST }, repositoryRoot: path.resolve(__dirname, '../../..') }), /unsupported runtime family/);
});

test('test-only projection context injects isolated dependencies while production 1Q validation remains fail closed', async () => {
  const mongo = await createIsolatedMongo();
  try {
    const fixture = descriptor(mongo.uri);
    const models = createIsolatedModelFactory({ descriptor: fixture, mongo });
    const neutralManifest = { chainId: FIXTURE_CHAIN_ID, rpcUrl: fixture.rpcUrl, deploymentVersion: fixture.deploymentVersion, deploymentBlock: 1, address: ADDRESS(1), abcdAddress: ADDRESS(2), deploymentIdentity: fixture.deploymentIdentity };
    const context = createCrossLayerRevertProjectionContext({ descriptor: fixture, mongo, models, provider: { getNetwork: async () => ({ chainId: BigInt(FIXTURE_CHAIN_ID) }) }, module: 'ICO_V3', manifest: neutralManifest });
    assert.equal(await context.assertProvider(), true);
    assert.equal(context.provenance.runtimeFamily, CROSS_LAYER_REVERT_TEST);
    assert.equal(context.provenance.database, mongo.database);
    assert.equal(context.createReadResult().success, false);
    assert.equal(context.createReadResult().successfulProjectionCount, 0);
    assert.throws(() => createCrossLayerRevertProjectionContext({ descriptor: { ...fixture, runtimeFamily: '1Q_LOCAL' }, mongo, models, provider: { getNetwork() {} }, module: 'ICO_V3', manifest: neutralManifest }), /fixture runtime family/);
    assert.throws(() => createCrossLayerRevertProjectionContext({ descriptor: fixture, mongo, models, provider: { getNetwork() {} }, module: 'ICO_V3', manifest: { ...neutralManifest, runtimeFamily: '1Q_LOCAL' } }), /neutral/);
  } finally { await mongo.close(); }
});

test('every required projection bundle clones production schemas only onto the fixture connection', async () => {
  const mongo = await createIsolatedMongo();
  try {
    const fixture = descriptor(mongo.uri);
    for (const module of ['LENDING', 'ICO_V3', 'MARKETPLACE_10A', 'MARKETPLACE_10B']) {
      const bundle = createIsolatedProjectionModels({ descriptor: fixture, mongo, module });
      for (const model of Object.values(bundle)) {
        assert.equal(model.db, mongo.connection);
        assert.match(model.collection.name, /^cross_layer_revert_/);
        assert.notEqual(model.collection.name, 'abcdefi');
      }
    }
    assert.throws(() => createIsolatedProjectionModels({ descriptor: fixture, mongo, module: 'TREASURY' }), /unsupported projection module/);
  } finally { await mongo.close(); }
});

test('fixture MongoDB outage fails closed and recovery reopens only the isolated connection', async () => {
  const mongo = await createIsolatedMongo();
  try {
    const fixture = descriptor(mongo.uri);
    const models = createIsolatedProjectionModels({ descriptor: fixture, mongo, module: 'ICO_V3' });
    const context = createCrossLayerRevertProjectionContext({
      descriptor: fixture, mongo, models: { connection: mongo.connection, database: mongo.database, ...models }, module: 'ICO_V3',
      provider: { getNetwork: async () => ({ chainId: BigInt(FIXTURE_CHAIN_ID) }) },
      manifest: { chainId: FIXTURE_CHAIN_ID, rpcUrl: fixture.rpcUrl, deploymentVersion: fixture.deploymentVersion, deploymentBlock: 1, address: ADDRESS(1), abcdAddress: ADDRESS(2), deploymentIdentity: fixture.deploymentIdentity },
    });
    await models.IcoV3Checkpoint.create({ chainId: '31338', deploymentVersion: 'fixture', runtimeFamily: CROSS_LAYER_REVERT_TEST, rpcUrl: fixture.rpcUrl, deploymentIdentity: fixture.deploymentIdentity, contractRuntimeIdentity: HASH(3), icoAddress: ADDRESS(1), lastProcessedBlock: '1', lastProcessedBlockHash: HASH(1) });
    await mongo.outage();
    assert.equal(mongo.connection.readyState, 0, 'outage closes the only isolated model connection before an indexer can advance a checkpoint');
    assert.throws(() => context.assertMongoAvailable(), /MongoDB is unavailable/);
    await mongo.recover();
    assert.equal(context.assertMongoAvailable(), true);
    assert.equal(await models.IcoV3Checkpoint.countDocuments(), 1);
    assert.match(mongo.connection.name, /^cross_layer_revert_/);
  } finally { await mongo.close(); }
});
