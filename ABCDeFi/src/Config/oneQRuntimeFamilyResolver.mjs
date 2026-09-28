/**
 * Strict selection and validation for the isolated 1Q local deployment family.
 * Callers must explicitly select 1Q_LOCAL and provide the unified manifest plus
 * its seven declared child manifests. This module deliberately has no 1B
 * manifest import, path fallback, address fallback, or chain/RPC inference.
 */
export const ONE_Q_LOCAL = "1Q_LOCAL";
export const ONE_Q_CHAIN_ID = 31337;
export const ONE_Q_RPC_URL = "http://127.0.0.1:8546";

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const CHILDREN = ["root", "ico", "lending", "legion", "franchise", "marketplace10A", "marketplace10B"];
const CONTRACTS = ["ABCDTokenV2", "ICOManagerV3", "TreasuryV2", "LendingPoolV2", "LendingReferralManagerV2", "InsuranceReserveV2", "LegionNFTV2", "FranchiseNFTV2", "FranchiseRegistryV2", "ABCDNFTMarketplaceV2", "LegionMarketplaceSettlementAdapterV2"];

export class OneQRuntimeFamilyError extends Error {}

function fail(message) { throw new OneQRuntimeFamilyError(message); }
function address(value, label) {
  if (typeof value !== "string" || !ADDRESS.test(value) || value.toLowerCase() === ZERO_ADDRESS) fail(`1Q_LOCAL has an invalid ${label} address.`);
  return value;
}
function same(left, right, label) {
  if (address(left, `${label} left`).toLowerCase() !== address(right, `${label} right`).toLowerCase()) fail(`1Q_LOCAL has inconsistent ${label} binding.`);
}
function child(value, name) {
  if (!value || typeof value !== "object") fail(`1Q_LOCAL is missing the ${name} child manifest.`);
  if (Number(value.chainId) !== ONE_Q_CHAIN_ID) fail(`1Q_LOCAL ${name} child chain ID is invalid.`);
  if (value.rpcUrl !== ONE_Q_RPC_URL) fail(`1Q_LOCAL ${name} child RPC provenance is invalid.`);
  if (typeof value.deploymentVersion !== "string" || value.deploymentVersion.trim() === "") fail(`1Q_LOCAL ${name} child deployment identity is missing.`);
  return value;
}

/** Validates only explicitly supplied 1Q data; it never loads historical configuration. */
export function validateOneQLocalRuntimeFamily(unified, suppliedChildren) {
  if (!unified || typeof unified !== "object") fail("1Q_LOCAL unified manifest is missing or malformed.");
  if (unified.model !== "OWNER_APPROVED_1Q_DEPLOYMENT_FAMILY") fail("1Q_LOCAL unified manifest model is invalid.");
  if (Number(unified.chainId) !== ONE_Q_CHAIN_ID) fail("1Q_LOCAL unified manifest chain ID is invalid.");
  if (unified.rpcUrl !== ONE_Q_RPC_URL) fail("1Q_LOCAL unified manifest RPC provenance is invalid.");
  if (typeof unified.deploymentIdentity !== "string" || unified.deploymentIdentity.trim() === "") fail("1Q_LOCAL unified manifest deployment identity is missing.");
  if (!unified.childManifests || typeof unified.childManifests !== "object") fail("1Q_LOCAL unified manifest child identities are missing.");

  const children = {};
  for (const name of CHILDREN) {
    if (!unified.childManifests[name]?.path || !unified.childManifests[name]?.deploymentVersion) fail(`1Q_LOCAL unified manifest is missing the ${name} child identity.`);
    children[name] = child(suppliedChildren?.[name], name);
    if (children[name].deploymentVersion !== unified.childManifests[name].deploymentVersion) fail(`1Q_LOCAL ${name} child deployment identity does not match the unified manifest.`);
  }
  if (children.root.model !== "OWNER_APPROVED_1Q_SEVEN_ALLOCATION") fail("1Q_LOCAL root child is not the owner-approved seven-allocation manifest.");
  if (children.ico.model !== "OWNER_APPROVED_1Q_ICO_V3" || children.lending.model !== "OWNER_APPROVED_1Q_LENDING_V2") fail("1Q_LOCAL ICO or Lending child model is invalid.");

  for (const name of CONTRACTS) address(unified.contracts?.[name]?.address, name);
  const token = unified.contracts.ABCDTokenV2.address;
  same(children.root.contracts?.ABCDTokenV2?.address, token, "root ABCDTokenV2");
  same(children.ico.contracts?.ABCDTokenV2?.address, token, "ICO ABCDTokenV2");
  same(children.lending.contracts?.ABCDTokenV2?.address, token, "Lending ABCDTokenV2");
  same(children.marketplace10A.contracts?.ABCDTokenV2?.address, token, "Phase 10A ABCDTokenV2");
  same(children.marketplace10B.contracts?.ABCDTokenV2?.address, token, "Phase 10B ABCDTokenV2");
  same(children.legion.contracts?.LegionNFTV2?.address, unified.contracts.LegionNFTV2.address, "LegionNFTV2");
  same(children.franchise.contracts?.LegionNFTV2?.address, unified.contracts.LegionNFTV2.address, "Franchise Registry LegionNFTV2");
  same(children.franchise.contracts?.FranchiseNFTV2?.address, unified.contracts.FranchiseNFTV2.address, "FranchiseNFTV2");
  same(children.franchise.contracts?.FranchiseRegistryV2?.address, unified.contracts.FranchiseRegistryV2.address, "FranchiseRegistryV2");
  same(children.marketplace10B.contracts?.LegionNFTV2?.address, unified.contracts.LegionNFTV2.address, "Phase 10B LegionNFTV2");
  return Object.freeze({ family: ONE_Q_LOCAL, manifest: unified, children: Object.freeze(children) });
}

