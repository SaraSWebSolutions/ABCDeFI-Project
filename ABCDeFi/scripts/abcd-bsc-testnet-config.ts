import { ethers } from "ethers";

export const BSC_TESTNET_CHAIN_ID = 97n;
export const ABCD_MAX_SUPPLY = 1_000_000_000n * 10n ** 18n;
export const ABCD_NAME = "ABCDeFi Core Token";
export const ABCD_SYMBOL = "ABCD";
export const CAPPED_REISSUANCE_POLICY = "CAPPED_REISSUANCE_WITHIN_1B";

export type AbcdBscTestnetConfig = {
  rpcUrl: string;
  manifestPath: string;
  deployer: string;
  owner: string;
  defaultAdmin: string;
  minter: string;
  burner: string;
  pauser: string;
  infrastructure: string;
  liquidity: string;
  marketing: string;
  contracts: string;
  community: string;
  education: string;
  contingency: string;
  reserve: string;
  mintingPolicy: typeof CAPPED_REISSUANCE_POLICY;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required ${name}; canonical ABCD BSC Testnet deployment is blocked.`);
  return value;
}
function address(name: string): string {
  const value = required(name);
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) throw new Error(`${name} must be a nonzero address.`);
  return ethers.getAddress(value);
}

/** No allocation, authority, supply, or minting-policy default is permitted. */
export function loadAbcdBscTestnetConfig(): AbcdBscTestnetConfig {
  const config: AbcdBscTestnetConfig = {
    rpcUrl: required("BSC_TESTNET_RPC_URL"),
    manifestPath: required("BSC_TESTNET_ABCD_MANIFEST_PATH"),
    deployer: address("BSC_TESTNET_ABCD_DEPLOYER"),
    owner: address("BSC_TESTNET_ABCD_OWNER"),
    defaultAdmin: address("BSC_TESTNET_ABCD_DEFAULT_ADMIN"),
    minter: address("BSC_TESTNET_ABCD_MINTER"),
    burner: address("BSC_TESTNET_ABCD_BURNER"),
    pauser: address("BSC_TESTNET_ABCD_PAUSER"),
    infrastructure: address("BSC_TESTNET_ABCD_INFRASTRUCTURE_WALLET"),
    liquidity: address("BSC_TESTNET_ABCD_LIQUIDITY_WALLET"),
    marketing: address("BSC_TESTNET_ABCD_MARKETING_WALLET"),
    contracts: address("BSC_TESTNET_ABCD_CONTRACTS_WALLET"),
    community: address("BSC_TESTNET_ABCD_COMMUNITY_WALLET"),
    education: address("BSC_TESTNET_ABCD_EDUCATION_WALLET"),
    contingency: address("BSC_TESTNET_ABCD_CONTINGENCY_WALLET"),
    reserve: address("BSC_TESTNET_ABCD_RESERVE_WALLET"),
    mintingPolicy: required("BSC_TESTNET_ABCD_MINTING_POLICY") as typeof CAPPED_REISSUANCE_POLICY,
  };
  if (new URL(config.rpcUrl).protocol !== "https:") throw new Error("BSC_TESTNET_RPC_URL must be HTTPS.");
  if (!config.manifestPath.toLowerCase().endsWith(".json")) throw new Error("BSC_TESTNET_ABCD_MANIFEST_PATH must name a JSON manifest.");
  if (config.mintingPolicy !== CAPPED_REISSUANCE_POLICY) {
    throw new Error(`BSC_TESTNET_ABCD_MINTING_POLICY must explicitly acknowledge existing ${CAPPED_REISSUANCE_POLICY}; no alternative policy is implemented by this tooling.`);
  }
  return config;
}

export const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));

export async function verifyCanonicalAbcdToken(config: AbcdBscTestnetConfig, provider: ethers.Provider, tokenAddress: string, deploymentBlock: number) {
  if ((await provider.getNetwork()).chainId !== BSC_TESTNET_CHAIN_ID) throw new Error("RPC is not BSC Testnet chain 97.");
  if (await provider.getCode(tokenAddress) === "0x") throw new Error("Configured canonical ABCD token has no bytecode.");
  const token = new ethers.Contract(tokenAddress, [
    "function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)",
    "function maxSupply() view returns (uint256)", "function totalSupply() view returns (uint256)", "function owner() view returns (address)",
    "function treasury() view returns (address)", "function infrastructureWallet() view returns (address)", "function liquidityWallet() view returns (address)",
    "function marketingWallet() view returns (address)", "function contractsWallet() view returns (address)", "function communityWallet() view returns (address)",
    "function educationWallet() view returns (address)", "function contingencyWallet() view returns (address)", "function reserveWallet() view returns (address)",
    "function hasRole(bytes32,address) view returns (bool)",
    "event RoleGranted(bytes32 indexed role,address indexed account,address indexed sender)", "event RoleRevoked(bytes32 indexed role,address indexed account,address indexed sender)",
  ], provider);
  const [name, symbol, decimals, maxSupply, totalSupply, owner, treasury] = await Promise.all([token.name(), token.symbol(), token.decimals(), token.maxSupply(), token.totalSupply(), token.owner(), token.treasury()]);
  if (name !== ABCD_NAME || symbol !== ABCD_SYMBOL || decimals !== 18n || maxSupply !== ABCD_MAX_SUPPLY || totalSupply !== ABCD_MAX_SUPPLY) throw new Error("ABCD token metadata or fixed 1B supply verification failed.");
  if (ethers.getAddress(owner) !== config.owner || ethers.getAddress(treasury) !== config.infrastructure) throw new Error("ABCD owner or treasury relationship verification failed.");
  const wallets = [["infrastructureWallet", config.infrastructure], ["liquidityWallet", config.liquidity], ["marketingWallet", config.marketing], ["contractsWallet", config.contracts], ["communityWallet", config.community], ["educationWallet", config.education], ["contingencyWallet", config.contingency], ["reserveWallet", config.reserve]] as const;
  for (const [getter, expected] of wallets) if (ethers.getAddress(await token[getter]()) !== expected) throw new Error(`ABCD ${getter} verification failed.`);
  const expectedRoles = [["DEFAULT_ADMIN_ROLE", config.defaultAdmin], ["MINTER_ROLE", config.minter], ["BURNER_ROLE", config.burner], ["PAUSER_ROLE", config.pauser], ["TREASURY_ROLE", config.infrastructure]] as const;
  for (const [name_, holder] of expectedRoles) if (!await token.hasRole(ROLE(name_), holder)) throw new Error(`ABCD ${name_} holder verification failed.`);
  const events = await provider.getLogs({ address: tokenAddress, fromBlock: deploymentBlock, toBlock: "latest", topics: [[ethers.id("RoleGranted(bytes32,address,address)"), ethers.id("RoleRevoked(bytes32,address,address)")]] });
  const active = new Map<string, Set<string>>(); const iface = token.interface;
  for (const log of events) { const parsed = iface.parseLog(log); if (!parsed) continue; const key = String(parsed.args.role); const account = ethers.getAddress(parsed.args.account); const holders = active.get(key) || new Set<string>(); if (parsed.name === "RoleGranted") holders.add(account); else holders.delete(account); active.set(key, holders); }
  for (const [name_, holder] of expectedRoles) { const holders = active.get(ROLE(name_)) || new Set<string>(); if (holders.size !== 1 || !holders.has(holder)) throw new Error(`ABCD ${name_} has an unexpected active role holder.`); }
  return { token: tokenAddress, name, symbol, decimals: decimals.toString(), maxSupply: maxSupply.toString(), totalSupply: totalSupply.toString(), owner, treasury, marketingWallet: config.marketing, mintingPolicy: config.mintingPolicy };
}
