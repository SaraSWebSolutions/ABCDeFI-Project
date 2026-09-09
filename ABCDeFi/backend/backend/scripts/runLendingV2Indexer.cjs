const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose'); const { JsonRpcProvider } = require('ethers'); const connectDb = require('../config/db'); const logger = require('../logger');
const { loadLendingV2Manifest } = require('../config/lendingV2Manifest.cjs'); const { loadLendingV2Artifacts } = require('../config/lendingV2Artifacts.cjs'); const models = require('../modules/lendingV2Projection/models.cjs'); const { LendingV2Indexer } = require('../modules/lendingV2Projection/indexer.cjs');
// This runner is fail-closed by loadLendingV2Manifest(): it accepts only the
// isolated local Hardhat manifest. Hardhat does not mine idle confirmation
// blocks, so a local receipt must be eligible immediately. The reusable
// LendingV2Indexer keeps its two-block default for every other caller.
(async () => { const manifest = loadLendingV2Manifest(); await connectDb(); const indexer = new LendingV2Indexer({ manifest, artifacts: loadLendingV2Artifacts(), provider: new JsonRpcProvider(manifest.rpcUrl), models, logger, confirmations: 0 }); const stop = async () => { await indexer.stop(); await mongoose.disconnect(); process.exit(0); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); await indexer.start(); })().catch((error) => { logger.error({ component: 'lending-v2-indexer', message: error.message }); process.exit(1); });
