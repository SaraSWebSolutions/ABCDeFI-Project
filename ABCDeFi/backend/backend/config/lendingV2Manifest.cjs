const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');

const REQUIRED = Object.freeze([
  'OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2',
  'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2',
]);

function manifestPath() {
  return process.env.LENDING_V2_MANIFEST_PATH
    ? path.resolve(process.env.LENDING_V2_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.json');
}

function loadLendingV2Manifest() {
  const sourcePath = manifestPath();
  if (!fs.existsSync(sourcePath)) throw new Error(`Canonical V2 deployment manifest is missing: ${sourcePath}`);
  let root;
  try { root = JSON.parse(fs.readFileSync(sourcePath, 'utf8')); } catch (error) { throw new Error(`Canonical V2 deployment manifest cannot be parsed: ${error.message}`); }
  const v2 = root.lendingV2;
  if (!v2 || typeof v2 !== 'object') throw new Error('Canonical deployment manifest has no lendingV2 namespace.');
  if (Number(v2.chainId) !== 31337 || v2.network !== 'localhost' || v2.localOnly !== true) {
    throw new Error('Lending V2 backend accepts only the isolated localhost chain 31337 deployment.');
  }
  if (!Number.isInteger(Number(v2.deploymentBlock)) || Number(v2.deploymentBlock) < 0) throw new Error('Lending V2 deployment block is invalid.');
  if (typeof v2.deploymentVersion !== 'string' || !v2.deploymentVersion) throw new Error('Lending V2 deployment version is missing.');
  if (!v2.contracts || typeof v2.contracts !== 'object') throw new Error('Lending V2 contract map is missing.');
  const contracts = {};
  for (const name of REQUIRED) {
    const entry = v2.contracts[name];
    if (!entry || !isAddress(entry.address)) throw new Error(`Lending V2 manifest is missing a valid ${name} address.`);
    if (!Number.isInteger(Number(entry.deploymentBlock))) throw new Error(`Lending V2 manifest has an invalid ${name} deployment block.`);
    contracts[name] = Object.freeze({ address: entry.address, deploymentBlock: Number(entry.deploymentBlock), deploymentTransactionHash: entry.deploymentTransactionHash });
  }
  if (!root.contracts?.ABCDToken || !isAddress(root.contracts.ABCDToken.address)) throw new Error('Root manifest ABCDToken address is invalid.');
  return Object.freeze({
    manifestPath: sourcePath, chainId: 31337, network: 'localhost', rpcUrl: root.rpcUrl,
    deploymentBlock: Number(v2.deploymentBlock), deploymentVersion: v2.deploymentVersion,
    abcdToken: root.contracts.ABCDToken.address, contracts: Object.freeze(contracts), raw: v2,
  });
}

module.exports = { REQUIRED, loadLendingV2Manifest };
