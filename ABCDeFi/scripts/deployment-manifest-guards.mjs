import fs from "node:fs";
import path from "node:path";

export const LOCAL_CHAIN_ID = 31337;

export function resolveManifestPath(value, fallback) {
  return path.resolve(value || fallback);
}

export function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

export function assertLocalChainId(chainId, label) {
  if (BigInt(chainId) !== BigInt(LOCAL_CHAIN_ID)) {
    throw new Error(`${label} permits only chain ${LOCAL_CHAIN_ID}; received ${chainId}.`);
  }
}

export function assertManifestOutputPath({ outputPath, sourcePaths = [], protectedPaths = [], allowOverwrite = false, label }) {
  if (!outputPath.toLowerCase().endsWith(".json")) {
    throw new Error(`${label} manifest path must end in .json.`);
  }
  for (const sourcePath of sourcePaths) {
    if (samePath(outputPath, sourcePath)) {
      throw new Error(`${label} output manifest must not equal its source manifest.`);
    }
  }
  for (const protectedPath of protectedPaths) {
    if (samePath(outputPath, protectedPath)) {
      throw new Error(`${label} must not overwrite the protected historical manifest ${path.resolve(protectedPath)}.`);
    }
  }
  if (fs.existsSync(outputPath) && !allowOverwrite) {
    throw new Error(`${label} output manifest already exists: ${outputPath}. Start a fresh local runtime or provide the explicit fresh-local overwrite flag.`);
  }
}

export function readJsonManifest(manifestPath, label) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`${label} manifest is required: ${manifestPath}.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    throw new Error(`${label} manifest cannot be parsed: ${manifestPath}.`);
  }
  if (!parsed || typeof parsed !== "object") throw new Error(`${label} manifest must contain an object.`);
  return parsed;
}

export function assertLocalManifest(manifest, label) {
  if (Number(manifest.chainId) !== LOCAL_CHAIN_ID) {
    throw new Error(`${label} manifest must target chain ${LOCAL_CHAIN_ID}.`);
  }
  if (manifest.network !== "localhost" && manifest.network !== "hardhat-local") {
    throw new Error(`${label} manifest must be a localhost local-runtime manifest.`);
  }
  return manifest;
}

export function manifestContractAddress(manifest, contractName, label) {
  const address = manifest?.contracts?.[contractName]?.address;
  if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`${label} manifest is missing a valid ${contractName} address.`);
  }
  return address;
}

export async function assertDeployedBytecode(provider, address, label) {
  const bytecode = await provider.getCode(address);
  if (bytecode === "0x") throw new Error(`${label} has no deployed bytecode at ${address}.`);
}
