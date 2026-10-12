const { isAddress } = require('ethers');
const { loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');
const { ONE_Q_LOCAL_R2_TEST } = require('./oneQLocalR2TestRuntime.cjs');
const { ONE_Q_LOCAL_R3_TEST } = require('./oneQLocalR3TestRuntime.cjs');
const { ONE_Q_LOCAL_B64_LIFECYCLE_TEST } = require('./oneQLocalB64LifecycleTestRuntime.cjs');
const { registerSealedR2TestLendingManifest, registerSealedR3TestLendingManifest, registerSealedB64LifecycleTestLendingManifest } = require('./projectionRuntimeContext.cjs');

const REQUIRED = Object.freeze([
  'OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2',
  'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2',
]);
const OPTIONAL = Object.freeze(['LendingReferralManagerV2', 'LiquidationSaleAdapterV2']);

function loadLendingV2Manifest() {
    const runtime = loadBackendRuntimeFamily();
    const v2 = runtime.children.lending;
    const contracts = {};
    for (const name of REQUIRED) {
      const entry = v2.contracts?.[name];
      if (!entry || !isAddress(entry.address) || !Number.isInteger(Number(entry.deploymentBlock))) {
        throw new Error(`${runtime.family} Lending V2 manifest is missing a valid ${name} deployment.`);
      }
      contracts[name] = Object.freeze({ address: entry.address, deploymentBlock: Number(entry.deploymentBlock), deploymentTransactionHash: entry.deploymentTransactionHash });
    }
    for (const name of OPTIONAL) {
      const entry = v2.contracts?.[name];
      if (entry == null) continue;
      if (!isAddress(entry.address) || !Number.isInteger(Number(entry.deploymentBlock))) throw new Error(`${runtime.family} Lending V2 manifest has an invalid optional ${name} entry.`);
      contracts[name] = Object.freeze({ address: entry.address, deploymentBlock: Number(entry.deploymentBlock), deploymentTransactionHash: entry.deploymentTransactionHash });
    }
    const manifest = {
      manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: runtime.family === '1Q_BSC_TESTNET' ? 'bsc-testnet' : 'localhost', rpcUrl: runtime.rpcUrl,
      deploymentBlock: Number(v2.deploymentBlock), deploymentVersion: v2.deploymentVersion,
      abcdToken: runtime.contracts.ABCDTokenV2.address, contracts: Object.freeze(contracts), raw: v2,
      runtimeFamily: runtime.family, deploymentIdentity: runtime.deploymentIdentity,
    };
    if (runtime.family === ONE_Q_LOCAL_R2_TEST) {
      registerSealedR2TestLendingManifest(manifest, runtime);
    }
    if (runtime.family === ONE_Q_LOCAL_R3_TEST) registerSealedR3TestLendingManifest(manifest, runtime);
    if (runtime.family === ONE_Q_LOCAL_B64_LIFECYCLE_TEST) registerSealedB64LifecycleTestLendingManifest(manifest, runtime);
    return Object.freeze(manifest);
}

module.exports = { REQUIRED, OPTIONAL, loadLendingV2Manifest };
