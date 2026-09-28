import { ONE_Q_CONTRACTS, ONE_Q_RUNTIME_CHAIN_ID, ONE_Q_RUNTIME_FAMILY, ONE_Q_RUNTIME_RPC_URL, oneQRuntime } from './oneQRuntime';

/** The browser's canonical context is the explicit 1Q family only. */
export class CanonicalDeploymentContextError extends Error {}
export const canonicalDeploymentContext = Object.freeze({
  selection: Object.freeze({ kind: 'explicit-1q-local', family: ONE_Q_RUNTIME_FAMILY, chainId: ONE_Q_RUNTIME_CHAIN_ID.toString(), rpcUrl: ONE_Q_RUNTIME_RPC_URL, deploymentIdentity: oneQRuntime.manifest.deploymentIdentity }),
  root: Object.freeze({ deploymentVersion: oneQRuntime.children.root.deploymentVersion, deploymentBlock: oneQRuntime.children.root.deploymentBlock, contracts: Object.freeze({ ABCDTokenV2: ONE_Q_CONTRACTS.ABCDTokenV2, TreasuryV2: ONE_Q_CONTRACTS.TreasuryV2 }), lendingV2: Object.freeze({ deploymentVersion: oneQRuntime.children.lending.deploymentVersion, deploymentBlock: oneQRuntime.children.lending.deploymentBlock, contracts: oneQRuntime.children.lending.contracts }) }),
  ico: oneQRuntime.children.ico, legion: oneQRuntime.children.legion, franchise: oneQRuntime.children.franchise, abcdMarketplace: oneQRuntime.children.marketplace10A, legionMarketplace: oneQRuntime.children.marketplace10B,
});
export const CANONICAL_DEPLOYMENT_IDENTITY = Object.freeze({ family: ONE_Q_RUNTIME_FAMILY, chainId: canonicalDeploymentContext.selection.chainId, unified: oneQRuntime.manifest.deploymentIdentity, root: oneQRuntime.children.root.deploymentVersion, ico: oneQRuntime.children.ico.deploymentVersion, lending: oneQRuntime.children.lending.deploymentVersion, legion: oneQRuntime.children.legion.deploymentVersion, franchise: oneQRuntime.children.franchise.deploymentVersion, abcdMarketplace: oneQRuntime.children.marketplace10A.deploymentVersion, legionMarketplace: oneQRuntime.children.marketplace10B.deploymentVersion });
