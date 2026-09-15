import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

export const BSC_LEGION_CHAIN_ID = 97n;
export const LOCAL_LEGION_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ROOT_MANIFEST = path.resolve("deployments.json");
const LOCAL_MANIFEST = path.resolve("deployments.legion-v2-local.json");

export type LegionBscTestnetConfig = Readonly<{
  rpcUrl: string;
  privateKey: string;
  deployer: string;
  admin: string;
  minter: string;
  pauser: string;
  manifestPath: string;
}>;

export type LegionBscManifest = Readonly<{
  network: "bscTestnet";
  chainId: 97;
  environment: "testnet";
  deploymentStatus: "UNDEPLOYED" | "DEPLOYED";
  rpcUrl?: string;
  deploymentVersion?: string;
  deploymentBlock?: number;
  contracts: { LegionCredentialV2?: { address: string; deploymentTransactionHash: string; deploymentBlock: number; constructorArgs: [string, string] } };
  roles?: { defaultAdmin: string; legionAdmin: string; legionMinter: string; pauser: string };
}>;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required ${name}; BSC Testnet Legion deployment is blocked.`);
  return value;
}

function requiredAddress(env: NodeJS.ProcessEnv, name: string): string {
  const value = required(env, name);
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) throw new Error(`${name} must be a nonzero address.`);
  return ethers.getAddress(value);
}

/** Prevent a BSC script from ever receiving the root or isolated-local manifest. */
export function assertDedicatedBscLegionManifestPath(candidate: string): string {
  const resolved = path.resolve(candidate);
  if (!resolved.toLowerCase().endsWith(".json")) throw new Error("BSC_LEGION_MANIFEST_PATH must name a JSON manifest.");
  if (resolved === ROOT_MANIFEST || resolved === LOCAL_MANIFEST) {
    throw new Error("BSC Legion deployment may not use deployments.json or the isolated local Legion manifest.");
  }
  if (!path.basename(resolved).toLowerCase().includes("legion")) {
    throw new Error("BSC_LEGION_MANIFEST_PATH must be a dedicated Legion manifest.");
  }
  return resolved;
}

/** Loads only explicitly supplied, non-secret BSC deployment parameters. */
export function loadLegionBscTestnetConfig(env: NodeJS.ProcessEnv = process.env): LegionBscTestnetConfig {
  const rpcUrl = required(env, "BSC_TESTNET_RPC_URL");
  if (new URL(rpcUrl).protocol !== "https:") throw new Error("BSC_TESTNET_RPC_URL must use HTTPS.");
  const privateKey = required(env, "PRIVATE_KEY");
  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  let deployer: string;
  try { deployer = new ethers.Wallet(normalizedKey).address; } catch { throw new Error("PRIVATE_KEY is not a valid EVM private key."); }

  if (String(env.NFT_STORAGE_PROVIDER || "").toLowerCase() !== "pinata" || !env.PINATA_JWT?.trim()) {
    throw new Error("BSC Testnet Legion metadata requires NFT_STORAGE_PROVIDER=pinata and configured PINATA_JWT.");
  }

  return Object.freeze({
    rpcUrl,
    privateKey: normalizedKey,
    deployer,
    admin: requiredAddress(env, "BSC_LEGION_ADMIN"),
    minter: requiredAddress(env, "BSC_LEGION_MINTER"),
    pauser: requiredAddress(env, "BSC_LEGION_PAUSER"),
    manifestPath: assertDedicatedBscLegionManifestPath(required(env, "BSC_LEGION_MANIFEST_PATH")),
  });
}

export function assertBscTestnetChainId(chainId: bigint): void {
  if (chainId !== BSC_LEGION_CHAIN_ID) throw new Error(`RPC is chain ${chainId}; expected BSC Testnet ${BSC_LEGION_CHAIN_ID}.`);
}

export function safeLegionBscPreflightSummary(config: LegionBscTestnetConfig, balance: bigint) {
  return Object.freeze({
    chainId: Number(BSC_LEGION_CHAIN_ID),
    deployer: config.deployer,
    deployerTbnb: ethers.formatEther(balance),
    admin: config.admin,
    minter: config.minter,
    pauser: config.pauser,
    manifestPath: config.manifestPath,
  });
}

export function readLegionBscManifest(manifestPath: string): LegionBscManifest | null {
  if (!fs.existsSync(manifestPath)) return null;
  let value: unknown;
  try { value = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { throw new Error(`BSC Legion manifest cannot be parsed: ${manifestPath}`); }
  const manifest = value as Partial<LegionBscManifest>;
  if (manifest.network !== "bscTestnet" || manifest.chainId !== 97 || manifest.environment !== "testnet") {
    throw new Error("BSC Legion manifest must explicitly identify BSC Testnet chain 97 and environment testnet.");
  }
  if (manifest.deploymentStatus !== "UNDEPLOYED" && manifest.deploymentStatus !== "DEPLOYED") throw new Error("BSC Legion manifest has an invalid deployment status.");
  const address = manifest.contracts?.LegionCredentialV2?.address;
  if (address && (!ethers.isAddress(address) || ethers.getAddress(address) === LOCAL_LEGION_ADDRESS)) {
    throw new Error("BSC Legion manifest contains an invalid or local Hardhat Legion address.");
  }
  if (manifest.deploymentStatus === "UNDEPLOYED" && address) throw new Error("An undeployed BSC Legion manifest cannot contain a contract address.");
  if (manifest.deploymentStatus === "DEPLOYED" && !address) throw new Error("A deployed BSC Legion manifest must contain a contract address.");
  return manifest as LegionBscManifest;
}

export function assertBscLegionReadyToDeploy(config: LegionBscTestnetConfig): void {
  const current = readLegionBscManifest(config.manifestPath);
  if (current?.deploymentStatus === "DEPLOYED") throw new Error("Refusing to overwrite an existing BSC Legion deployment manifest.");
}

export function writeLegionBscManifestAtomically(manifestPath: string, manifest: LegionBscManifest): void {
  assertDedicatedBscLegionManifestPath(manifestPath);
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, manifestPath);
}
