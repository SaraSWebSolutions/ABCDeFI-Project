import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  LOCAL_CHAIN_ID,
  assertDeployedBytecode,
  assertLocalChainId,
  assertLocalManifest,
  assertManifestOutputPath,
  manifestContractAddress,
  readJsonManifest,
} from "./deployment-manifest-guards.mjs";

const ADDRESS = "0x0000000000000000000000000000000000000001";

test("fresh-runtime guards require chain 31337", () => {
  assert.doesNotThrow(() => assertLocalChainId(31337n, "local deployment"));
  assert.throws(() => assertLocalChainId(97n, "local deployment"), /only chain 31337/);
});

test("fresh-runtime guards require a selected local manifest and extract its root ABCD address", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "abcdefi-manifest-"));
  const manifestPath = path.join(directory, "root.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ chainId: LOCAL_CHAIN_ID, network: "localhost", contracts: { ABCDToken: { address: ADDRESS } } }));
  const manifest = assertLocalManifest(readJsonManifest(manifestPath, "root"), "root");
  assert.equal(manifestContractAddress(manifest, "ABCDToken", "root"), ADDRESS);
  assert.throws(() => readJsonManifest(path.join(directory, "missing.json"), "root"), /manifest is required/);
});

test("fresh-runtime guards reject historical outputs, existing outputs, and source/output collisions", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "abcdefi-manifest-"));
  const source = path.join(directory, "root.json");
  const output = path.join(directory, "output.json");
  fs.writeFileSync(source, "{}");
  assert.throws(() => assertManifestOutputPath({ outputPath: source, sourcePaths: [source], label: "Legion Marketplace" }), /must not equal/);
  assert.throws(() => assertManifestOutputPath({ outputPath: path.join(directory, "deployments.json"), protectedPaths: [path.join(directory, "deployments.json")], label: "root" }), /protected historical/);
  fs.writeFileSync(output, "{}");
  assert.throws(() => assertManifestOutputPath({ outputPath: output, label: "Treasury" }), /already exists/);
});

test("fresh-runtime guards reject absent bytecode", async () => {
  await assert.rejects(() => assertDeployedBytecode({ getCode: async () => "0x" }, ADDRESS, "ABCDToken"), /no deployed bytecode/);
  await assert.doesNotReject(() => assertDeployedBytecode({ getCode: async () => "0x6000" }, ADDRESS, "ABCDToken"));
});
