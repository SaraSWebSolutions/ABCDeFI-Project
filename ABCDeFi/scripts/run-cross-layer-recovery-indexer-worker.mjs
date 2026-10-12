import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { JsonRpcProvider } from 'ethers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { FIXTURE_CHAIN_ID, assertFixtureDescriptor, openIsolatedMongoConnection, createIsolatedProjectionModels, createCrossLayerRevertProjectionContext } = require(path.join(root, 'backend/backend/testing/crossLayerRevert/isolation.cjs'));
const { IcoV3Indexer } = require(path.join(root, 'backend/backend/modules/icoV3Projection/indexer.cjs'));
const input = JSON.parse(process.env.CROSS_LAYER_RECOVERY_WORKER_INPUT || '');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/contracts/ico/ICOManagerV3.sol/ICOManagerV3.json'), 'utf8'));

class FixtureProvider extends JsonRpcProvider {
  async getBlockNumber() { return Number(BigInt(await this.send('eth_blockNumber', []))); }
}

let mongo;
try {
  const descriptor = assertFixtureDescriptor(input.descriptor);
  if (descriptor.chainId !== FIXTURE_CHAIN_ID || descriptor.runtimeFamily !== 'CROSS_LAYER_REVERT_TEST') throw new Error('worker received a non-fixture runtime.');
  mongo = await openIsolatedMongoConnection({ uri: descriptor.mongoUri });
  const provider = new FixtureProvider(descriptor.rpcUrl, FIXTURE_CHAIN_ID, { staticNetwork: true });
  const models = createIsolatedProjectionModels({ descriptor, mongo, module: 'ICO_V3' });
  const context = createCrossLayerRevertProjectionContext({
    descriptor, mongo, models: { connection: mongo.connection, database: mongo.database, ...models },
    provider, module: 'ICO_V3', manifest: input.manifest,
  });
  await context.assertProvider();
  context.assertMongoAvailable();
  const indexer = context.instantiateCanonicalIndexer(IcoV3Indexer, { artifact, confirmations: 0 });
  const result = await indexer.syncOnce();
  const checkpoint = await models.IcoV3Checkpoint.findOne(indexer.identity()).lean();
  const eventCount = await models.IcoV3Event.countDocuments();
  console.log(JSON.stringify({ result, checkpoint, eventCount, database: mongo.database }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await mongo?.close();
}
