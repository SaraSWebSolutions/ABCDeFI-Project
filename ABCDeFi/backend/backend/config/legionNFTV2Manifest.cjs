const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');

/** Loads only the isolated canonical LegionNFTV2 deployment manifest. */
function loadLegionNFTV2Manifest() {
  const manifestPath = process.env.LEGION_NFT_V2_MANIFEST_PATH
    ? path.resolve(process.env.LEGION_NFT_V2_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.legion-nft-v2-local.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Canonical LegionNFTV2 manifest is missing: ${manifestPath}`);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (error) { throw new Error(`Canonical LegionNFTV2 manifest cannot be parsed: ${error.message}`); }
  const contract = raw?.contracts?.LegionNFTV2;
  const local = Number(raw?.chainId) === 31337 && raw?.network === 'localhost' && raw?.localOnly === true && /^http:\/\/127\.0\.0\.1:8545\/?$/.test(raw?.rpcUrl || '');
  if (!local) throw new Error('Canonical LegionNFTV2 backend accepts only an isolated localhost 31337 manifest.');
  if (!contract || !isAddress(contract.address) || !Number.isInteger(Number(contract.deploymentBlock)) || Number(contract.deploymentBlock) < 0) {
    throw new Error('Canonical LegionNFTV2 manifest is missing a valid deployed contract entry.');
  }
  if (typeof raw.deploymentVersion !== 'string' || !raw.deploymentVersion) throw new Error('Canonical LegionNFTV2 deployment version is missing.');
  return Object.freeze({ manifestPath, chainId: 31337, network: 'localhost', rpcUrl: raw.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentBlock: Number(contract.deploymentBlock), contractAddress: contract.address.toLowerCase(), roles: raw.roles || {} });
}

module.exports = { loadLegionNFTV2Manifest };
