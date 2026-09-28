import { ONE_Q_CONTRACTS, ONE_Q_RUNTIME_CHAIN_ID, ONE_Q_RUNTIME_RPC_URL, oneQRuntime } from './oneQRuntime';

/** 1Q exposes only validated addresses. Legacy products have no fallback address. */
type LegacySurface = 'presale' | 'lending' | 'vesting' | 'bonusEngine' | 'collateralVault' | 'participantNFT' | 'loanManager' | 'loanMarketplace' | 'emiManager' | 'liquidation' | 'loanNFT' | 'reputationNFT' | 'guruNFT' | 'bonusManager' | 'legionNFT' | 'franchiseNFT' | 'marketplace';
// This preserves existing TypeScript call signatures while ensuring any legacy
// call receives no address at runtime and therefore fails before a contract
// call can be constructed. It is not a sentinel or fallback address.
const unavailable = (_name: LegacySurface): string => null as unknown as string;
export const CONTRACTS = Object.freeze({
  token: ONE_Q_CONTRACTS.ABCDTokenV2, treasury: ONE_Q_CONTRACTS.TreasuryV2, referral: ONE_Q_CONTRACTS.LendingReferralManagerV2,
  presale: unavailable('presale'), lending: unavailable('lending'), vesting: unavailable('vesting'), bonusEngine: unavailable('bonusEngine'), marketplace: unavailable('marketplace'), collateralVault: unavailable('collateralVault'), participantNFT: unavailable('participantNFT'), loanManager: unavailable('loanManager'), loanMarketplace: unavailable('loanMarketplace'), emiManager: unavailable('emiManager'), liquidation: unavailable('liquidation'), loanNFT: unavailable('loanNFT'), reputationNFT: unavailable('reputationNFT'), guruNFT: unavailable('guruNFT'), bonusManager: unavailable('bonusManager'), legionNFT: unavailable('legionNFT'), franchiseNFT: unavailable('franchiseNFT'),
});
export const DEPLOYMENT_CHAIN_ID = ONE_Q_RUNTIME_CHAIN_ID;
export const DEPLOYMENT_RPC_URL = ONE_Q_RUNTIME_RPC_URL;
export const DEPLOYMENT_NETWORK = '1Q_LOCAL';
export const ICO_V3_CONTRACT = ONE_Q_CONTRACTS.ICOManagerV3;
/** ICO V2 is deliberately unavailable: V3 never reuses its ABI. */
export const ICO_V2_CONTRACT: string | null = null;
type LendingV2Contracts = Readonly<{ oracle: string; vault: string; manager: string; pool: string; liquidation: string; reserve: string; marketplace: string; emi: string; loanNFT: string; referral: string; token: string }>;
export function getLendingV2Contracts(): LendingV2Contracts {
  const contracts = oneQRuntime.children.lending.contracts as Record<string, { address: string }>;
  return Object.freeze({ oracle: contracts.OracleAdapterV2.address, vault: contracts.CollateralVaultV2.address, manager: contracts.LoanManagerV2.address, pool: ONE_Q_CONTRACTS.LendingPoolV2, liquidation: contracts.LiquidationV2.address, reserve: ONE_Q_CONTRACTS.InsuranceReserveV2, marketplace: contracts.LoanMarketplaceV2.address, emi: contracts.EMIManagerV2.address, loanNFT: contracts.LoanNFTV2.address, referral: ONE_Q_CONTRACTS.LendingReferralManagerV2, token: ONE_Q_CONTRACTS.ABCDTokenV2 });
}
export const LENDING_V2_CONTRACTS = getLendingV2Contracts();
export function getIcoV2Contract(): string | null { return null; }
export function getContractDeploymentBlock(name: string): number | null { const entry = oneQRuntime.manifest.contracts[name as keyof typeof oneQRuntime.manifest.contracts]; return typeof entry?.deploymentBlock === 'number' ? entry.deploymentBlock : null; }
export function getLendingV2Configuration(): { supportedTermSeconds?: number[]; maturityGracePeriodSeconds?: number } | null { return null; }
export function getLendingV2DeploymentBlock(): number | null { return oneQRuntime.children.lending.deploymentBlock; }
export function getLendingV2DeploymentVersion(): string { return oneQRuntime.children.lending.deploymentVersion; }
export function requireContractAddress(name: keyof typeof CONTRACTS): string { const value = CONTRACTS[name]; if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value) || /^0x0{40}$/i.test(value)) throw new Error(`The ${String(name)} legacy surface is unavailable in 1Q_LOCAL.`); return value; }
