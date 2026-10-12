/** Strict BSC Testnet counterpart to 1Q_LOCAL. It accepts sealed Testnet-only manifests and never loads local or historical families. */
export const ONE_Q_BSC_TESTNET = "1Q_BSC_TESTNET";
export const ONE_Q_BSC_TESTNET_CHAIN_ID = 97;
export const BSC_CHILDREN = ["root", "treasury", "ico", "lending", "legion", "marketplace10A", "marketplace10B"];
export const BSC_CONTRACTS = ["ABCDTokenV2", "TreasuryV2", "ICOManagerV3", "LendingPoolV2", "LendingReferralManagerV2", "InsuranceReserveV2", "LegionNFTV2", "ABCDNFTMarketplaceV2", "LegionMarketplaceSettlementAdapterV2"];
const ADDRESS = /^0x[a-fA-F0-9]{40}$/; const ZERO = "0x0000000000000000000000000000000000000000";
export class OneQBscTestnetRuntimeFamilyError extends Error {}
const fail = message => { throw new OneQBscTestnetRuntimeFamilyError(message); };
const address = (value, label) => { if (typeof value !== "string" || !ADDRESS.test(value) || value.toLowerCase() === ZERO) fail(`1Q_BSC_TESTNET has an invalid ${label} address.`); return value; };
const equal = (left, right, label) => { if (address(left, `${label} left`).toLowerCase() !== address(right, `${label} right`).toLowerCase()) fail(`1Q_BSC_TESTNET has inconsistent ${label} binding.`); };
export function configuredBscRuntimeFamily(environment) { if (environment?.ABCDEFI_RUNTIME_FAMILY !== ONE_Q_BSC_TESTNET && environment?.VITE_ABCDEFI_RUNTIME_FAMILY !== ONE_Q_BSC_TESTNET) fail("1Q_BSC_TESTNET must be selected explicitly."); return ONE_Q_BSC_TESTNET; }
export function validateOneQBscTestnetRuntimeFamily(unified, suppliedChildren) {
  if (!unified || typeof unified !== "object" || unified.runtimeFamily !== ONE_Q_BSC_TESTNET || unified.model !== "OWNER_APPROVED_1Q_BSC_TESTNET_DEPLOYMENT_FAMILY") fail("1Q_BSC_TESTNET unified manifest model is invalid.");
  if (Number(unified.chainId) !== ONE_Q_BSC_TESTNET_CHAIN_ID || typeof unified.rpcUrl !== "string" || !unified.rpcUrl.startsWith("https://") || /localhost|127\.0\.0\.1/i.test(unified.rpcUrl)) fail("1Q_BSC_TESTNET unified manifest chain/RPC provenance is invalid.");
  if (typeof unified.deploymentIdentity !== "string" || !/^[a-f0-9]{64}$/i.test(unified.deploymentIdentity)) fail("1Q_BSC_TESTNET deployment identity is invalid.");
  const children = {};
  for (const name of BSC_CHILDREN) { const detail = unified.childManifests?.[name]; const child = suppliedChildren?.[name]; if (!detail?.path || !detail?.deploymentVersion || !detail?.manifestHash || !child) fail(`1Q_BSC_TESTNET unified manifest is missing ${name} child identity.`); if (child.runtimeFamily !== ONE_Q_BSC_TESTNET || Number(child.chainId) !== ONE_Q_BSC_TESTNET_CHAIN_ID || child.rpcUrl !== unified.rpcUrl || child.localOnly !== false || child.deploymentVersion !== detail.deploymentVersion || child.manifestHash !== detail.manifestHash) fail(`1Q_BSC_TESTNET ${name} child provenance is invalid.`); children[name] = child; }
  for (const name of BSC_CONTRACTS) address(unified.contracts?.[name]?.address, name);
  const token = unified.contracts.ABCDTokenV2.address; for (const name of ["root", "ico", "lending", "marketplace10A", "marketplace10B"]) equal(children[name].contracts?.ABCDTokenV2?.address, token, `${name} ABCDTokenV2`);
  equal(children.treasury.contracts?.TreasuryV2?.address, unified.contracts.TreasuryV2.address, "TreasuryV2"); equal(children.legion.contracts?.LegionNFTV2?.address, unified.contracts.LegionNFTV2.address, "LegionNFTV2"); equal(children.marketplace10B.contracts?.LegionNFTV2?.address, unified.contracts.LegionNFTV2.address, "Phase 10B LegionNFTV2");
  for (const name of ["ICO", "FOUNDER", "MARKETING", "ADVISORS", "FINANCE_RESOURCE", "CONTINGENCY", "RESERVE"]) address(unified.allocations?.[name]?.wallet, `allocation ${name}`);
  if (Object.values(unified.allocations).reduce((total, entry) => total + Number(entry?.bps || 0), 0) !== 10_000) fail("1Q_BSC_TESTNET allocation basis points are invalid.");
  if (!unified.oracle?.ico?.BNB_USD?.realTestnetFeed || !unified.oracle?.lending?.realTestnetFeeds) fail("1Q_BSC_TESTNET rejects mock or undeclared oracle feeds.");
  return Object.freeze({ family: ONE_Q_BSC_TESTNET, manifest: unified, children: Object.freeze(children) });
}
export function resolveOneQBscTestnetRuntime(load) { if (typeof load !== "function") fail("1Q_BSC_TESTNET requires an explicit manifest loader."); const loaded = load(); return validateOneQBscTestnetRuntimeFamily(loaded?.unified, loaded?.children); }
export async function verifyOneQBscTestnetLiveChain(resolved, provider) { if (!resolved || resolved.family !== ONE_Q_BSC_TESTNET) fail("A validated 1Q_BSC_TESTNET runtime is required."); if (Number((await provider.getNetwork())?.chainId) !== ONE_Q_BSC_TESTNET_CHAIN_ID) fail("1Q_BSC_TESTNET live chain ID is invalid."); const seen = new Set(); for (const [name, contract] of Object.entries(resolved.manifest.contracts)) { const target = address(contract?.address, name); if (!seen.has(target.toLowerCase())) { if (await provider.getCode(target) === "0x") fail(`1Q_BSC_TESTNET ${name} has no live bytecode.`); seen.add(target.toLowerCase()); } } return true; }
