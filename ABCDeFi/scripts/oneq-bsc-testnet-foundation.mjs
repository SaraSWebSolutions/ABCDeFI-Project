import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ethers } from "ethers";

export const ONE_Q_BSC_TESTNET = "1Q_BSC_TESTNET";
export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_TESTNET_CHILDREN = ["root", "treasury", "ico", "lending", "legion", "marketplace10A", "marketplace10B"];
export const ONE_Q_ALLOCATION_NAMES = ["ICO", "FOUNDER", "MARKETING", "ADVISORS", "FINANCE_RESOURCE", "CONTINGENCY", "RESERVE"];
export const ONE_Q_ALLOCATION_BPS = Object.freeze({ ICO: 2000, FOUNDER: 5500, MARKETING: 1000, ADVISORS: 200, FINANCE_RESOURCE: 900, CONTINGENCY: 200, RESERVE: 200 });
export const ZERO_ADDRESS = ethers.ZeroAddress;

export class OneQBscTestnetConfigurationError extends Error {}
const fail = (message) => { throw new OneQBscTestnetConfigurationError(message); };
export const roleId = (name) => ethers.keccak256(ethers.toUtf8Bytes(name));

export function required(environment, name) {
  const value = environment?.[name]?.trim();
  if (!value) fail(`Missing required ${name}; canonical 1Q BSC Testnet deployment is blocked.`);
  return value;
}

export function nonzeroAddress(environment, name) {
  const value = required(environment, name);
  if (!ethers.isAddress(value) || ethers.getAddress(value) === ZERO_ADDRESS) fail(`${name} must be a nonzero EVM address.`);
  return ethers.getAddress(value);
}

export function positive(environment, name) {
  const value = required(environment, name);
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) fail(`${name} must be a positive integer.`);
  return BigInt(value);
}

export function bscHttpsRpc(environment) {
  const value = required(environment, "BSC_TESTNET_RPC_URL");
  let url;
  try { url = new URL(value); } catch { fail("BSC_TESTNET_RPC_URL must be a valid HTTPS URL."); }
  if (url.protocol !== "https:" || /localhost|127\.0\.0\.1|::1/i.test(url.hostname)) fail("BSC_TESTNET_RPC_URL must be a non-localhost HTTPS BSC Testnet endpoint.");
  return value;
}

export function bscManifestPath(environment, name) {
  const value = path.resolve(required(environment, name));
  const base = path.basename(value).toLowerCase();
  if (!base.endsWith(".json") || base === "deployments.json" || base.includes("1q-local") || base.includes("localhost")) fail(`${name} must name a dedicated non-local BSC Testnet JSON manifest.`);
  return value;
}

export function assertBscTestnetChain(chainId) {
  if (Number(chainId) !== BSC_TESTNET_CHAIN_ID) fail(`Canonical 1Q BSC Testnet deployment permits only chain ${BSC_TESTNET_CHAIN_ID}; received ${chainId}.`);
}

export function assertFreshManifestPath(manifestPath, label) {
  if (fs.existsSync(manifestPath)) fail(`${label} refuses to overwrite an existing manifest: ${manifestPath}.`);
}

export function sealManifest(manifest) {
  const manifestHash = `sha256:${createHash("sha256").update(JSON.stringify(manifest)).digest("hex")}`;
  return Object.freeze({ ...manifest, manifestHash });
}

export function assertNoMockOracle(label, address, mockAddresses = []) {
  if (!ethers.isAddress(address) || ethers.getAddress(address) === ZERO_ADDRESS) fail(`${label} oracle must be a nonzero address.`);
  if (mockAddresses.map(value => value.toLowerCase()).includes(address.toLowerCase())) fail(`${label} rejects local mock oracle addresses.`);
}

