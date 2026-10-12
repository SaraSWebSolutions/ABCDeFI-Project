const { isAddress } = require('ethers');
const { loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');
function loadTreasuryManifest() {
    const runtime = loadBackendRuntimeFamily(); const raw = runtime.family === '1Q_BSC_TESTNET' ? runtime.children.treasury : runtime.children.lending;
    const treasury = raw?.contracts?.TreasuryV2; const token = raw?.contracts?.ABCDTokenV2;
    if (!treasury || !token || !isAddress(treasury.address) || !isAddress(token.address) || !Number.isInteger(Number(treasury.deploymentBlock))) throw new Error(`${runtime.family} TreasuryV2 manifest is incomplete.`);
    return Object.freeze({ manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: runtime.family === '1Q_BSC_TESTNET' ? 'bsc-testnet' : 'localhost', rpcUrl: runtime.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, runtimeFamily: runtime.family, deploymentBlock: Number(treasury.deploymentBlock), treasuryAddress: treasury.address.toLowerCase(), abcdAddress: token.address.toLowerCase() });
}
module.exports = { loadTreasuryManifest };
