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
};

function lendingV2Address(name: string): string {
  const v2 = (deploymentManifest as typeof deploymentManifest & { lendingV2?: LendingV2Manifest }).lendingV2;
  const value = v2?.contracts?.[name]?.address;
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`Canonical lendingV2 manifest is missing ${name}.`);
  return value;
}

/** Isolated V2 namespace. Existing CONTRACTS remains the V1 runtime source. */
export const LENDING_V2_CONTRACTS = Object.freeze({
  oracle: lendingV2Address('OracleAdapterV2'), vault: lendingV2Address('CollateralVaultV2'), manager: lendingV2Address('LoanManagerV2'),
  pool: lendingV2Address('LendingPoolV2'), liquidation: lendingV2Address('LiquidationV2'), reserve: lendingV2Address('InsuranceReserveV2'),
  marketplace: lendingV2Address('LoanMarketplaceV2'), emi: lendingV2Address('EMIManagerV2'), loanNFT: lendingV2Address('LoanNFTV2'),
});

export function requireContractAddress(name: keyof typeof CONTRACTS): string {
  const value = CONTRACTS[name];
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Missing or invalid deployment address for ${name}. Deploy the canonical ecosystem and provide its manifest.`);
  }
  return value;
}
