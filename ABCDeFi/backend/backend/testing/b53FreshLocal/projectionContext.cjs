const { isAddress, keccak256 } = require('ethers');
const { registerTestOnlyProjectionContext } = require('../../config/projectionRuntimeContext.cjs');
const ENVIRONMENT = 'B5.3-FRESH-LOCAL-R2';
const PROTECTED_RPC = 'http://127.0.0.1:8546';
const PROTECTED_IDENTITY = '497cef1c3e331e854f75e4e1853a627cc6e8a35308b0dc505513a5469c7a69d3';
const REQUIRED = Object.freeze(['OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2', 'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2', 'LiquidationSaleAdapterV2']);
const fail = (message) => { throw new Error(`B5.3 isolated projection context rejected: ${message}`); };
function validateDescriptor(d) {
  if (!d || d.environment !== ENVIRONMENT || d.runtimeFamily !== '1Q_LOCAL') fail('explicit B5.3 environment and 1Q_LOCAL family are required.');
  if (!/^http:\/\/(127\.0\.0\.1|localhost):(?!8546$)\d+$/.test(String(d.rpcUrl)) || d.rpcUrl === PROTECTED_RPC) fail('RPC must be a non-protected loopback endpoint.');
  if (Number(d.chainId) !== 31337) fail('chain ID must be 31337.');
  if (!/^0x[0-9a-f]{64}$/i.test(String(d.deploymentIdentity)) || String(d.deploymentIdentity).toLowerCase() === PROTECTED_IDENTITY) fail('deployment identity is invalid or protected.');
  if (!String(d.mongoNamespace || '').startsWith('b53_fresh_local_') || d.mongoNamespace === 'abcdefi_oneq_baseline_v2') fail('MongoDB namespace is not isolated.');
  if (!String(d.checkpointNamespace || '').startsWith('b53_fresh_local_') || d.checkpointNamespace === 'lending_v2_block_checkpoints') fail('checkpoint namespace is not isolated.');
  if (!d.manifestPath || !d.manifestIdentity || !d.contracts) fail('manifest provenance and contracts are required.');
  for (const name of REQUIRED) if (!isAddress(d.contracts[name]?.address)) fail(`missing required contract address: ${name}`);
  return Object.freeze({ ...d, contracts: Object.freeze({ ...d.contracts }) });
}
async function validateLive(d, provider) {
  const valid = validateDescriptor(d); const net = await provider.getNetwork(); if (Number(net.chainId) !== 31337) fail('live chain ID does not match descriptor.');
  for (const name of REQUIRED) { const code = await provider.getCode(valid.contracts[name].address); if (code === '0x') fail(`missing live bytecode: ${name}`); if (valid.bytecodeHashes?.[name] && keccak256(code).toLowerCase() !== String(valid.bytecodeHashes[name]).toLowerCase()) fail(`bytecode identity mismatch: ${name}`); }
  return valid;
}
function createCanonicalManifest(d) { const v = validateDescriptor(d); const manifest = { runtimeFamily: '1Q_LOCAL', rpcUrl: v.rpcUrl, chainId: v.chainId, deploymentIdentity: v.deploymentIdentity, deploymentVersion: v.deploymentVersion, deploymentBlock: v.deploymentBlock, abcdToken: v.abcdToken, contracts: v.contracts }; registerTestOnlyProjectionContext(manifest, v); return Object.freeze(manifest); }
module.exports = Object.freeze({ ENVIRONMENT, REQUIRED, validateDescriptor, validateLive, createCanonicalManifest });
