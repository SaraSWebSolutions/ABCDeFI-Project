import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "mocha";
import {
  LOCAL_LEGION_ADDRESS,
  assertBscTestnetChainId,
  assertDedicatedBscLegionManifestPath,
  loadLegionBscTestnetConfig,
  readLegionBscManifest,
  safeLegionBscPreflightSummary,
} from "../scripts/legion-bsc-testnet-config.js";

const fakeKey = `0x${"11".repeat(32)}`;
const temporaryManifest = () => path.join(os.tmpdir(), `deployments.legion-v2-bsc-testnet-${process.pid}-${Date.now()}.json`);
const env = (overrides: Record<string, string | undefined> = {}) => ({
  BSC_TESTNET_RPC_URL: "https://bsc-testnet.example.invalid",
  PRIVATE_KEY: fakeKey,
  BSC_LEGION_ADMIN: "0x1111111111111111111111111111111111111111",
  BSC_LEGION_MINTER: "0x2222222222222222222222222222222222222222",
  BSC_LEGION_PAUSER: "0x3333333333333333333333333333333333333333",
  BSC_LEGION_MANIFEST_PATH: temporaryManifest(),
  NFT_STORAGE_PROVIDER: "pinata",
  PINATA_JWT: "test-only-secret",
  ...overrides,
}) as NodeJS.ProcessEnv;

describe("Legion BSC Testnet readiness configuration", () => {
  it("accepts explicit BSC configuration and redacts secrets from the preflight summary", () => {
    const config = loadLegionBscTestnetConfig(env());
    const summary = JSON.stringify(safeLegionBscPreflightSummary(config, 123n));
    assert.equal(config.deployer.length, 42);
    assert.equal(summary.includes(fakeKey), false);
    assert.equal(summary.includes("test-only-secret"), false);
  });

  it("fails closed for a missing RPC, private key, roles, or IPFS credentials", () => {
    assert.throws(() => loadLegionBscTestnetConfig(env({ BSC_TESTNET_RPC_URL: undefined })), /BSC_TESTNET_RPC_URL/);
    assert.throws(() => loadLegionBscTestnetConfig(env({ PRIVATE_KEY: undefined })), /PRIVATE_KEY/);
    assert.throws(() => loadLegionBscTestnetConfig(env({ BSC_LEGION_MINTER: undefined })), /BSC_LEGION_MINTER/);
    assert.throws(() => loadLegionBscTestnetConfig(env({ PINATA_JWT: undefined })), /PINATA_JWT/);
  });

  it("rejects a wrong chain and never allows the root or local manifest path", () => {
    assert.throws(() => assertBscTestnetChainId(31337n), /expected BSC Testnet 97/);
    assert.doesNotThrow(() => assertBscTestnetChainId(97n));
    assert.throws(() => assertDedicatedBscLegionManifestPath("deployments.json"), /may not use/);
    assert.throws(() => assertDedicatedBscLegionManifestPath("deployments.legion-v2-local.json"), /may not use/);
  });

  it("rejects a local address in a BSC manifest and preserves undeployed isolation", () => {
    const file = temporaryManifest();
    try {
      fs.writeFileSync(file, JSON.stringify({ network: "bscTestnet", chainId: 97, environment: "testnet", deploymentStatus: "UNDEPLOYED", contracts: {} }));
      assert.equal(readLegionBscManifest(file)?.deploymentStatus, "UNDEPLOYED");
      fs.writeFileSync(file, JSON.stringify({ network: "bscTestnet", chainId: 97, environment: "testnet", deploymentStatus: "DEPLOYED", contracts: { LegionCredentialV2: { address: LOCAL_LEGION_ADDRESS } } }));
      assert.throws(() => readLegionBscManifest(file), /local Hardhat Legion address/);
    } finally { fs.rmSync(file, { force: true }); }
  });
});
