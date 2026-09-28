const fs = require('node:fs'); const path = require('node:path'); const { isAddress } = require('ethers');
const { isOneQLocalSelected, loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');
function loadTreasuryManifest() {
  if (isOneQLocalSelected()) {
    const runtime = loadBackendRuntimeFamily(); const raw = runtime.children.lending;
    const treasury = raw?.contracts?.TreasuryV2; const token = raw?.contracts?.ABCDTokenV2;
    if (!treasury || !token || !isAddress(treasury.address) || !isAddress(token.address) || !Number.isInteger(Number(treasury.deploymentBlock))) throw new Error('1Q_LOCAL TreasuryV2 manifest is incomplete.');
    return Object.freeze({ manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: 'localhost', rpcUrl: runtime.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, runtimeFamily: runtime.family, deploymentBlock: Number(treasury.deploymentBlock), treasuryAddress: treasury.address.toLowerCase(), abcdAddress: token.address.toLowerCase() });
  }
  const manifestPath = process.env.TREASURY_V2_MANIFEST_PATH ? path.resolve(process.env.TREASURY_V2_MANIFEST_PATH) : path.resolve(__dirname, '../../..', 'deployments.treasury-v2-local.json'); if (!fs.existsSync(manifestPath)) throw new Error(`Canonical TreasuryV2 manifest is missing: ${manifestPath}`); const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); const treasury = raw?.contracts?.TreasuryV2; const token = raw?.contracts?.ABCDToken; if (Number(raw.chainId) !== 31337 || raw.network !== 'hardhat-local' || !treasury || !token || !isAddress(treasury.address) || !isAddress(token.address)) throw new Error('TreasuryV2 manifest is invalid or not isolated Hardhat Local (31337).'); return Object.freeze({ manifestPath, chainId: 31337, network: raw.network, rpcUrl: raw.rpcUrl, deploymentVersion: raw.deploymentVersion, deploymentBlock: Number(treasury.deploymentBlock), treasuryAddress: treasury.address.toLowerCase(), abcdAddress: token.address.toLowerCase() }); }
module.exports = { loadTreasuryManifest };
