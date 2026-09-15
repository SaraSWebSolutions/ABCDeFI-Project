import { ethers } from "ethers";
import {
  BSC_TESTNET_CHAIN_ID,
  loadAbcdBscTestnetConfig,
} from "./abcd-bsc-testnet-config";

async function main(): Promise<void> {
  const config = loadAbcdBscTestnetConfig();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const network = await provider.getNetwork();

  if (network.chainId !== BSC_TESTNET_CHAIN_ID) {
    throw new Error(
      `Refusing token deployment preparation on chain ${network.chainId}; expected BSC Testnet ${BSC_TESTNET_CHAIN_ID}.`,
    );
  }

  const deployerBalance = await provider.getBalance(config.deployer);
  if (deployerBalance === 0n) {
    throw new Error(
      `Configured ABCD deployer ${config.deployer} has no BNB on BSC Testnet. Fund it before deployment.`,
    );
  }

  console.info("ABCD BSC Testnet deployment preparation is valid.");
  console.info(`Chain ID: ${network.chainId}`);
  console.info(`Deployer: ${config.deployer}`);
  console.info(`Owner: ${config.owner}`);
  console.info(`Manifest: ${config.manifestPath}`);
  console.info("No contract was deployed by this validation command.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
