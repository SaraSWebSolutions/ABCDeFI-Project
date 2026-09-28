import { spawnSync } from "node:child_process";
import path from "node:path";
import { network } from "hardhat";
import { assertLocalChainId, assertManifestOutputPath, resolveManifestPath } from "./deployment-manifest-guards.mjs";

const historicalRoot = path.resolve("deployments.json");
const paths = {
  // These names identify one newly generated canonical V2 snapshot.  Earlier
  // phase12-* manifests are historical evidence and are deliberately never
  // overwritten by this composed workflow.
  root: resolveManifestPath(process.env.PHASE12_ROOT_MANIFEST_PATH, "deployments.canonical-v2-root-local.json"),
  legion: resolveManifestPath(process.env.PHASE12_LEGION_MANIFEST_PATH, "deployments.canonical-v2-legion-local.json"),
  franchise: resolveManifestPath(process.env.PHASE12_FRANCHISE_MANIFEST_PATH, "deployments.canonical-v2-franchise-local.json"),
  legionMarketplace: resolveManifestPath(process.env.PHASE12_LEGION_MARKETPLACE_MANIFEST_PATH, "deployments.canonical-v2-legion-marketplace-local.json"),
  treasury: resolveManifestPath(process.env.PHASE12_TREASURY_MANIFEST_PATH, "deployments.canonical-v2-treasury-local.json"),
  marketplace: resolveManifestPath(process.env.PHASE12_ABCD_MARKETPLACE_MANIFEST_PATH, "deployments.canonical-v2-abcd-marketplace-local.json"),
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
  // This command is expressly a fresh-local runtime builder.  It may replace
  // only its own canonical-v2 outputs after the caller has started a fresh
  // chain; historical deployment records remain protected.
  assertManifestOutputPath({ outputPath: paths.root, protectedPaths: [historicalRoot], allowOverwrite: true, label: "Phase 12 root" });
  for (const [label, outputPath] of Object.entries(paths).filter(([label]) => label !== "root")) {
    assertManifestOutputPath({ outputPath, sourcePaths: [paths.root], protectedPaths: [historicalRoot], allowOverwrite: true, label: `Phase 12 ${label}` });
  }

  const common = {
    ...process.env,
    PHASE12_COMPOSED_LOCAL: "1",
    ROOT_DEPLOYMENT_MANIFEST_PATH: paths.root,
    ROOT_DEPLOYMENT_FRESH_LOCAL: "1",
    LEGION_NFT_V2_FRESH_LOCAL: "1",
    FRANCHISE_V2_FRESH_LOCAL: "1",
    LEGION_MARKETPLACE_FRESH_LOCAL: "1",
    TREASURY_V2_FRESH_LOCAL: "1",
    ABCD_NFT_MARKETPLACE_FRESH_LOCAL: "1",
  };
  run("scripts/deploy-ecosystem.ts", common);
  run("scripts/deploy-lending-v2-local.ts", { ...common, LENDING_V2_MANIFEST_PATH: paths.root });
  run("scripts/deploy-legion-nft-v2-local.ts", { ...common, LEGION_NFT_V2_MANIFEST_PATH: paths.legion });
  run("scripts/deploy-franchise-v2-local.ts", {
    ...common,
    LEGION_NFT_V2_MANIFEST_PATH: paths.legion,
    FRANCHISE_V2_MANIFEST_PATH: paths.franchise,
  });
  run("scripts/deploy-legion-marketplace-local.ts", {
    ...common,
    LEGION_MARKETPLACE_ROOT_MANIFEST_PATH: paths.root,
    LEGION_MARKETPLACE_LEGION_MANIFEST_PATH: paths.legion,
    LEGION_MARKETPLACE_MANIFEST_PATH: paths.legionMarketplace,
  });
  run("scripts/deploy-treasury-v2-local.ts", { ...common, TREASURY_V2_ROOT_MANIFEST_PATH: paths.root, TREASURY_V2_MANIFEST_PATH: paths.treasury });
  run("scripts/deploy-abcd-nft-marketplace-local.ts", { ...common, ABCD_NFT_MARKETPLACE_ROOT_MANIFEST_PATH: paths.root, ABCD_NFT_MARKETPLACE_MANIFEST_PATH: paths.marketplace });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
