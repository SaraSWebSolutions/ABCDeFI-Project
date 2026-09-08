const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { JsonRpcProvider } = require('ethers');
const connectDb = require('../config/db');
const logger = require('../logger');
const { loadLendingManifest } = require('../config/lendingManifest.cjs');
const { loadCanonicalLendingArtifacts } = require('../config/lendingArtifacts.cjs');
const models = require('../modules/lendingProjection');
const { LendingIndexer, createMongoIndexerStore, readOptions } = require('../modules/lendingProjection/indexer');
const { LendingProjectionEngine, createEthersStateReader, createMongoProjectionStore } = require('../modules/lendingProjection/projection');

async function main() {
  const manifest = loadLendingManifest();
  const artifacts = loadCanonicalLendingArtifacts();
  const options = readOptions();
  await connectDb();
  const provider = new JsonRpcProvider(manifest.rpcUrl);
  const projectionEngine = new LendingProjectionEngine({
    manifest,
    stateReader: createEthersStateReader({ manifest, artifacts, provider }),
    store: createMongoProjectionStore(models),
    logger,
  });
  const indexer = new LendingIndexer({
    manifest,
    artifacts,
    provider,
    store: createMongoIndexerStore(models),
    logger,
    options,
    eventProcessor: (event) => projectionEngine.processEvent(event),
    rebuildProjections: (scope) => projectionEngine.rebuildLendingProjection({ ...scope, deploymentVersion: manifest.deploymentVersion }),
  });
  const shutdown = async (signal) => {
    logger.info({ component: 'lending-indexer', message: `Received ${signal}; stopping` });
    await indexer.stop();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  await indexer.start();
}

main().catch((error) => {
  logger.error({ component: 'lending-indexer', message: 'Indexer startup failed', error: error.message });
  process.exit(1);
});
