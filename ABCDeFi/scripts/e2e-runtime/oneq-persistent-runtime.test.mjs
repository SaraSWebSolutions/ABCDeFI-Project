import assert from "node:assert/strict";
import test from "node:test";
import { E2E_RUNTIME_VERSION, HARDHAT_TEST_MNEMONIC, assertOwnedRuntimeMetadata, buildAnvilArgs, startPersistentRuntime } from "./oneq-persistent-runtime.mjs";

test("persistent local runtime pins deterministic isolated Anvil settings", () => {
  const argumentsList = buildAnvilArgs({ statePath: "C:/runtime/anvil-state.json", configPath: "C:/runtime/anvil-config.json", port: 8546 });
  assert.equal(E2E_RUNTIME_VERSION, "oneq-anvil-persistent-v1");
  assert.equal(HARDHAT_TEST_MNEMONIC, "test test test test test test test test test test test junk");
  assert.deepEqual(argumentsList, [
    "--host", "127.0.0.1", "--port", "8546", "--chain-id", "31337",
    "--mnemonic", HARDHAT_TEST_MNEMONIC, "--hardfork", "cancun",
    "--dump-state", "C:/runtime/anvil-state.json", "--state-interval", "1",
    "--preserve-historical-states", "--config-out", "C:/runtime/anvil-config.json",
  ]);
});

test("parameterized disposable runtime preserves explicit non-default chain ID", () => {
  const argumentsList = buildAnvilArgs({ statePath: "C:/runtime/anvil-state.json", configPath: "C:/runtime/anvil-config.json", port: 8562, chainId: 31338 });
  assert.equal(argumentsList[argumentsList.indexOf("--port") + 1], "8562");
  assert.equal(argumentsList[argumentsList.indexOf("--chain-id") + 1], "31338");
});

test("owned runtime metadata cannot be reused for another port, run, directory, or chain", () => {
  const directory = "C:/runtime/b64";
  const metadata = {
    pid: 1234, chainId: 31338, rpcUrl: "http://127.0.0.1:8562", runtimeDirectory: directory,
    ownership: { runtimeFamily: "1Q_LOCAL_B64_LIFECYCLE_TEST", runId: "20261009_01" },
  };
  assert.doesNotThrow(() => assertOwnedRuntimeMetadata(metadata, { directory, port: 8562, chainId: 31338, runtimeFamily: "1Q_LOCAL_B64_LIFECYCLE_TEST", runId: "20261009_01" }));
  for (const options of [
    { directory, port: 8563, chainId: 31338, runtimeFamily: "1Q_LOCAL_B64_LIFECYCLE_TEST", runId: "20261009_01" },
    { directory, port: 8562, chainId: 31337, runtimeFamily: "1Q_LOCAL_B64_LIFECYCLE_TEST", runId: "20261009_01" },
    { directory: "C:/runtime/other", port: 8562, chainId: 31338, runtimeFamily: "1Q_LOCAL_B64_LIFECYCLE_TEST", runId: "20261009_01" },
    { directory, port: 8562, chainId: 31338, runtimeFamily: "1Q_LOCAL_B64_LIFECYCLE_TEST", runId: "other" },
  ]) assert.throws(() => assertOwnedRuntimeMetadata(metadata, options), /ownership/);
});

test("generic runtime start cannot bypass the B6.4 facade", async () => {
  await assert.rejects(() => startPersistentRuntime({
    directory: "C:/runtime/b64-lifecycle-20261009_01", fresh: true, port: 8562, chainId: 31338,
  }), /B6.4 runtime may be started only by its phase-specific facade/);
});
