const { isAddress } = require('ethers');
const { loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

function loadABCDMarketplaceManifest() {
    const runtime = loadBackendRuntimeFamily();
    const raw = runtime.children.marketplace10A;
    const market = raw?.contracts?.ABCDNFTMarketplaceV2;
    const token = raw?.contracts?.ABCDTokenV2;
    if (!market || !token || !isAddress(market.address) || !isAddress(token.address)) throw new Error(`${runtime.family} marketplace manifest has invalid canonical ABCD/marketplace addresses.`);
    if (!Number.isInteger(Number(raw.deploymentBlock)) || Number(raw.deploymentBlock) < 0) throw new Error(`${runtime.family} marketplace deployment block is invalid.`);
    return Object.freeze({ manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: runtime.family === '1Q_BSC_TESTNET' ? 'bsc-testnet' : 'localhost', rpcUrl: runtime.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, runtimeFamily: runtime.family, deploymentBlock: Number(raw.deploymentBlock), marketplaceAddress: market.address.toLowerCase(), abcdAddress: token.address.toLowerCase() });
}
module.exports = { loadABCDMarketplaceManifest };
