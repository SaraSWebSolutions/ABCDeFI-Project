const { isAddress } = require('ethers');
const { loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

function loadLegionMarketplaceManifest() {
    const runtime = loadBackendRuntimeFamily();
    const raw = runtime.children.marketplace10B;
    const settlement = raw?.contracts?.LegionMarketplaceSettlementAdapterV2;
    const legion = raw?.contracts?.LegionNFTV2;
    const abcd = raw?.contracts?.ABCDTokenV2;
    if (![settlement, legion, abcd].every((contract) => contract && isAddress(contract.address))) throw new Error(`${runtime.family} Legion marketplace manifest has invalid canonical contract addresses.`);
    if (!Number.isInteger(Number(raw.deploymentBlock)) || Number(raw.deploymentBlock) < 0) throw new Error(`${runtime.family} Legion marketplace deployment block is invalid.`);
    return Object.freeze({ manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: runtime.family === '1Q_BSC_TESTNET' ? 'bsc-testnet' : 'localhost', rpcUrl: runtime.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, runtimeFamily: runtime.family, deploymentBlock: Number(raw.deploymentBlock), settlementAddress: settlement.address.toLowerCase(), legionAddress: legion.address.toLowerCase(), abcdAddress: abcd.address.toLowerCase() });
}

module.exports = { loadLegionMarketplaceManifest };
