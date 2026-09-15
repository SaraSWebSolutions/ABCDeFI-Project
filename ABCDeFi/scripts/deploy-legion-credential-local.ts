import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/**
 * Deploys only the canonical Phase 8 Legion credential to an isolated local
 * Hardhat chain.  It never mutates the root deployments.json, which remains
 * the independent Phase 1–7 deployment record.
 */
const MANIFEST_PATH = path.resolve(process.env.LEGION_CREDENTIAL_MANIFEST_PATH || "deployments.legion-v2-local.json");

function writeManifestAtomically(value: unknown) {
  const temporary = `${MANIFEST_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, MANIFEST_PATH);
}

async function main() {
  const { ethers } = await network.connect();
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 31337n) throw new Error(`LegionCredentialV2 local deployment permits only chain 31337; received ${chain.chainId}.`);
  if (fs.existsSync(MANIFEST_PATH)) {
    let previous: any;
    try { previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")); } catch { throw new Error(`Existing LegionCredentialV2 local manifest cannot be parsed: ${MANIFEST_PATH}.`); }
    if (previous?.chainId !== 31337 || previous?.network !== "localhost" || previous?.localOnly !== true) {
      throw new Error(`Refusing to replace a non-local LegionCredentialV2 manifest: ${MANIFEST_PATH}.`);
    }
    if (process.env.LEGION_CREDENTIAL_FRESH_LOCAL !== "1") {
      throw new Error(`Refusing to overwrite existing LegionCredentialV2 local manifest: ${MANIFEST_PATH}. Set LEGION_CREDENTIAL_FRESH_LOCAL=1 only after starting a fresh isolated local chain.`);
    }
  }

  const [deployer, minter] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("LegionCredentialV2");
  const credential = await factory.deploy(deployer.address, minter.address);
  await credential.waitForDeployment();
  const deploymentTransaction = credential.deploymentTransaction();
  const receipt = await deploymentTransaction?.wait();
  if (!deploymentTransaction || !receipt || receipt.status !== 1) throw new Error("LegionCredentialV2 deployment failed.");

  const address = await credential.getAddress();
  if (await ethers.provider.getCode(address) === "0x") throw new Error("LegionCredentialV2 has no deployed bytecode.");
  const deploymentBlock = receipt.blockNumber;
  const block = await ethers.provider.getBlock(deploymentBlock);
  if (!block) throw new Error("LegionCredentialV2 deployment block is unavailable.");

  const manifest = {
    chainId: 31337,
    network: "localhost",
    rpcUrl: "http://127.0.0.1:8545",
    deploymentVersion: `legion-credential-v2-local-${block.hash}`,
    deploymentBlock,
    localOnly: true,
    contracts: {
      LegionCredentialV2: {
        address,
        deploymentTransactionHash: deploymentTransaction.hash,
        deploymentBlock,
        constructorArgs: [deployer.address, minter.address],
      },
    },
    roles: {
      defaultAdmin: deployer.address,
      legionAdmin: deployer.address,
      legionMinter: minter.address,
      pauser: deployer.address,
    },
  };
  writeManifestAtomically(manifest);

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
