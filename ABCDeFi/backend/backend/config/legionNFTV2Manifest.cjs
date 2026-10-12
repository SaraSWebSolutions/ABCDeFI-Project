const { isAddress } = require('ethers');
const { loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

/** Loads only the isolated canonical LegionNFTV2 deployment manifest. */
function loadLegionNFTV2Manifest() {
    const runtime = loadBackendRuntimeFamily();
    const raw = runtime.children.legion;
    const contract = raw?.contracts?.LegionNFTV2;
    if (!contract || !isAddress(contract.address) || !Number.isInteger(Number(contract.deploymentBlock)) || Number(contract.deploymentBlock) < 0) {
      throw new Error(`${runtime.family} LegionNFTV2 manifest is missing a valid deployed contract entry.`);
    }
    return Object.freeze({ manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: runtime.family === '1Q_BSC_TESTNET' ? 'bsc-testnet' : 'localhost', rpcUrl: runtime.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, runtimeFamily: runtime.family, deploymentBlock: Number(contract.deploymentBlock), contractAddress: contract.address.toLowerCase(), roles: raw.roles || {} });
}

module.exports = { loadLegionNFTV2Manifest };
