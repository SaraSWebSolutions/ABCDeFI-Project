const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');
const { isOneQLocalSelected, loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

function loadLegionMarketplaceManifest() {
  if (isOneQLocalSelected()) {
    const runtime = loadBackendRuntimeFamily();
    const raw = runtime.children.marketplace10B;
    const settlement = raw?.contracts?.LegionMarketplaceSettlementAdapterV2;
    const legion = raw?.contracts?.LegionNFTV2;
    const abcd = raw?.contracts?.ABCDTokenV2;
    if (![settlement, legion, abcd].every((contract) => contract && isAddress(contract.address))) throw new Error('1Q_LOCAL Legion marketplace manifest has invalid canonical contract addresses.');
    if (!Number.isInteger(Number(raw.deploymentBlock)) || Number(raw.deploymentBlock) < 0) throw new Error('1Q_LOCAL Legion marketplace deployment block is invalid.');
    return Object.freeze({ manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: 'localhost', rpcUrl: runtime.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, runtimeFamily: runtime.family, deploymentBlock: Number(raw.deploymentBlock), settlementAddress: settlement.address.toLowerCase(), legionAddress: legion.address.toLowerCase(), abcdAddress: abcd.address.toLowerCase() });
  }
  const manifestPath = process.env.LEGION_MARKETPLACE_MANIFEST_PATH
    ? path.resolve(process.env.LEGION_MARKETPLACE_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.canonical-v2-legion-marketplace-local.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Canonical Legion marketplace manifest is missing: ${manifestPath}`);
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const settlement = raw?.contracts?.LegionMarketplaceSettlementAdapterV2;
  const legion = raw?.contracts?.LegionNFTV2;
  const abcd = raw?.contracts?.ABCDToken;
  if (![settlement, legion, abcd].every((contract) => contract && isAddress(contract.address))) throw new Error('Legion marketplace manifest has invalid canonical contract addresses.');
  if (Number(raw.chainId) !== 31337 || raw.network !== 'hardhat-local' || !/^http:\/\/127\.0\.0\.1:8545\/?$/.test(raw.rpcUrl || '')) throw new Error('Canonical Legion marketplace manifest must be isolated Hardhat Local (31337).');
  if (!Number.isInteger(Number(settlement.deploymentBlock)) || Number(settlement.deploymentBlock) < 0) throw new Error('Legion marketplace deployment block is invalid.');
  return Object.freeze({ manifestPath, chainId: 31337, network: raw.network, rpcUrl: raw.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentBlock: Number(settlement.deploymentBlock), settlementAddress: settlement.address.toLowerCase(), legionAddress: legion.address.toLowerCase(), abcdAddress: abcd.address.toLowerCase() });
}

module.exports = { loadLegionMarketplaceManifest };
