const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');

function loadABCDMarketplaceManifest() {
  const manifestPath = process.env.ABCD_NFT_MARKETPLACE_MANIFEST_PATH
    ? path.resolve(process.env.ABCD_NFT_MARKETPLACE_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.abcd-nft-marketplace-v2-local.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Canonical ABCD NFT marketplace manifest is missing: ${manifestPath}`);
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const market = raw?.contracts?.ABCDNFTMarketplaceV2;
  const token = raw?.contracts?.ABCDToken;
  if (!market || !token || !isAddress(market.address) || !isAddress(token.address)) throw new Error('Marketplace manifest has invalid canonical ABCD/marketplace addresses.');
  if (Number(raw.chainId) !== 31337 || raw.network !== 'hardhat-local' || !/^http:\/\/127\.0\.0\.1:8545\/?$/.test(raw.rpcUrl || '')) throw new Error('Canonical ABCD marketplace manifest must be isolated Hardhat Local (31337).');
  if (!Number.isInteger(Number(market.deploymentBlock)) || Number(market.deploymentBlock) < 0) throw new Error('Marketplace deployment block is invalid.');
  return Object.freeze({ manifestPath, chainId: 31337, network: raw.network, rpcUrl: raw.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentBlock: Number(market.deploymentBlock), marketplaceAddress: market.address.toLowerCase(), abcdAddress: token.address.toLowerCase() });
}
module.exports = { loadABCDMarketplaceManifest };
