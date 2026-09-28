import unifiedManifest from '@abcdefi/oneq-unified-manifest';
import rootManifest from '@abcdefi/oneq-root-manifest';
import icoManifest from '@abcdefi/oneq-ico-manifest';
import lendingManifest from '@abcdefi/oneq-lending-manifest';
import legionManifest from '@abcdefi/oneq-legion-manifest';
import franchiseManifest from '@abcdefi/oneq-franchise-manifest';
import marketplace10AManifest from '@abcdefi/oneq-marketplace10A-manifest';
import marketplace10BManifest from '@abcdefi/oneq-marketplace10B-manifest';
// The resolver is deliberately plain ESM so the backend and browser share its
// exact validation semantics. It is typed here by its exported adapter shape.
// @ts-expect-error -- sibling .mjs runtime module has no emitted declaration.
import { ONE_Q_CHAIN_ID, ONE_Q_LOCAL, ONE_Q_RPC_URL, configuredRuntimeFamily, resolveRuntimeFamily } from './oneQRuntimeFamilyResolver.mjs';

/** Browser adapter for the single strict 1Q family resolver. */
const children = Object.freeze({ root: rootManifest, ico: icoManifest, lending: lendingManifest, legion: legionManifest, franchise: franchiseManifest, marketplace10A: marketplace10AManifest, marketplace10B: marketplace10BManifest });
export type OneQRuntime = ReturnType<typeof resolveRuntimeFamily>;
declare const __ABCDEFI_RUNTIME_FAMILY__: string | undefined;
// Vite injects the explicit build/runtime family below. Node-only focused
// tests may provide the same explicit environment variable; neither path has
// a default deployment family.
const viteEnvironment = { VITE_ABCDEFI_RUNTIME_FAMILY: typeof __ABCDEFI_RUNTIME_FAMILY__ === 'string' ? __ABCDEFI_RUNTIME_FAMILY__ : (typeof process !== 'undefined' ? process.env.VITE_ABCDEFI_RUNTIME_FAMILY : undefined) };
export function resolveOneQFrontendRuntime(environment: Record<string, string | undefined> = viteEnvironment): OneQRuntime { return resolveRuntimeFamily(configuredRuntimeFamily(environment), () => ({ unified: unifiedManifest, children })); }
export const oneQRuntime = resolveOneQFrontendRuntime();
export const ONE_Q_RUNTIME_FAMILY = ONE_Q_LOCAL;
export const ONE_Q_RUNTIME_CHAIN_ID = BigInt(ONE_Q_CHAIN_ID);
export const ONE_Q_RUNTIME_RPC_URL = ONE_Q_RPC_URL;
export const ONE_Q_CONTRACTS = Object.freeze(Object.fromEntries(Object.entries(oneQRuntime.manifest.contracts as Record<string, { address: string }>).map(([name, entry]) => [name, entry.address]))) as Readonly<Record<'ABCDTokenV2' | 'ICOManagerV3' | 'TreasuryV2' | 'LendingPoolV2' | 'LendingReferralManagerV2' | 'InsuranceReserveV2' | 'LegionNFTV2' | 'FranchiseNFTV2' | 'FranchiseRegistryV2' | 'ABCDNFTMarketplaceV2' | 'LegionMarketplaceSettlementAdapterV2', string>>;
export const ONE_Q_DISTRIBUTION = Object.freeze({ totalSupply: '1000000000000000', allocations: Object.freeze({ ICO: '200000000000000', FOUNDER: '550000000000000', MARKETING: '100000000000000', ADVISORS: '20000000000000', FINANCE_RESOURCE: '90000000000000', CONTINGENCY: '20000000000000', RESERVE: '20000000000000' }), initialIcoInventory: Object.freeze({ stage1: '25000000', stage2: '25000000', total: '50000000' }) });
