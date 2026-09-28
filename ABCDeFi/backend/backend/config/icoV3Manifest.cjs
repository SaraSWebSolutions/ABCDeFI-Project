const { isAddress } = require('ethers');
const { selectedRuntimeFamily, loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

function loadIcoV3Manifest() {
  selectedRuntimeFamily();
  const runtime = loadBackendRuntimeFamily();
  const raw = runtime.children.ico;
  const ico = raw?.contracts?.ICOManagerV3;
  const token = raw?.contracts?.ABCDTokenV2;
  const deploymentBlock = Number(raw?.custody?.fundingBlock);
  if (!ico || !token || !isAddress(ico.address) || !isAddress(token.address) || !Number.isInteger(deploymentBlock) || deploymentBlock < 0) throw new Error('1Q_LOCAL ICOManagerV3 manifest is incomplete.');
  return Object.freeze({ runtimeFamily: runtime.family, manifestPath: runtime.manifestPath, chainId: runtime.chainId, rpcUrl: runtime.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, deploymentBlock, address: ico.address.toLowerCase(), abcdAddress: token.address.toLowerCase(), contractKind: 'ICOManagerV3' });
}
module.exports = { loadIcoV3Manifest };
