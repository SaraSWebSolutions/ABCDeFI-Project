const { randomUUID } = require('node:crypto');
const net = require('node:net');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const CROSS_LAYER_REVERT_TEST = 'CROSS_LAYER_REVERT_TEST';
const FIXTURE_CHAIN_ID = 31338;
const PROTECTED_RPC_URL = 'http://127.0.0.1:8546';
const PROTECTED_MONGODB_DATABASE = 'abcdefi';
const PROTECTED_DEPLOYMENT_IDENTITY = '08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b';
const identityPattern = /^0x[0-9a-f]{64}$/i;
const addressPattern = /^0x[0-9a-f]{40}$/i;

function fail(message) { throw new Error(`Cross-layer revert fixture isolation failed: ${message}`); }

function databaseName(uri) {
  let parsed;
  try { parsed = new URL(uri); } catch { fail('MongoDB URI is malformed.'); }
  const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] || '');
  if (!name) fail('MongoDB URI requires an explicit test-only database name.');
  return name;
}

function assertIsolatedMongoUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('mongodb://')) fail('MongoDB URI must be an explicit mongodb:// fixture URI.');
  const name = databaseName(uri);
  if (name === PROTECTED_MONGODB_DATABASE || name === 'admin' || !name.startsWith('cross_layer_revert_')) {
    fail('MongoDB URI is not a generated cross_layer_revert test database.');
  }
  return uri;
}

function assertFixtureDescriptor(descriptor) {
  if (!descriptor || descriptor.runtimeFamily !== CROSS_LAYER_REVERT_TEST) fail('fixture runtime family is required.');
  if (Number(descriptor.chainId) !== FIXTURE_CHAIN_ID) fail(`fixture chain must be ${FIXTURE_CHAIN_ID}.`);
  if (descriptor.rpcUrl === PROTECTED_RPC_URL || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(String(descriptor.rpcUrl))) {
    fail('fixture RPC must be a dedicated loopback endpoint and must not be port 8546.');
  }
  for (const field of ['deploymentIdentity', 'manifestIdentity']) {
    if (!identityPattern.test(String(descriptor[field])) || String(descriptor[field]).toLowerCase() === PROTECTED_DEPLOYMENT_IDENTITY) {
      fail(`${field} must be a non-canonical fixture identity.`);
    }
  }
  if (!descriptor.contracts || !Object.values(descriptor.contracts).every((item) => addressPattern.test(String(item?.address)))) {
    fail('fixture contracts require explicit non-empty deployment addresses.');
  }
  assertIsolatedMongoUri(descriptor.mongoUri);
  return Object.freeze({ ...descriptor, contracts: Object.freeze({ ...descriptor.contracts }) });
}

function createFixtureDescriptor(input) { return assertFixtureDescriptor({ ...input, runtimeFamily: CROSS_LAYER_REVERT_TEST }); }

function assertCanonicalRuntimeRejected(descriptor) {
  if (descriptor?.runtimeFamily === CROSS_LAYER_REVERT_TEST) fail('fixture descriptor is never a canonical 1Q runtime.');
  return descriptor;
}

async function createIsolatedMongo({ database = `cross_layer_revert_${randomUUID().replace(/-/g, '')}` } = {}) {
  if (!database.startsWith('cross_layer_revert_')) fail('fixture database name is not test-only.');
  const server = await MongoMemoryServer.create();
  const directUri = server.getUri(database);
  const direct = new URL(directUri);
  let proxy;
  let proxyPort;
  const startProxy = async () => {
    const listener = net.createServer((client) => {
      const upstream = net.connect(Number(direct.port), direct.hostname);
      const close = () => { client.destroy(); upstream.destroy(); };
      client.on('error', close); upstream.on('error', close);
      client.pipe(upstream); upstream.pipe(client);
    });
    await new Promise((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(proxyPort || 0, '127.0.0.1', () => resolve());
    });
    proxyPort = listener.address().port;
    proxy = listener;
  };
  const stopProxy = async () => {
    if (!proxy) return;
    const current = proxy; proxy = null;
    await new Promise((resolve) => current.close(() => resolve()));
  };
  await startProxy();
  const uri = `mongodb://127.0.0.1:${proxyPort}/${database}`;
  assertIsolatedMongoUri(uri);
  const connection = mongoose.createConnection();
  await connection.openUri(uri);
  if (connection.name !== database || connection.readyState !== 1) fail('isolated MongoDB connection did not become ready.');
  return Object.freeze({
    uri,
    database,
    connection,
    // The private proxy is the only route supplied to test processes. Its
    // removal is a genuine connection outage while mongodb-memory-server
    // retains the disposable data required to prove restart recovery.
    outage: async () => { await connection.close(); await stopProxy(); },
    recover: async () => { await startProxy(); await connection.openUri(uri); },
    close: async () => { await connection.close(); await stopProxy(); await server.stop(); },
  });
}

async function openIsolatedMongoConnection({ uri }) {
  assertIsolatedMongoUri(uri);
  const database = databaseName(uri);
  const connection = mongoose.createConnection();
  await connection.openUri(uri, { serverSelectionTimeoutMS: 1000 });
  if (connection.readyState !== 1 || connection.name !== database) fail('isolated MongoDB worker connection did not become ready.');
  return Object.freeze({ uri, database, connection, close: async () => connection.close() });
}

