import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ONE_Q_LOCAL, OneQRuntimeFamilyError, configuredRuntimeFamily, resolveRuntimeFamily, validateOneQLocalRuntimeFamily, verifyOneQLocalLiveChain } from "../src/Config/oneQRuntimeFamilyResolver.mjs";

const here = process.cwd();
const loadJson = (file) => JSON.parse(fs.readFileSync(path.join(here, file), "utf8"));
const unified = loadJson("deployments.1q-local.json");
const children = Object.fromEntries(Object.entries(unified.childManifests).map(([name, detail]) => [name, JSON.parse(fs.readFileSync(detail.path, "utf8"))]));
const clone = (value) => structuredClone(value);
const error = (action, text) => assert.throws(action, (value) => value instanceof OneQRuntimeFamilyError && value.message.includes(text));
const valid = () => validateOneQLocalRuntimeFamily(clone(unified), clone(children));

test("valid explicit 1Q family resolves without a historical fallback", () => {
  assert.equal(configuredRuntimeFamily({ VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_LOCAL }), ONE_Q_LOCAL);
  error(() => configuredRuntimeFamily({}), "selected explicitly");
  const resolved = resolveRuntimeFamily(ONE_Q_LOCAL, () => ({ unified: clone(unified), children: clone(children) }));
  assert.equal(resolved.family, ONE_Q_LOCAL);
  assert.equal(resolved.manifest.contracts.ABCDTokenV2.address, unified.contracts.ABCDTokenV2.address);
});

test("missing, wrong-chain, and wrong-RPC 1Q manifests fail closed", () => {
  error(() => validateOneQLocalRuntimeFamily(undefined, children), "missing or malformed");
  const missingIdentity = clone(unified); delete missingIdentity.deploymentIdentity; error(() => validateOneQLocalRuntimeFamily(missingIdentity, children), "deployment identity");
  const wrongChain = clone(unified); wrongChain.chainId = 97; error(() => validateOneQLocalRuntimeFamily(wrongChain, children), "chain ID");
  const wrongRpc = clone(children); wrongRpc.legion.rpcUrl = "http://127.0.0.1:8545"; error(() => validateOneQLocalRuntimeFamily(unified, wrongRpc), "RPC provenance");
});

test("missing children and invalid or zero required addresses fail closed", () => {
  const missing = clone(children); delete missing.franchise; error(() => validateOneQLocalRuntimeFamily(unified, missing), "missing the franchise child");
  const absent = clone(unified); delete absent.contracts.InsuranceReserveV2; error(() => validateOneQLocalRuntimeFamily(absent, children), "InsuranceReserveV2");
  const zero = clone(unified); zero.contracts.LendingPoolV2.address = "0x0000000000000000000000000000000000000000"; error(() => validateOneQLocalRuntimeFamily(zero, children), "LendingPoolV2");
});

test("token, Phase 10B Legion, and Franchise Registry bindings fail closed when mismatched", () => {
  const tokenMismatch = clone(children); tokenMismatch.marketplace10A.contracts.ABCDTokenV2.address = children.legion.contracts.LegionNFTV2.address; error(() => validateOneQLocalRuntimeFamily(unified, tokenMismatch), "Phase 10A ABCDTokenV2");
  const legionMismatch = clone(children); legionMismatch.marketplace10B.contracts.LegionNFTV2.address = children.franchise.contracts.FranchiseNFTV2.address; error(() => validateOneQLocalRuntimeFamily(unified, legionMismatch), "Phase 10B LegionNFTV2");
  const franchiseMismatch = clone(children); franchiseMismatch.franchise.contracts.LegionNFTV2.address = children.franchise.contracts.FranchiseNFTV2.address; error(() => validateOneQLocalRuntimeFamily(unified, franchiseMismatch), "Franchise Registry LegionNFTV2");
});

test("an explicit 1Q selection never invokes a historical deployment loader", () => {
  let historicalRead = false;
  const historical = () => { historicalRead = true; return loadJson("deployments.json"); };
  const resolved = resolveRuntimeFamily(ONE_Q_LOCAL, () => ({ unified: clone(unified), children: clone(children) }));
  assert.equal(resolved.family, ONE_Q_LOCAL);
  assert.equal(historicalRead, false);
  assert.throws(() => resolveRuntimeFamily("HISTORICAL", historical), OneQRuntimeFamilyError);
  assert.equal(historicalRead, false);
});

test("live verification rejects a wrong chain or a missing required bytecode address", async () => {
  const resolved = valid();
  const provider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => "0x6000" };
  await assert.doesNotReject(() => verifyOneQLocalLiveChain(resolved, provider));
  await assert.rejects(() => verifyOneQLocalLiveChain(resolved, { ...provider, getNetwork: async () => ({ chainId: 97n }) }), OneQRuntimeFamilyError);
  await assert.rejects(() => verifyOneQLocalLiveChain(resolved, { ...provider, getCode: async () => "0x" }), OneQRuntimeFamilyError);
});