export function loadRootConfig(environment = process.env) {
  const allocations = Object.fromEntries(ONE_Q_ALLOCATION_NAMES.map(name => [name, nonzeroAddress(environment, `BSC_TESTNET_1Q_${name}_WALLET`)]));
  const bps = Object.values(ONE_Q_ALLOCATION_BPS).reduce((total, value) => total + value, 0);
  if (bps !== 10_000) fail("Canonical seven-allocation basis points do not sum to 10000.");
  return Object.freeze({
    family: ONE_Q_BSC_TESTNET,
    rpcUrl: bscHttpsRpc(environment),
    manifestPath: bscManifestPath(environment, "BSC_TESTNET_1Q_ROOT_MANIFEST_PATH"),
    deployer: nonzeroAddress(environment, "BSC_TESTNET_1Q_DEPLOYER"),
    owner: nonzeroAddress(environment, "BSC_TESTNET_1Q_OWNER"),
    defaultAdmin: nonzeroAddress(environment, "BSC_TESTNET_1Q_DEFAULT_ADMIN"),
    minter: nonzeroAddress(environment, "BSC_TESTNET_1Q_MINTER"),
    burner: nonzeroAddress(environment, "BSC_TESTNET_1Q_BURNER"),
    pauser: nonzeroAddress(environment, "BSC_TESTNET_1Q_PAUSER"),
    allocations,
  });
}

