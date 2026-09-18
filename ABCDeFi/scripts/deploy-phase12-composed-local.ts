import { spawnSync } from "node:child_process";
import path from "node:path";
import { network } from "hardhat";
import { assertLocalChainId, assertManifestOutputPath, resolveManifestPath } from "./deployment-manifest-guards.mjs";

const historicalRoot = path.resolve("deployments.json");
const paths = {
  root: resolveManifestPath(process.env.PHASE12_ROOT_MANIFEST_PATH, "deployments.phase12-root-fresh-local.json"),
  legion: resolveManifestPath(process.env.PHASE12_LEGION_MANIFEST_PATH, "deployments.phase12-legion-fresh-local.json"),
  legionMarketplace: resolveManifestPath(process.env.PHASE12_LEGION_MARKETPLACE_MANIFEST_PATH, "deployments.phase12-legion-marketplace-fresh-local.json"),
  treasury: resolveManifestPath(process.env.PHASE12_TREASURY_MANIFEST_PATH, "deployments.phase12-treasury-fresh-local.json"),
  marketplace: resolveManifestPath(process.env.PHASE12_ABCD_MARKETPLACE_MANIFEST_PATH, "deployments.phase12-abcd-marketplace-fresh-local.json"),
  franchise: resolveManifestPath(process.env.PHASE12_FRANCHISE_MANIFEST_PATH, "deployments.phase12-franchise-fresh-local.json"),
};

function run(script: string, environment: NodeJS.ProcessEnv) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  // Windows cannot spawn a .cmd shim directly without a shell. This affects
  // only the local runner process and preserves the same explicit command and
  // isolated-manifest safeguards on every platform.
  const result = spawnSync(npx, ["hardhat", "run", script, "--network", "localhost"], {
    stdio: "inherit", env: environment, shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Phase 12 composed deployment stopped at ${script}.`);
}

async function main() {
  const { ethers } = await network.connect();
  assertLocalChainId((await ethers.provider.getNetwork()).chainId, "Phase 12 composed local deployment");
  assertManifestOutputPath({ outputPath: paths.root, protectedPaths: [historicalRoot], label: "Phase 12 root" });
  for (const [label, outputPath] of Object.entries(paths).filter(([label]) => label !== "root")) {
    assertManifestOutputPath({ outputPath, sourcePaths: [paths.root], protectedPaths: [historicalRoot], label: `Phase 12 ${label}` });
  }

  const common = { ...process.env, PHASE12_COMPOSED_LOCAL: "1", ROOT_DEPLOYMENT_MANIFEST_PATH: paths.root };
  run("scripts/deploy-ecosystem.ts", common);
  run("scripts/deploy-lending-v2-local.ts", { ...common, LENDING_V2_MANIFEST_PATH: paths.root });
  run("scripts/deploy-legion-nft-v2-local.ts", { ...common, LEGION_NFT_V2_MANIFEST_PATH: paths.legion });
  run("scripts/deploy-legion-marketplace-local.ts", {
    ...common,
    LEGION_MARKETPLACE_ROOT_MANIFEST_PATH: paths.root,
    LEGION_MARKETPLACE_LEGION_MANIFEST_PATH: paths.legion,
    LEGION_MARKETPLACE_MANIFEST_PATH: paths.legionMarketplace,
  });
  run("scripts/deploy-treasury-v2-local.ts", { ...common, TREASURY_V2_ROOT_MANIFEST_PATH: paths.root, TREASURY_V2_MANIFEST_PATH: paths.treasury });
  run("scripts/deploy-abcd-nft-marketplace-local.ts", { ...common, ABCD_NFT_MARKETPLACE_ROOT_MANIFEST_PATH: paths.root, ABCD_NFT_MARKETPLACE_MANIFEST_PATH: paths.marketplace });
  run("scripts/migrate-franchise-local.ts", { ...common, FRANCHISE_BASE_MANIFEST_PATH: paths.root, FRANCHISE_MANIFEST_PATH: paths.franchise });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
