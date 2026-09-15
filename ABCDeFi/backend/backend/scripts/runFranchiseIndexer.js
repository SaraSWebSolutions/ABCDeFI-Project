const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { JsonRpcProvider } = require('ethers');
const connectDb = require('../config/db');
const logger = require('../logger');
const { loadFranchiseManifest } = require('../config/franchiseManifest.cjs');
const { loadFranchiseArtifacts } = require('../config/franchiseArtifacts.cjs');
const models = require('../modules/franchiseProjection/models');
const { FranchiseIndexer } = require('../modules/franchiseProjection/indexer');

async function main() {
  const manifest = loadFranchiseManifest();
  await connectDb();
  // This runner is restricted by the manifest loader to Hardhat Local (31337).
  // Match the other canonical local projection runners so the final mined
  // lifecycle event is visible even when no later block is produced.
  const indexer = new FranchiseIndexer({ manifest, artifacts: loadFranchiseArtifacts(), provider: new JsonRpcProvider(manifest.rpcUrl), models, logger, confirmations: 0 });
  const shutdown = async () => { await indexer.stop(); await mongoose.disconnect(); process.exit(0); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  await indexer.start();
}
main().catch((error) => { logger.error({ component: 'franchise-indexer', message: 'Indexer startup failed', error: error.message }); process.exit(1); });
