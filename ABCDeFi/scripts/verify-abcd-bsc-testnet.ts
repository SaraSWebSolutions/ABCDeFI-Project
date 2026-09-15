import fs from "node:fs";
import { ethers } from "ethers";
import { loadAbcdBscTestnetConfig, verifyCanonicalAbcdToken } from "./abcd-bsc-testnet-config";

async function main() {
  const config = loadAbcdBscTestnetConfig(); const manifest = JSON.parse(fs.readFileSync(config.manifestPath, "utf8"));
  const token = manifest.contracts?.ABCDToken; if (!token?.address || !Number.isInteger(token.deploymentBlock)) throw new Error("BSC Testnet ABCD manifest has no canonical ABCDToken deployment.");
  console.log(JSON.stringify({ status: "PASS", verification: await verifyCanonicalAbcdToken(config, new ethers.JsonRpcProvider(config.rpcUrl), token.address, token.deploymentBlock) }, null, 2));
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