export function loadModuleConfig(environment = process.env, module) {
  const root = loadRootConfig(environment);
  const prefix = `BSC_TESTNET_1Q_${module.toUpperCase()}_`;
  const common = { ...root, manifestPath: bscManifestPath(environment, `${prefix}MANIFEST_PATH`) };
  if (module === "treasury") return Object.freeze({ ...common, roles: Object.freeze({ defaultAdmin: nonzeroAddress(environment, `${prefix}DEFAULT_ADMIN`), assetManager: nonzeroAddress(environment, `${prefix}ASSET_MANAGER`), funderManager: nonzeroAddress(environment, `${prefix}FUNDER_MANAGER`), operator: nonzeroAddress(environment, `${prefix}OPERATOR`), recipientManager: nonzeroAddress(environment, `${prefix}RECIPIENT_MANAGER`), pauser: nonzeroAddress(environment, `${prefix}PAUSER`), unpauser: nonzeroAddress(environment, `${prefix}UNPAUSER`), funder: nonzeroAddress(environment, `${prefix}FUNDER`), recipient: nonzeroAddress(environment, `${prefix}RECIPIENT`) }) });
  if (module === "ico") return Object.freeze({ ...common, bnbUsdFeed: nonzeroAddress(environment, "BSC_TESTNET_BNB_USD_FEED"), maxPriceAge: positive(environment, "BSC_TESTNET_BNB_USD_HEARTBEAT_SECONDS"), proceedsRecipient: nonzeroAddress(environment, `${prefix}PROCEEDS_RECIPIENT`), roles: Object.freeze({ admin: nonzeroAddress(environment, `${prefix}ADMIN`), pauser: nonzeroAddress(environment, `${prefix}PAUSER`), oracleAdmin: nonzeroAddress(environment, `${prefix}ORACLE_ADMIN`), eligibilityAdmin: nonzeroAddress(environment, `${prefix}ELIGIBILITY_ADMIN`), custodyAdmin: nonzeroAddress(environment, `${prefix}CUSTODY_ADMIN`) }), stageOneStart: positive(environment, `${prefix}STAGE_ONE_START`), stageOneEnd: positive(environment, `${prefix}STAGE_ONE_END`), stageTwoStart: positive(environment, `${prefix}STAGE_TWO_START`), stageTwoEnd: positive(environment, `${prefix}STAGE_TWO_END`) });
  if (module === "lending") return Object.freeze({ ...common, treasury: nonzeroAddress(environment, "BSC_TESTNET_TREASURY"), bnbUsdFeed: nonzeroAddress(environment, "BSC_TESTNET_BNB_USD_FEED"), abcdUsdFeed: nonzeroAddress(environment, "BSC_TESTNET_ABCD_USD_FEED"), bnbHeartbeat: positive(environment, "BSC_TESTNET_BNB_USD_HEARTBEAT_SECONDS"), abcdHeartbeat: positive(environment, "BSC_TESTNET_ABCD_USD_HEARTBEAT_SECONDS"), wbnb: nonzeroAddress(environment, "BSC_TESTNET_WBNB"), router: nonzeroAddress(environment, "BSC_TESTNET_PANCAKESWAP_ROUTER"), routerVersion: required(environment, "BSC_TESTNET_PANCAKESWAP_ROUTER_VERSION"), pool: nonzeroAddress(environment, "BSC_TESTNET_LIQUIDATION_POOL"), route: required(environment, "BSC_TESTNET_LIQUIDATION_ROUTE").split(",").map(value => value.trim()).map(value => ethers.getAddress(value)), deadlineSeconds: positive(environment, "BSC_TESTNET_LIQUIDATION_DEADLINE_SECONDS"), configAdmin: nonzeroAddress(environment, "BSC_TESTNET_CONFIG_ADMIN"), reserveFunding: positive(environment, "BSC_TESTNET_RESERVE_FUNDING_WEI"), poolLiquidity: positive(environment, "BSC_TESTNET_POOL_LIQUIDITY_WEI"), referralAllowance: positive(environment, "BSC_TESTNET_REFERRAL_ALLOWANCE_WEI"), marketingRewardFunder: nonzeroAddress(environment, "BSC_TESTNET_MARKETING_REWARD_FUNDER"), routeProbeWbnb: positive(environment, "BSC_TESTNET_ROUTE_PROBE_WBNB_WEI"), routeProbeMinAbcdOut: positive(environment, "BSC_TESTNET_ROUTE_PROBE_MIN_ABCD_OUT_WEI") });
  if (module === "legion") return Object.freeze({ ...common, roles: Object.freeze({ defaultAdmin: nonzeroAddress(environment, `${prefix}DEFAULT_ADMIN`), minter: nonzeroAddress(environment, `${prefix}MINTER`), pauser: nonzeroAddress(environment, `${prefix}PAUSER`) }) });
  if (module === "marketplace10a") return Object.freeze({ ...common, collections: required(environment, `${prefix}COLLECTIONS`).split(",").map(value => ethers.getAddress(value.trim())), roles: Object.freeze({ defaultAdmin: nonzeroAddress(environment, `${prefix}DEFAULT_ADMIN`), admin: nonzeroAddress(environment, `${prefix}ADMIN`), pauser: nonzeroAddress(environment, `${prefix}PAUSER`) }) });
  if (module === "marketplace10b") return Object.freeze({ ...common, legion: nonzeroAddress(environment, "BSC_TESTNET_1Q_LEGION_ADDRESS"), legionManifestPath: bscManifestPath(environment, "BSC_TESTNET_1Q_LEGION_MANIFEST_PATH"), roles: Object.freeze({ defaultAdmin: nonzeroAddress(environment, `${prefix}DEFAULT_ADMIN`), settlementAdmin: nonzeroAddress(environment, `${prefix}SETTLEMENT_ADMIN`), pauser: nonzeroAddress(environment, `${prefix}PAUSER`), legionAdmin: nonzeroAddress(environment, "BSC_TESTNET_1Q_LEGION_ADMIN") }) });
  fail(`Unsupported canonical 1Q BSC Testnet module: ${module}.`);
}

export function rootManifest(config, deployment) {
  const manifest = { schemaVersion: "1.0", runtimeFamily: ONE_Q_BSC_TESTNET, network: "bscTestnet", chainId: BSC_TESTNET_CHAIN_ID, rpcUrl: config.rpcUrl, model: "OWNER_APPROVED_1Q_SEVEN_ALLOCATION", localOnly: false, deploymentVersion: `abcd-1q-bsc-testnet-${deployment.blockHash}`, deploymentBlock: deployment.block, deployer: config.deployer, contracts: { ABCDTokenV2: deployment.contract }, allocations: Object.fromEntries(ONE_Q_ALLOCATION_NAMES.map(name => [name, { wallet: config.allocations[name], bps: ONE_Q_ALLOCATION_BPS[name] }])), roles: { owner: config.owner, defaultAdmin: config.defaultAdmin, minter: config.minter, burner: config.burner, pauser: config.pauser }, bytecodeVerified: true };
  return sealManifest(manifest);
}
