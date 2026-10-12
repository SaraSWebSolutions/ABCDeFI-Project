import assert from "node:assert/strict";
import test from "node:test";
import { BSC_TESTNET_CHAIN_ID, ONE_Q_ALLOCATION_NAMES, ONE_Q_ALLOCATION_BPS, OneQBscTestnetConfigurationError, assertBscTestnetChain, assertNoMockOracle, bscHttpsRpc, bscManifestPath, loadRootConfig, nonzeroAddress } from "./oneq-bsc-testnet-foundation.mjs";
import { BSC_CHILDREN, ONE_Q_BSC_TESTNET, validateOneQBscTestnetRuntimeFamily, verifyOneQBscTestnetLiveChain } from "../src/Config/oneQBscTestnetRuntimeFamilyResolver.mjs";

const address = (n) => `0x${String(n).padStart(40, "0")}`;
const environment = Object.fromEntries([
  ["BSC_TESTNET_RPC_URL", "https://testnet.example.invalid"], ["BSC_TESTNET_1Q_ROOT_MANIFEST_PATH", "artifacts/deployments.1q-bsc-testnet-root.json"], ["BSC_TESTNET_1Q_DEPLOYER", address(1)], ["BSC_TESTNET_1Q_OWNER", address(2)], ["BSC_TESTNET_1Q_DEFAULT_ADMIN", address(3)], ["BSC_TESTNET_1Q_MINTER", address(4)], ["BSC_TESTNET_1Q_BURNER", address(5)], ["BSC_TESTNET_1Q_PAUSER", address(6)], ...ONE_Q_ALLOCATION_NAMES.map((name, index) => [`BSC_TESTNET_1Q_${name}_WALLET`, address(index + 10)]),
]);

test("canonical 1Q BSC root requires exactly seven explicit nonzero allocation bindings", () => {
  const config = loadRootConfig(environment);
  assert.equal(config.family, "1Q_BSC_TESTNET");
  assert.deepEqual(Object.keys(config.allocations), ONE_Q_ALLOCATION_NAMES);
  assert.equal(Object.values(ONE_Q_ALLOCATION_BPS).reduce((sum, value) => sum + value, 0), 10_000);
  const missing = { ...environment }; delete missing.BSC_TESTNET_1Q_RESERVE_WALLET;
  assert.throws(() => loadRootConfig(missing), OneQBscTestnetConfigurationError);
});

test("BSC foundation fails closed for local RPC, zero address, and wrong chain", () => {
  assert.throws(() => bscHttpsRpc({ BSC_TESTNET_RPC_URL: "http://127.0.0.1:8546" }), /non-localhost HTTPS/);
  assert.throws(() => nonzeroAddress({ VALUE: "0x0000000000000000000000000000000000000000" }, "VALUE"), /nonzero/);
  assert.doesNotThrow(() => assertBscTestnetChain(BSC_TESTNET_CHAIN_ID));
  assert.throws(() => assertBscTestnetChain(31337), /only chain 97/);
  assert.throws(() => bscManifestPath({ VALUE: "deployments.json" }, "VALUE"), /dedicated non-local/);
  assert.throws(() => assertNoMockOracle("BNB/USD", address(9), [address(9)]), /rejects local mock/);
});

test("sealed BSC unified runtime rejects local/historical identity, binding mismatch, mock feeds, and absent bytecode", async () => {
  const contractNames = ["ABCDTokenV2", "TreasuryV2", "ICOManagerV3", "LendingPoolV2", "LendingReferralManagerV2", "InsuranceReserveV2", "LegionNFTV2", "ABCDNFTMarketplaceV2", "LegionMarketplaceSettlementAdapterV2"];
  const contracts = Object.fromEntries(contractNames.map((name, index) => [name, { address: address(index + 40) }]));
  const child = (name) => ({ runtimeFamily: ONE_Q_BSC_TESTNET, chainId: 97, rpcUrl: "https://testnet.example.invalid", localOnly: false, deploymentVersion: `${name}-version`, manifestHash: `sha256:${name}`, contracts: { ABCDTokenV2: contracts.ABCDTokenV2, ...(name === "treasury" ? { TreasuryV2: contracts.TreasuryV2 } : {}), ...(name === "ico" ? { ICOManagerV3: contracts.ICOManagerV3 } : {}), ...(name === "lending" ? { LendingPoolV2: contracts.LendingPoolV2, LendingReferralManagerV2: contracts.LendingReferralManagerV2, InsuranceReserveV2: contracts.InsuranceReserveV2 } : {}), ...(name === "legion" ? { LegionNFTV2: contracts.LegionNFTV2 } : {}), ...(name === "marketplace10A" ? { ABCDNFTMarketplaceV2: contracts.ABCDNFTMarketplaceV2 } : {}), ...(name === "marketplace10B" ? { LegionNFTV2: contracts.LegionNFTV2, LegionMarketplaceSettlementAdapterV2: contracts.LegionMarketplaceSettlementAdapterV2 } : {}) } });
  const children = Object.fromEntries(BSC_CHILDREN.map(name => [name, child(name)]));
  const unified = { runtimeFamily: ONE_Q_BSC_TESTNET, model: "OWNER_APPROVED_1Q_BSC_TESTNET_DEPLOYMENT_FAMILY", chainId: 97, rpcUrl: "https://testnet.example.invalid", deploymentIdentity: "a".repeat(64), contracts, childManifests: Object.fromEntries(BSC_CHILDREN.map(name => [name, { path: `${name}.json`, deploymentVersion: children[name].deploymentVersion, manifestHash: children[name].manifestHash }])), allocations: Object.fromEntries(ONE_Q_ALLOCATION_NAMES.map(name => [name, { wallet: address(100 + ONE_Q_ALLOCATION_NAMES.indexOf(name)), bps: ONE_Q_ALLOCATION_BPS[name] }])), oracle: { ico: { BNB_USD: { realTestnetFeed: true } }, lending: { realTestnetFeeds: true } } };
  const runtime = validateOneQBscTestnetRuntimeFamily(unified, children);
  assert.equal(runtime.family, ONE_Q_BSC_TESTNET);
  await assert.doesNotReject(() => verifyOneQBscTestnetLiveChain(runtime, { getNetwork: async () => ({ chainId: 97n }), getCode: async () => "0x6000" }));
  await assert.rejects(() => verifyOneQBscTestnetLiveChain(runtime, { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => "0x6000" }), /chain ID/);
  const historical = structuredClone(unified); historical.chainId = 31337;
  assert.throws(() => validateOneQBscTestnetRuntimeFamily(historical, children), /chain\/RPC/);
  const mismatch = structuredClone(children); mismatch.marketplace10B.contracts.ABCDTokenV2 = { address: address(999) };
  assert.throws(() => validateOneQBscTestnetRuntimeFamily(unified, mismatch), /ABCDTokenV2/);
  const mock = structuredClone(unified); mock.oracle.lending.realTestnetFeeds = false;
  assert.throws(() => validateOneQBscTestnetRuntimeFamily(mock, children), /mock/);
});
