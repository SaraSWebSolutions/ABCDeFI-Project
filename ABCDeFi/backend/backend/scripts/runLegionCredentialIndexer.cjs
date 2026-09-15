const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { JsonRpcProvider } = require('ethers');
const connectDb = require('../config/db');
const logger = require('../logger');
const { loadLegionCredentialManifest } = require('../config/legionCredentialManifest.cjs');
const { loadLegionCredentialArtifact } = require('../config/legionCredentialArtifacts.cjs');
const models = require('../modules/legionCredentialProjection/models.cjs');
const { LegionCredentialIndexer } = require('../modules/legionCredentialProjection/indexer.cjs');

(async () => {
  const manifest = loadLegionCredentialManifest();
  await connectDb();
  const indexer = new LegionCredentialIndexer({ manifest, artifact: loadLegionCredentialArtifact(), provider: new JsonRpcProvider(manifest.rpcUrl), models, logger, confirmations: 0 });
  const stop = async () => { await indexer.stop(); await mongoose.disconnect(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  await indexer.start();
})().catch((error) => { logger.error({ component: 'legion-credential-indexer', message: error.message }); process.exit(1); });