function createIsolatedModelFactory({ descriptor, mongo }) {
  assertFixtureDescriptor(descriptor);
  if (!mongo?.connection || mongo.connection.readyState !== 1 || mongo.connection.name !== mongo.database) fail('isolated MongoDB connection is unavailable.');
  if (mongo.database === PROTECTED_MONGODB_DATABASE) fail('canonical MongoDB cannot be used by fixture models.');
  return Object.freeze({
    connection: mongo.connection,
    database: mongo.database,
    model(name, schema, collection) {
      if (typeof name !== 'string' || !name.startsWith('CrossLayerRevert')) fail('fixture model names must be cross-layer scoped.');
      if (typeof collection !== 'string' || !collection.startsWith('cross_layer_revert_')) fail('fixture collection is not isolated.');
      return mongo.connection.models[name] || mongo.connection.model(name, schema, collection);
    },
  });
}

const projectionSources = Object.freeze({
  LENDING: () => require('../../modules/lendingV2Projection/models.cjs'),
  ICO_V3: () => require('../../modules/icoV3Projection/models.cjs'),
  MARKETPLACE_10A: () => require('../../modules/abcdMarketplaceProjection/models.cjs'),
  MARKETPLACE_10B: () => require('../../modules/legionMarketplaceProjection/models.cjs'),
});

function createIsolatedProjectionModels({ descriptor, mongo, module }) {
  const factory = createIsolatedModelFactory({ descriptor, mongo });
  const load = projectionSources[module];
  if (!load) fail(`unsupported projection module: ${module}.`);
  const source = load(); const bundle = {};
  for (const [key, productionModel] of Object.entries(source)) {
    // Schema cloning preserves the canonical document shape and indexes but
    // prevents the fixture from sharing a mongoose singleton/collection.
    bundle[key] = factory.model(`CrossLayerRevert${module}${key}`, productionModel.schema.clone(), `cross_layer_revert_${module.toLowerCase()}_${productionModel.collection.name}`);
  }
  return Object.freeze(bundle);
}

function createIsolatedFactory({ descriptor, mongo, models }) {
  const verified = assertFixtureDescriptor(descriptor);
  if (!models || models.connection !== mongo?.connection || models.database !== mongo?.database) fail('fixture factory requires models from the same isolated MongoDB connection.');
  return Object.freeze({
    descriptor: verified,
    instantiateIndexer(createIndexer) {
      if (typeof createIndexer !== 'function') fail('fixture indexer constructor is required.');
      return createIndexer({ descriptor: verified, models });
    },
    instantiateApi(createApi) {
      if (typeof createApi !== 'function') fail('fixture API constructor is required.');
      return createApi({ descriptor: verified, models });
    },
  });
}

// The production projection classes intentionally understand only the explicit
// 1Q_LOCAL runtime context.  This adapter never changes that rule.  Instead it
// validates a disposable descriptor at the test boundary and supplies the
// classes with their historical neutral manifest shape plus isolated models.
// No production runner imports this module.
function createCrossLayerRevertProjectionContext({ descriptor, mongo, models, provider, module, manifest }) {
  const verified = assertFixtureDescriptor(descriptor);
  if (!provider || typeof provider.getNetwork !== 'function') fail('fixture provider is required.');
  if (!module || typeof module !== 'string') fail('fixture module is required.');
  if (!manifest || manifest.runtimeFamily || Number(manifest.chainId) !== FIXTURE_CHAIN_ID) fail('fixture projection manifest must be neutral and use chain 31338.');
  if (manifest.rpcUrl === PROTECTED_RPC_URL || manifest.deploymentIdentity === PROTECTED_DEPLOYMENT_IDENTITY) fail('fixture projection manifest is canonical-shaped.');
  const factory = createIsolatedFactory({ descriptor: verified, mongo, models });
  const provenance = Object.freeze({ runtimeFamily: CROSS_LAYER_REVERT_TEST, chainId: FIXTURE_CHAIN_ID, rpcUrl: verified.rpcUrl, deploymentIdentity: verified.deploymentIdentity, manifestIdentity: verified.manifestIdentity, database: mongo.database, module });
  return Object.freeze({
    ...factory,
    projectionManifest: Object.freeze({ ...manifest }),
    provenance,
    async assertProvider() {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== FIXTURE_CHAIN_ID) fail('fixture provider chain is not 31338.');
      return true;
    },
    assertMongoAvailable() {
      if (mongo.connection.readyState !== 1 || mongo.connection.name !== mongo.database) {
        fail('fixture MongoDB is unavailable; indexer processing is refused before checkpoint mutation.');
      }
      return true;
    },
    instantiateCanonicalIndexer(Indexer, dependencies = {}) {
      if (typeof Indexer !== 'function') fail('canonical indexer constructor is required.');
      return new Indexer({ ...dependencies, manifest: { ...manifest }, provider, models });
    },
    createReadResult({ successCount = 0, checkpoint = null } = {}) {
      return Object.freeze({ available: successCount === 0, success: false, successfulProjectionCount: successCount, checkpoint, provenance });
    },
  });
}

module.exports = Object.freeze({
  CROSS_LAYER_REVERT_TEST,
  FIXTURE_CHAIN_ID,
  PROTECTED_RPC_URL,
  PROTECTED_MONGODB_DATABASE,
  PROTECTED_DEPLOYMENT_IDENTITY,
  assertIsolatedMongoUri,
  assertFixtureDescriptor,
  assertCanonicalRuntimeRejected,
  createFixtureDescriptor,
  createIsolatedMongo,
  openIsolatedMongoConnection,
  createIsolatedModelFactory,
  createIsolatedProjectionModels,
  createIsolatedFactory,
  createCrossLayerRevertProjectionContext,
});
