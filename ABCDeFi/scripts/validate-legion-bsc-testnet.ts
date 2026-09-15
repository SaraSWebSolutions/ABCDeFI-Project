import { ethers } from "ethers";
import { assertBscLegionReadyToDeploy, assertBscTestnetChainId, loadLegionBscTestnetConfig, safeLegionBscPreflightSummary } from "./legion-bsc-testnet-config.js";

export async function runLegionBscTestnetPreflight() {
  const config = loadLegionBscTestnetConfig();
  assertBscLegionReadyToDeploy(config);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const [network, balance] = await Promise.all([provider.getNetwork(), provider.getBalance(config.deployer)]);
  assertBscTestnetChainId(network.chainId);
  return safeLegionBscPreflightSummary(config, balance);
}

async function main() { console.log(JSON.stringify(await runLegionBscTestnetPreflight(), null, 2)); }
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "BSC Legion preflight failed."); process.exitCode = 1; });