/** The only accepted explicit 1Q selection path. No historical-loader parameter exists. */
export function resolveRuntimeFamily(family, loadOneQLocal) {
  if (family !== ONE_Q_LOCAL) fail(`Unsupported runtime family: ${String(family)}.`);
  if (typeof loadOneQLocal !== "function") fail("1Q_LOCAL requires an explicit family loader.");
  const loaded = loadOneQLocal();
  return validateOneQLocalRuntimeFamily(loaded?.unified, loaded?.children);
}

/** Vite/backend adapters must pass their explicit configuration object here. */
export function configuredRuntimeFamily(environment) {
  const family = environment?.VITE_ABCDEFI_RUNTIME_FAMILY ?? environment?.ABCDEFI_RUNTIME_FAMILY;
  if (family !== ONE_Q_LOCAL) fail("1Q_LOCAL must be selected explicitly by application runtime configuration.");
  return ONE_Q_LOCAL;
}

/** Live-chain verification is intentionally separate from JSON validation. */
export async function verifyOneQLocalLiveChain(resolved, provider) {
  if (!resolved || resolved.family !== ONE_Q_LOCAL) fail("A validated 1Q_LOCAL runtime is required for live verification.");
  if (!provider || typeof provider.getNetwork !== "function" || typeof provider.getCode !== "function") fail("1Q_LOCAL requires a chain provider for live verification.");
  const network = await provider.getNetwork();
  if (Number(network?.chainId) !== ONE_Q_CHAIN_ID) fail("1Q_LOCAL live chain ID is invalid.");
  const verified = new Set();
  const verifyCode = async (name, target) => {
    const valid = address(target, name);
    const key = valid.toLowerCase();
    if (verified.has(key)) return;
    if (await provider.getCode(valid) === "0x") fail(`1Q_LOCAL ${name} has no live bytecode.`);
    verified.add(key);
  };
  for (const name of CONTRACTS) await verifyCode(name, resolved.manifest.contracts[name].address);
  // A selected family cannot leave a child-manifest contract unchecked. The
  // JSON relationship rules above remain centralized; this only proves every
  // declared deployed address still has code on that same live chain.
  for (const [childName, childManifest] of Object.entries(resolved.children)) {
    for (const [contractName, contract] of Object.entries(childManifest.contracts || {})) {
      await verifyCode(`${childName} ${contractName}`, contract?.address);
    }
  }
  return true;
}
