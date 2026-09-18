const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');

function loadLegionMarketplaceManifest() {
  const manifestPath = process.env.LEGION_MARKETPLACE_MANIFEST_PATH
    ? path.resolve(process.env.LEGION_MARKETPLACE_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.legion-marketplace-v2-local.json');
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
