import { ethers } from "ethers";

export const BSC_TESTNET_CHAIN_ID = 97n;
export const NATIVE_BNB_ASSET = "0x0000000000000000000000000000000000000001";

export type BscConfig = {
  rpcUrl: string;
  manifestPath: string;
  deployer: string;
  abcd: string;
  treasury: string;
  bnbUsdFeed: string;
  abcdUsdFeed: string;
  bnbHeartbeat: bigint;
  abcdHeartbeat: bigint;
  wbnb: string;
  router: string;
  routerVersion: "V2";
  pool: string;
  route: string[];
  deadlineSeconds: bigint;
  configAdmin: string;
  reserveFunding: bigint;
  poolLiquidity: bigint;
  referralAllowance: bigint;
  marketingRewardFunder: string;
  routeProbeWbnb: bigint;
  routeProbeMinAbcdOut: bigint;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required ${name}; BSC Testnet liquidation remains fail-closed.`);
  return value;
}
function address(name: string): string {
  const value = required(name);
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) throw new Error(`${name} must be a nonzero address.`);
  return ethers.getAddress(value);
}
function positive(name: string): bigint {
  const value = BigInt(required(name));
  if (value <= 0n) throw new Error(`${name} must be greater than zero.`);
  return value;
}
function routerVersion(): "V2" {
  const value = required("BSC_TESTNET_PANCAKESWAP_ROUTER_VERSION");
  if (value !== "V2") throw new Error("BSC_TESTNET_PANCAKESWAP_ROUTER_VERSION must be V2: the deployed adapter uses the V2 router ABI.");
  return value;
}

/** No defaults: every production/external value must be owner supplied. */
export function loadBscTestnetConfig(): BscConfig {
  const route = required("BSC_TESTNET_LIQUIDATION_ROUTE").split(",").map(value => value.trim()).filter(Boolean).map(value => {
    if (!ethers.isAddress(value) || value === ethers.ZeroAddress) throw new Error("BSC_TESTNET_LIQUIDATION_ROUTE contains an invalid address.");
    return ethers.getAddress(value);
  });
  const config: BscConfig = {
    rpcUrl: required("BSC_TESTNET_RPC_URL"),
    manifestPath: required("BSC_TESTNET_DEPLOYMENT_MANIFEST_PATH"),
    deployer: address("BSC_TESTNET_DEPLOYER"),
    abcd: address("BSC_TESTNET_ABCD_TOKEN"), treasury: address("BSC_TESTNET_TREASURY"),
    bnbUsdFeed: address("BSC_TESTNET_BNB_USD_FEED"), abcdUsdFeed: address("BSC_TESTNET_ABCD_USD_FEED"),
    bnbHeartbeat: positive("BSC_TESTNET_BNB_USD_HEARTBEAT_SECONDS"), abcdHeartbeat: positive("BSC_TESTNET_ABCD_USD_HEARTBEAT_SECONDS"),
    wbnb: address("BSC_TESTNET_WBNB"), router: address("BSC_TESTNET_PANCAKESWAP_ROUTER"), routerVersion: routerVersion(), pool: address("BSC_TESTNET_LIQUIDATION_POOL"), route,
    deadlineSeconds: positive("BSC_TESTNET_LIQUIDATION_DEADLINE_SECONDS"), configAdmin: address("BSC_TESTNET_CONFIG_ADMIN"),
    reserveFunding: positive("BSC_TESTNET_RESERVE_FUNDING_WEI"), poolLiquidity: positive("BSC_TESTNET_POOL_LIQUIDITY_WEI"), referralAllowance: positive("BSC_TESTNET_REFERRAL_ALLOWANCE_WEI"), marketingRewardFunder: address("BSC_TESTNET_MARKETING_REWARD_FUNDER"),
    routeProbeWbnb: positive("BSC_TESTNET_ROUTE_PROBE_WBNB_WEI"), routeProbeMinAbcdOut: positive("BSC_TESTNET_ROUTE_PROBE_MIN_ABCD_OUT_WEI"),
  };
  if (new URL(config.rpcUrl).protocol !== "https:") throw new Error("BSC_TESTNET_RPC_URL must be HTTPS.");
  if (!config.manifestPath.toLowerCase().endsWith(".json")) throw new Error("BSC_TESTNET_DEPLOYMENT_MANIFEST_PATH must name a JSON manifest.");
  if (config.route.length !== 2 || config.route[0] !== config.wbnb || config.route[1] !== config.abcd) throw new Error("Route must be the approved direct WBNB -> ABCD pair.");
  return config;
}

export async function validateBscTestnetConfig(config: BscConfig, provider: ethers.Provider) {
  if ((await provider.getNetwork()).chainId !== BSC_TESTNET_CHAIN_ID) throw new Error("RPC is not BSC Testnet chain 97.");
  for (const [name, value] of Object.entries({ ABCD: config.abcd, Treasury: config.treasury, bnbUsdFeed: config.bnbUsdFeed, abcdUsdFeed: config.abcdUsdFeed, WBNB: config.wbnb, router: config.router, pool: config.pool, configAdmin: config.configAdmin })) {
    if (name !== "Treasury" && name !== "configAdmin" && await provider.getCode(value) === "0x") throw new Error(`${name} has no deployed bytecode on BSC Testnet.`);
  }
  const feedAbi = ["function decimals() view returns (uint8)", "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"];
  for (const [name, feed, heartbeat] of [["BNB/USD", config.bnbUsdFeed, config.bnbHeartbeat], ["ABCD/USD", config.abcdUsdFeed, config.abcdHeartbeat]] as const) {
    const oracle = new ethers.Contract(feed, feedAbi, provider);
    const [roundId, answer,, updatedAt, answeredInRound] = await oracle.latestRoundData();
    if (answer <= 0n || updatedAt === 0n || answeredInRound < roundId || BigInt(Math.floor(Date.now() / 1000)) - updatedAt > heartbeat) throw new Error(`${name} feed is invalid or stale for its supplied heartbeat.`);
    await oracle.decimals();
  }
  const router = new ethers.Contract(config.router, ["function WETH() view returns (address)", "function getAmountsOut(uint256,address[]) view returns (uint256[])"] , provider);
  if (ethers.getAddress(await router.WETH()) !== config.wbnb) throw new Error("Configured router WETH() does not equal configured WBNB.");
  const amounts = await router.getAmountsOut(config.routeProbeWbnb, config.route);
  if (amounts.length !== config.route.length || amounts.at(-1)! < config.routeProbeMinAbcdOut) throw new Error("Configured route does not satisfy the owner-supplied liquidity probe minimum.");
  const pool = new ethers.Contract(config.pool, ["function token0() view returns (address)", "function token1() view returns (address)", "function getReserves() view returns (uint112,uint112,uint32)"], provider);
  const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);
  const [reserve0, reserve1] = await pool.getReserves();
  const isConfiguredPair = (ethers.getAddress(token0) === config.wbnb && ethers.getAddress(token1) === config.abcd) || (ethers.getAddress(token0) === config.abcd && ethers.getAddress(token1) === config.wbnb);
  if (!isConfiguredPair || reserve0 === 0n || reserve1 === 0n) throw new Error("Configured WBNB/ABCD pool is not a liquid route pair.");
  return { chainId: 97, routeProbeAbcdOut: amounts.at(-1)!.toString(), routeHash: ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address[]"], [config.route])) };
}
