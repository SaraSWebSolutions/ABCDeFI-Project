const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { JsonRpcProvider } = require('ethers');
const connectDb = require('../config/db');
const { selectedRuntimeFamily, verifyBackendRuntimeFamilyLive } = require('../config/runtimeFamily.cjs');
const { loadLegionMarketplaceManifest } = require('../config/legionMarketplaceManifest.cjs');
const models = require('../modules/legionMarketplaceProjection/models.cjs');
const { LegionMarketplaceIndexer } = require('../modules/legionMarketplaceProjection/indexer.cjs');
async function main() { selectedRuntimeFamily(); await verifyBackendRuntimeFamilyLive(); const manifest = loadLegionMarketplaceManifest(); const artifact = require(path.resolve(__dirname, '../../../artifacts/contracts/marketplace/LegionMarketplaceSettlementAdapterV2.sol/LegionMarketplaceSettlementAdapterV2.json')); await connectDb(); const indexer = new LegionMarketplaceIndexer({ manifest, artifact, provider: new JsonRpcProvider(manifest.rpcUrl), models }); const result = await indexer.syncOnce(); console.log(JSON.stringify({ source: 'canonical-indexed-on-chain', ...result, manifest: manifest.manifestPath })); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
