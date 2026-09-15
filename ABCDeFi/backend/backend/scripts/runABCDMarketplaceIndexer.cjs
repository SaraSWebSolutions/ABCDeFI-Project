const path = require('node:path');
// Match the long-running API process: the indexer and API must project into
// the same explicitly configured MongoDB database rather than each falling
// back to a different process environment.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { JsonRpcProvider } = require('ethers'); const connectDb = require('../config/db'); const { loadABCDMarketplaceManifest } = require('../config/abcdMarketplaceManifest.cjs'); const models = require('../modules/abcdMarketplaceProjection/models.cjs'); const { ABCDMarketplaceIndexer } = require('../modules/abcdMarketplaceProjection/indexer.cjs');
async function main() { const manifest = loadABCDMarketplaceManifest(); const artifact = require(path.resolve(__dirname, '../../../artifacts/contracts/marketplace/ABCDNFTMarketplaceV2.sol/ABCDNFTMarketplaceV2.json')); await connectDb(); const indexer = new ABCDMarketplaceIndexer({ manifest, artifact, provider: new JsonRpcProvider(manifest.rpcUrl), models }); const result = await indexer.syncOnce(); console.log(JSON.stringify({ source: 'canonical-indexed-on-chain', ...result, manifest: manifest.manifestPath })); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
