import assert from "node:assert/strict";
import test from "node:test";
import { E2E_RUNTIME_VERSION, HARDHAT_TEST_MNEMONIC, buildAnvilArgs } from "./oneq-persistent-runtime.mjs";

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
