import unifiedManifest from '@abcdefi/oneq-unified-manifest';
import rootManifest from '@abcdefi/oneq-root-manifest';
import treasuryManifest from '@abcdefi/oneq-treasury-manifest';
import icoManifest from '@abcdefi/oneq-ico-manifest';
import lendingManifest from '@abcdefi/oneq-lending-manifest';
import legionManifest from '@abcdefi/oneq-legion-manifest';
import franchiseManifest from '@abcdefi/oneq-franchise-manifest';
import marketplace10AManifest from '@abcdefi/oneq-marketplace10A-manifest';
import marketplace10BManifest from '@abcdefi/oneq-marketplace10B-manifest';
import r3Descriptor from '@abcdefi/oneq-r3-descriptor';
import r3Provenance from '@abcdefi/oneq-r3-provenance';
// The resolver is deliberately plain ESM so the backend and browser share its
// exact validation semantics. It is typed here by its exported adapter shape.
// @ts-expect-error -- sibling .mjs runtime module has no emitted declaration.
import { ONE_Q_LOCAL, configuredRuntimeFamily, isOneQLocalChildExcluded, resolveRuntimeFamily } from './oneQRuntimeFamilyResolver.mjs';
// @ts-expect-error -- sibling .mjs runtime module has no emitted declaration.
import { ONE_Q_BSC_TESTNET, configuredBscRuntimeFamily, resolveOneQBscTestnetRuntime } from './oneQBscTestnetRuntimeFamilyResolver.mjs';
// @ts-expect-error -- sibling .mjs runtime module has no emitted declaration.
import { ONE_Q_LOCAL_R3_TEST, configuredOneQLocalR3TestRuntimeFamily, isOneQLocalR3TestFranchiseExcluded, resolveOneQLocalR3TestRuntime } from './oneQLocalR3TestRuntimeFamilyResolver.mjs';
// @ts-expect-error -- sibling .mjs runtime module has no emitted declaration.
import { ONE_Q_LOCAL_B64_LIFECYCLE_TEST, configuredOneQLocalB64LifecycleTestRuntimeFamily, resolveOneQLocalB64LifecycleTestRuntime } from './oneQLocalB64LifecycleTestRuntimeFamilyResolver.mjs';

/** Browser adapter for the single strict 1Q family resolver. */
const localChildren = Object.freeze({ root: rootManifest, ico: icoManifest, lending: lendingManifest, legion: legionManifest, franchise: franchiseManifest, marketplace10A: marketplace10AManifest, marketplace10B: marketplace10BManifest });
const bscChildren = Object.freeze({ root: rootManifest, treasury: treasuryManifest, ico: icoManifest, lending: lendingManifest, legion: legionManifest, marketplace10A: marketplace10AManifest, marketplace10B: marketplace10BManifest });
export type OneQRuntime = ReturnType<typeof resolveRuntimeFamily> | ReturnType<typeof resolveOneQBscTestnetRuntime> | ReturnType<typeof resolveOneQLocalR3TestRuntime>;
// Vite exposes explicitly configured public build values through import.meta.env
// in both dev-server modules and production bundles. Keep the browser runtime
// selection on that canonical path rather than a separately injected global.
const viteEnvironment = (import.meta as ImportMeta & {
  env?: { VITE_ABCDEFI_RUNTIME_FAMILY?: string };
}).env;
const configuredViteEnvironment = {
  VITE_ABCDEFI_RUNTIME_FAMILY: viteEnvironment?.VITE_ABCDEFI_RUNTIME_FAMILY,
};
export function resolveOneQFrontendRuntime(environment: Record<string, string | undefined> = configuredViteEnvironment): OneQRuntime {
  const selected = environment.VITE_ABCDEFI_RUNTIME_FAMILY ?? environment.ABCDEFI_RUNTIME_FAMILY;
  if (selected === ONE_Q_LOCAL_R3_TEST) {
    configuredOneQLocalR3TestRuntimeFamily(environment);
    return resolveOneQLocalR3TestRuntime(() => ({ descriptor: r3Descriptor, provenance: r3Provenance, unified: unifiedManifest, children: localChildren }));
  }
  if (selected === ONE_Q_LOCAL_B64_LIFECYCLE_TEST) {
    configuredOneQLocalB64LifecycleTestRuntimeFamily(environment);
    return resolveOneQLocalB64LifecycleTestRuntime(() => ({ descriptor: r3Descriptor, unified: unifiedManifest, root: rootManifest, lending: lendingManifest }));
  }
  if (selected === ONE_Q_BSC_TESTNET) return resolveOneQBscTestnetRuntime(() => ({ unified: unifiedManifest, children: bscChildren }));
  return resolveRuntimeFamily(configuredRuntimeFamily(environment), () => ({ unified: unifiedManifest, children: localChildren }));
}
export const oneQRuntime = resolveOneQFrontendRuntime();
export const ONE_Q_RUNTIME_FAMILY = oneQRuntime.family;
export const ONE_Q_RUNTIME_CHAIN_ID = BigInt(oneQRuntime.manifest.chainId);
export const ONE_Q_RUNTIME_RPC_URL = oneQRuntime.manifest.rpcUrl;
/** Explicit topology signal only. It never supplies a contract address or authority. */
export const ONE_Q_FRANCHISE_EXCLUDED = ONE_Q_RUNTIME_FAMILY === ONE_Q_LOCAL_R3_TEST
  ? isOneQLocalR3TestFranchiseExcluded(oneQRuntime)
  : isOneQLocalChildExcluded(oneQRuntime, 'franchise');
