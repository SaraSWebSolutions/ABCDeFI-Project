import deploymentManifest from '../../deployments.json';

type DeploymentContractName = keyof typeof deploymentManifest.contracts;

function address(name: DeploymentContractName): string {
  const value = deploymentManifest.contracts[name]?.address;
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Canonical deployment manifest is missing a valid ${name} address.`);
  }
  return value;
}

/**
 * Active web runtime configuration. deployments.json is the only address/RPC
 * source for the canonical localhost deployment; VITE_* deployment variables
 * are retained only for isolated legacy paths.
 */
export const CONTRACTS = Object.freeze({
  token: address('ABCDToken'),
  presale: address('Presale'), treasury: address('Treasury'),
  staking: address('StakingPool'), lending: address('LendingPool'),
  vesting: address('TokenVesting'), referral: address('ReferralManager'),
  bonusEngine: address('BonusEngine'), marketplace: address('NFTMarketplace'),
  collateralVault: address('CollateralVault'), participantNFT: address('ParticipantNFT'),
  loanManager: address('LoanManager'), loanMarketplace: address('LoanMarketplace'),
  emiManager: address('EMIManager'), liquidation: address('Liquidation'),
  loanNFT: address('LoanNFT'), reputationNFT: address('ReputationNFT'),
  guruNFT: address('GuruNFT'), bonusManager: address('BonusManager'),
  legionNFT: address('LegionNFT'),
  franchiseNFT: address('FranchiseNFT'),
});

export const DEPLOYMENT_CHAIN_ID = BigInt(deploymentManifest.chainId);
export const DEPLOYMENT_RPC_URL = deploymentManifest.rpcUrl;
export const DEPLOYMENT_NETWORK = deploymentManifest.network;

type LendingV2Manifest = {
  version: string;
  chainId: string;
  localOnly: boolean;
  contracts: Record<string, { address: string }>;
  configuration?: {
    maxInitialLtvBps?: number;
    aprBps?: number;
    lateFeeBps?: number;
    liquidationThresholdBps?: number;
    liquidationBonusBps?: number;
    closeFactorBps?: number;
    supportedTermSeconds?: number[];
    gracePeriodSeconds?: number;
  };
};

type LendingV2Contracts = Readonly<{
  oracle: string; vault: string; manager: string; pool: string; liquidation: string;
  reserve: string; marketplace: string; emi: string; loanNFT: string;
}>;

/**
 * V2 is an optional, separately deployed local namespace.  A canonical V1
 * deployment must remain usable when it deliberately has no V2 deployment;
 * callers that need V2 must ask for it explicitly rather than crashing the
 * entire dashboard during module import.
 */
export function getLendingV2Contracts(): LendingV2Contracts | null {
  const v2 = (deploymentManifest as typeof deploymentManifest & { lendingV2?: LendingV2Manifest }).lendingV2;
  const names = ['OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2', 'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2'] as const;
  const addresses = Object.fromEntries(names.map((name) => [name, v2?.contracts?.[name]?.address]));
  if (Object.values(addresses).some((value) => typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value))) return null;
  return Object.freeze({
    oracle: addresses.OracleAdapterV2!, vault: addresses.CollateralVaultV2!, manager: addresses.LoanManagerV2!,
    pool: addresses.LendingPoolV2!, liquidation: addresses.LiquidationV2!, reserve: addresses.InsuranceReserveV2!,
    marketplace: addresses.LoanMarketplaceV2!, emi: addresses.EMIManagerV2!, loanNFT: addresses.LoanNFTV2!,
  });
}

/** Isolated V2 namespace. Null means this canonical deployment is V1-only. */
export const LENDING_V2_CONTRACTS = getLendingV2Contracts();

/** Deployment-time V2 facts that are not exposed as Solidity public getters. */
export function getLendingV2Configuration() {
  const v2 = (deploymentManifest as typeof deploymentManifest & { lendingV2?: LendingV2Manifest }).lendingV2;
  return v2?.configuration ?? null;
}

export function requireContractAddress(name: keyof typeof CONTRACTS): string {
  const value = CONTRACTS[name];
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Missing or invalid deployment address for ${name}. Deploy the canonical ecosystem and provide its manifest.`);
  }
  return value;
}
