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
});

export const DEPLOYMENT_CHAIN_ID = BigInt(deploymentManifest.chainId);
export const DEPLOYMENT_RPC_URL = deploymentManifest.rpcUrl;
export const DEPLOYMENT_NETWORK = deploymentManifest.network;

export function requireContractAddress(name: keyof typeof CONTRACTS): string {
  const value = CONTRACTS[name];
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Missing or invalid deployment address for ${name}. Deploy the canonical ecosystem and provide its manifest.`);
  }
  return value;
}
