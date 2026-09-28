import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { sealManifest } from "./deployment-manifest-guards.mjs";

/**
 * Deploys the hierarchical Phase 8 LegionNFTV2 to an isolated, disposable
 * localhost manifest. It never alters the Phase 1–7 deployment manifest or
 * the distinct LegionCredentialV2 manifest.
 */
const MANIFEST_PATH = path.resolve(process.env.LEGION_NFT_V2_MANIFEST_PATH || "deployments.legion-nft-v2-local.json");
const LOCAL_RPC_URL = process.env.ABCDEFI_LOCAL_RPC_URL || "http://127.0.0.1:8545";

function writeManifestAtomically(value: unknown) {
  const temporary = `${MANIFEST_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, MANIFEST_PATH);
}

async function main() {
  const { ethers } = await network.connect();
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 31337n) throw new Error(`LegionNFTV2 local deployment permits only chain 31337; received ${chain.chainId}.`);

  if (fs.existsSync(MANIFEST_PATH) && process.env.LEGION_NFT_V2_FRESH_LOCAL !== "1") {
    throw new Error(`Refusing to overwrite ${MANIFEST_PATH}. Set LEGION_NFT_V2_FRESH_LOCAL=1 only after starting a fresh local chain.`);
  }

  const [defaultAdmin, minter, pauser] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("LegionNFTV2");
  const legion = await factory.deploy(defaultAdmin.address, minter.address, pauser.address);
  await legion.waitForDeployment();
  const deploymentTransaction = legion.deploymentTransaction();
  const receipt = await deploymentTransaction?.wait();
  if (!deploymentTransaction || !receipt || receipt.status !== 1) throw new Error("LegionNFTV2 deployment failed.");

  const address = await legion.getAddress();
  if (await ethers.provider.getCode(address) === "0x") throw new Error("LegionNFTV2 has no deployed bytecode.");
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  if (!block) throw new Error("LegionNFTV2 deployment block is unavailable.");

  const manifest = sealManifest({
    chainId: 31337,
    network: "localhost",
    rpcUrl: LOCAL_RPC_URL,
    localOnly: true,
    deploymentVersion: `legion-nft-v2-local-${block.hash}`,
    deploymentBlock: receipt.blockNumber,
    contracts: {
      LegionNFTV2: {
        address,
        deploymentTransactionHash: deploymentTransaction.hash,
        deploymentBlock: receipt.blockNumber,
        constructorArgs: [defaultAdmin.address, minter.address, pauser.address],
        artifactIdentity: "contracts/nft/LegionNFTV2.sol:LegionNFTV2",
        runtimeBytecodeHash: ethers.keccak256(await ethers.provider.getCode(address)),
      },
    },
    roles: {
      defaultAdmin: defaultAdmin.address,
      legionAdmin: defaultAdmin.address,
      legionMinter: minter.address,
      pauser: pauser.address,
    },
  });
  writeManifestAtomically(manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
