import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = (name) => fs.readFileSync(path.join(scriptsDirectory, name), "utf8");

test("Legion Marketplace reuses manifest-selected ABCD and Legion contracts without deploying duplicates", () => {
  const runner = source("deploy-legion-marketplace-local.ts");
  assert.match(runner, /LEGION_MARKETPLACE_ROOT_MANIFEST_PATH/);
  assert.match(runner, /LEGION_MARKETPLACE_LEGION_MANIFEST_PATH/);
  assert.match(runner, /manifestContractAddress\(rootManifest, "ABCDToken"/);
  assert.match(runner, /manifestContractAddress\(legionManifest, "LegionNFTV2"/);
  assert.match(runner, /Adapter\.deploy\(legionAddress, abcdAddress/);
  assert.doesNotMatch(runner, /Token\.deploy\(/);
  assert.doesNotMatch(runner, /Legion\.deploy\(/);
});

test("Treasury and generic Marketplace have a root-ABCD reuse path", () => {
  for (const name of ["deploy-treasury-v2-local.ts", "deploy-abcd-nft-marketplace-local.ts"]) {
    const runner = source(name);
    assert.match(runner, /ROOT_DEPLOYMENT_MANIFEST_PATH/);
    assert.match(runner, /manifestContractAddress\(rootManifest, "ABCDToken"/);
    assert.match(runner, /reusedFromManifest/);
    assert.match(runner, /assertDeployedBytecode/);
  }
});

test("fresh-runtime runners protect manifest targets and retain Phase 1/2 deployment configuration", () => {
  const root = source("deploy-ecosystem.ts");
  const lending = source("deploy-lending-v2-local.ts");
  const franchise = source("migrate-franchise-local.ts");
  assert.match(root, /ROOT_DEPLOYMENT_MANIFEST_PATH/);
  assert.match(root, /assertManifestOutputPath/);
  assert.match(lending, /LENDING_V2_MANIFEST_PATH/);
  assert.match(lending, /assertLocalChainId/);
  assert.match(franchise, /FRANCHISE_MANIFEST_PATH is required/);
  assert.match(franchise, /sourcePaths: \[basePath\]/);
  assert.match(lending, /lendingV2/);
  assert.match(lending, /LTV_BPS/);
});

test("composed runner has the approved narrow order and does not start a Hardhat node", () => {
  const runner = source("deploy-phase12-composed-local.ts");
  const orderedScripts = [
    "scripts/deploy-ecosystem.ts",
    "scripts/deploy-lending-v2-local.ts",
    "scripts/deploy-legion-nft-v2-local.ts",
    "scripts/deploy-legion-marketplace-local.ts",
    "scripts/deploy-treasury-v2-local.ts",
    "scripts/deploy-abcd-nft-marketplace-local.ts",
    "scripts/migrate-franchise-local.ts",
  ];
  let lastIndex = -1;
  for (const script of orderedScripts) {
    const index = runner.indexOf(script);
    assert.ok(index > lastIndex, `${script} must retain approved ordering`);
    lastIndex = index;
  }
  assert.doesNotMatch(runner, /hardhat node/);
  assert.doesNotMatch(runner, /indexer/);
});
