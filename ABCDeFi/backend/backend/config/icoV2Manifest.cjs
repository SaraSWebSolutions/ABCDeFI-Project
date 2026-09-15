const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');

/**
 * ICO V2 is deliberately optional until an explicit canonical deployment
 * writes this namespace. There is no fallback to legacy Presale or seeded ICO
 * data, because neither is an approved source for the 1B Community-funded ICO.
 */
function loadIcoV2Manifest() {
  const sourcePath = process.env.ICO_V2_MANIFEST_PATH
    ? path.resolve(process.env.ICO_V2_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.json');
  if (!fs.existsSync(sourcePath)) return null;
  let root;
  try { root = JSON.parse(fs.readFileSync(sourcePath, 'utf8')); } catch (error) { throw new Error(`ICO V2 manifest cannot be parsed: ${error.message}`); }
  const ico = root.icoV2;
  if (!ico) return null;
  if (Number(ico.chainId) !== Number(root.chainId) || !isAddress(ico.contract?.address)) {
    throw new Error('ICO V2 manifest is incomplete or inconsistent with the canonical deployment.');
  }
  return Object.freeze({
    manifestPath: sourcePath,
    chainId: Number(root.chainId),
    rpcUrl: root.rpcUrl,
    deploymentBlock: Number(ico.deploymentBlock),
    deploymentVersion: ico.deploymentVersion,
    address: ico.contract.address,
  });
}

module.exports = { loadIcoV2Manifest };