export type OneQAdminIdentity = Readonly<{
  runtimeFamily: '1Q_LOCAL' | '1Q_LOCAL_R3_TEST';
  operationalAdminWallet: string;
  rootDefaultAdminWallet: string;
  provenance: string;
}>;

// This is an explicit, local-runtime-only display identity. It is deliberately
// not derived from an allocation wallet and is never used to select a provider
// account, construct a signer, or evaluate an on-chain role.
const ONE_Q_LOCAL_ADMIN_IDENTITY = Object.freeze({
  runtimeFamily: ONE_Q_LOCAL,
  operationalAdminWallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  rootDefaultAdminWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  provenance: 'Explicit 1Q_LOCAL Admin operator configuration (display only; not an authorization source).',
});
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

/**
 * Fails closed for display when the selected family is not 1Q_LOCAL or a
 * configured identity is absent/malformed. Authorization remains exclusively
 * tied to the explicit provider wallet and live module hasRole() reads.
 */
export function resolveOneQAdminIdentity(
  runtimeFamily: string = ONE_Q_RUNTIME_FAMILY,
  configuredIdentity: typeof ONE_Q_LOCAL_ADMIN_IDENTITY | null = ONE_Q_LOCAL_ADMIN_IDENTITY,
): OneQAdminIdentity | null {
  if ((runtimeFamily !== ONE_Q_LOCAL && runtimeFamily !== ONE_Q_LOCAL_R3_TEST) || !configuredIdentity
    || !addressPattern.test(configuredIdentity.operationalAdminWallet)
    || !addressPattern.test(configuredIdentity.rootDefaultAdminWallet)) return null;
  return Object.freeze({ ...configuredIdentity, runtimeFamily: runtimeFamily as OneQAdminIdentity['runtimeFamily'] });
}
export const ONE_Q_ADMIN_IDENTITY = resolveOneQAdminIdentity();
export type OneQContractName = 'ABCDTokenV2' | 'ICOManagerV3' | 'TreasuryV2' | 'LendingPoolV2' | 'LendingReferralManagerV2' | 'InsuranceReserveV2' | 'LegionNFTV2' | 'FranchiseNFTV2' | 'FranchiseRegistryV2' | 'ABCDNFTMarketplaceV2' | 'LegionMarketplaceSettlementAdapterV2';
export const ONE_Q_CONTRACTS = Object.freeze(Object.fromEntries(Object.entries(oneQRuntime.manifest.contracts as Record<string, { address: string }>).map(([name, entry]) => [name, entry.address]))) as Readonly<Partial<Record<OneQContractName, string>>>;

/**
 * Converts the manifest's intentionally optional display map into a contract
 * call boundary. A missing or malformed address fails before a provider or
 * signer can be constructed; it is never replaced by a fallback address.
 */
export function requireOneQContractAddress(name: OneQContractName): string {
  const address = ONE_Q_CONTRACTS[name];
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`The selected 1Q runtime does not provide a valid ${name} address.`);
  }
  return address;
}
export const ONE_Q_DISTRIBUTION = Object.freeze({ totalSupply: '1000000000000000', allocations: Object.freeze({ ICO: '200000000000000', FOUNDER: '550000000000000', MARKETING: '100000000000000', ADVISORS: '20000000000000', FINANCE_RESOURCE: '90000000000000', CONTINGENCY: '20000000000000', RESERVE: '20000000000000' }), initialIcoInventory: Object.freeze({ stage1: '25000000', stage2: '25000000', total: '50000000' }) });
