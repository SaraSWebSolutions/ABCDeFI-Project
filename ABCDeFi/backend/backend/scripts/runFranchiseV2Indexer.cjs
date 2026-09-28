const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { JsonRpcProvider } = require('ethers');
const connectDb = require('../config/db');
const logger = require('../logger');
const { selectedRuntimeFamily, verifyBackendRuntimeFamilyLive } = require('../config/runtimeFamily.cjs');
const { loadFranchiseV2Manifest } = require('../config/franchiseV2Manifest.cjs');
const { loadFranchiseV2Artifacts } = require('../config/franchiseV2Artifacts.cjs');
const models = require('../modules/franchiseV2Projection/models.cjs');
const { FranchiseV2Indexer } = require('../modules/franchiseV2Projection/indexer.cjs');

(async () => {
  selectedRuntimeFamily(); await verifyBackendRuntimeFamilyLive();
  const manifest = loadFranchiseV2Manifest(); await connectDb();
  const indexer = new FranchiseV2Indexer({ manifest, artifacts: loadFranchiseV2Artifacts(), provider: new JsonRpcProvider(manifest.rpcUrl), models, logger, confirmations: 0 });
  const stop = async () => { await indexer.stop(); await mongoose.disconnect(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop); await indexer.start();
})().catch((error) => { logger.error({ component: 'franchise-v2-indexer', message: error.message }); process.exit(1); });
