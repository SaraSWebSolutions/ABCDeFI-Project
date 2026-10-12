import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

// This configuration is deliberately separate from hardhat.config.ts.  It is
// used exclusively by the disposable cross-layer revert harness and can never
// select the protected 1Q_LOCAL RPC or its chain id.
export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun", viaIR: true },
  },
  networks: {
    crossLayerRevert: { type: "edr-simulated", chainType: "l1", chainId: 31338 },
  },
  paths: { sources: "./contracts", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
});
