import deploymentManifest from '../../deployments.json';

type DeploymentContractName = keyof typeof deploymentManifest.contracts | 'FranchiseNFT';
type DeploymentContract = { address?: unknown; deploymentBlock?: unknown };

const rootContracts = deploymentManifest.contracts as Record<string, DeploymentContract>;

function isDeploymentAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function address(name: DeploymentContractName): string {
  const value = rootContracts[name]?.address;
  if (!isDeploymentAddress(value)) {
    throw new Error(`Canonical deployment manifest is missing a valid ${name} address.`);
  }
  return value;
}

/**
 * A phase-specific contract may be deliberately absent from the active
 * canonical manifest. Its feature must fail closed when invoked, without
 * preventing independent deployed modules from loading at application start.
 */
function optionalAddress(name: DeploymentContractName): string | null {
  const value = rootContracts[name]?.address;
  return isDeploymentAddress(value) ? value : null;
}

/**
 * Active web runtime configuration. deployments.json is the only address/RPC
 * source for the canonical localhost deployment; VITE_* deployment variables
 * are retained only for isolated legacy paths.
 */
export const CONTRACTS = Object.freeze({
  token: address('ABCDToken'),
  presale: address('Presale'), treasury: address('Treasury'),
  lending: address('LendingPool'),
  vesting: address('TokenVesting'), referral: address('ReferralManager'),
  bonusEngine: address('BonusEngine'), marketplace: address('NFTMarketplace'),
  collateralVault: address('CollateralVault'), participantNFT: address('ParticipantNFT'),
  loanManager: address('LoanManager'), loanMarketplace: address('LoanMarketplace'),
  emiManager: address('EMIManager'), liquidation: address('Liquidation'),
  loanNFT: address('LoanNFT'), reputationNFT: address('ReputationNFT'),
  guruNFT: address('GuruNFT'), bonusManager: address('BonusManager'),
  legionNFT: address('LegionNFT'),
  franchiseNFT: optionalAddress('FranchiseNFT'),
});

export const DEPLOYMENT_CHAIN_ID = BigInt(deploymentManifest.chainId);
export const DEPLOYMENT_RPC_URL = deploymentManifest.rpcUrl;
export const DEPLOYMENT_NETWORK = deploymentManifest.network;

type LendingV2Manifest = {
  version: string;
  chainId: string;
  localOnly: boolean;
  deploymentBlock?: number;
  contracts: Record<string, { address: string }>;
  configuration?: {
    maxInitialLtvBps?: number;
    p2pInitialLtvBps?: number;
    marginCallThresholdBps?: number;
    marginCallCureSeconds?: number;
    aprBps?: number;
    liquidationThresholdBps?: number;
    liquidationBonusBps?: number;
    closeFactorBps?: number;
    supportedTermSeconds?: number[];
    maturityGracePeriodSeconds?: number;
    lendingReferralMonthlyRewardBps?: number;
    referralNftValueBps?: number;
    referralRewardVault?: string;
  };
};

type LendingV2Contracts = Readonly<{
  oracle: string; vault: string; manager: string; pool: string; liquidation: string;
  reserve: string; marketplace: string; emi: string; loanNFT: string; referral?: string;
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
    referral: typeof v2?.contracts?.LendingReferralManagerV2?.address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v2.contracts.LendingReferralManagerV2.address)
      ? v2.contracts.LendingReferralManagerV2.address : undefined,
  });
}

/** Isolated V2 namespace. Null means this canonical deployment is V1-only. */
export const LENDING_V2_CONTRACTS = getLendingV2Contracts();

/**
 * Phase 6 has its own optional, canonical namespace. A legacy Presale entry
 * is never a fallback: until a manifest records ICOManagerV2, the product is
 * unavailable rather than displaying seeded or historical sale data.
 */
export function getIcoV2Contract(): string | null {
  const root = deploymentManifest as typeof deploymentManifest & {
    icoV2?: { contract?: { address?: string }; deploymentBlock?: number; deploymentVersion?: string };
  };
  const address = root.icoV2?.contract?.address;
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address) ? address : null;
}

export const ICO_V2_CONTRACT = getIcoV2Contract();

/** Returns a manifest deployment block only when it is explicitly recorded. */
export function getContractDeploymentBlock(name: DeploymentContractName): number | null {
  const value = rootContracts[name]?.deploymentBlock;
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

/** Deployment-time V2 facts that are not exposed as Solidity public getters. */
export function getLendingV2Configuration() {
  const v2 = (deploymentManifest as typeof deploymentManifest & { lendingV2?: LendingV2Manifest }).lendingV2;
  return v2?.configuration ?? null;
}

/** Canonical local block from which isolated V2 event discovery may begin. */
export function getLendingV2DeploymentBlock(): number | null {
  const v2 = (deploymentManifest as typeof deploymentManifest & { lendingV2?: LendingV2Manifest }).lendingV2;
  return Number.isSafeInteger(v2?.deploymentBlock) && (v2?.deploymentBlock ?? 0) >= 0 ? v2!.deploymentBlock! : null;
}

export function requireContractAddress(name: keyof typeof CONTRACTS): string {
  const value = CONTRACTS[name];
  if (!isDeploymentAddress(value)) {
    throw new Error(`Missing or invalid deployment address for ${name}. Deploy the canonical ecosystem and provide its manifest.`);
  }
  return value;
}
