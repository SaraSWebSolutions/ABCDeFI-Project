import { ethers } from "ethers";
import { loadBscTestnetConfig, validateBscTestnetConfig } from "./lending-v2-bsc-testnet-config";

async function main() {
  const config = loadBscTestnetConfig();
  const result = await validateBscTestnetConfig(config, new ethers.JsonRpcProvider(config.rpcUrl));
  console.log(JSON.stringify({ status: "PASS", ...result, collateralAsset: "native BNB", valuationFeed: "BNB/USD", execution: "WBNB -> fixed route -> ABCD" }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
