import { network } from "hardhat";
import { ethers as ethersJs } from "ethers";
import { assertBscLegionReadyToDeploy, assertBscTestnetChainId, loadLegionBscTestnetConfig, writeLegionBscManifestAtomically } from "./legion-bsc-testnet-config.js";

async function main() {
  // Runs all read-only checks before any deployment transaction is constructed.
  const config = loadLegionBscTestnetConfig();
  assertBscLegionReadyToDeploy(config);
  const preflightProvider = new ethersJs.JsonRpcProvider(config.rpcUrl);
  assertBscTestnetChainId((await preflightProvider.getNetwork()).chainId);
  await preflightProvider.getBalance(config.deployer);
  const { ethers } = await network.connect("bscTestnet");
  const chain = await ethers.provider.getNetwork();
  assertBscTestnetChainId(chain.chainId);
  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== config.deployer.toLowerCase()) throw new Error("Configured PRIVATE_KEY does not match the derived BSC Legion deployer.");

  const credential = await (await ethers.getContractFactory("LegionCredentialV2")).deploy(config.admin, config.minter);
  await credential.waitForDeployment();
  const deploymentTransaction = credential.deploymentTransaction();
  const deploymentReceipt = await deploymentTransaction?.wait();
  if (!deploymentTransaction || !deploymentReceipt || deploymentReceipt.status !== 1) throw new Error("LegionCredentialV2 deployment failed.");
  const address = await credential.getAddress();
  if (await ethers.provider.getCode(address) === "0x") throw new Error("LegionCredentialV2 deployment has no bytecode.");

  const pauserRole = await credential.PAUSER_ROLE();
  if (config.pauser.toLowerCase() !== config.admin.toLowerCase()) {
    const grantReceipt = await (await credential.grantRole(pauserRole, config.pauser)).wait();
    if (!grantReceipt || grantReceipt.status !== 1) throw new Error("Legion pauser role grant failed.");
    const revokeReceipt = await (await credential.revokeRole(pauserRole, config.admin)).wait();
    if (!revokeReceipt || revokeReceipt.status !== 1) throw new Error("Legion deployer-admin pauser role revocation failed.");
  }
  const block = await ethers.provider.getBlock(deploymentReceipt.blockNumber);
  if (!block) throw new Error("Legion deployment block is unavailable.");
  writeLegionBscManifestAtomically(config.manifestPath, {
    network: "bscTestnet", chainId: 97, environment: "testnet", deploymentStatus: "DEPLOYED", rpcUrl: config.rpcUrl,
    deploymentVersion: `legion-credential-v2-bsc-testnet-${block.hash}`, deploymentBlock: deploymentReceipt.blockNumber,
    contracts: { LegionCredentialV2: { address, deploymentTransactionHash: deploymentTransaction.hash, deploymentBlock: deploymentReceipt.blockNumber, constructorArgs: [config.admin, config.minter] } },
    roles: { defaultAdmin: config.admin, legionAdmin: config.admin, legionMinter: config.minter, pauser: config.pauser },
  });
  console.log(JSON.stringify({ chainId: 97, address, deploymentTransactionHash: deploymentTransaction.hash, deploymentBlock: deploymentReceipt.blockNumber, deployer: config.deployer, admin: config.admin, minter: config.minter, pauser: config.pauser, contractVersion: "LegionCredentialV2" }, null, 2));
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "BSC Legion deployment failed."); process.exitCode = 1; });
