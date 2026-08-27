import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

type DeploymentEntry = {
  address: string;
  deploymentTransactionHash: string;
  deploymentBlock: number;
};

type Manifest = {
  network: string;
  chainId: string;
  rpcUrl: string;
  deployer: string;
  contracts: Record<string, DeploymentEntry>;
};

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const LOCAL_CHAIN_ID = 31337n;

function readManifest(manifestPath: string): Manifest {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  if (parsed.network !== "localhost" || parsed.chainId !== LOCAL_CHAIN_ID.toString() || parsed.rpcUrl !== "http://127.0.0.1:8545") {
    throw new Error("Refusing FranchiseNFT migration: deployments.json is not the canonical localhost 31337 manifest.");
  }
  if (!ADDRESS.test(parsed.deployer)) throw new Error("Refusing FranchiseNFT migration: manifest deployer is invalid.");
  if (parsed.contracts.FranchiseNFT) throw new Error(`FranchiseNFT is already present in deployments.json at ${parsed.contracts.FranchiseNFT.address}.`);
  for (const [name, deployment] of Object.entries(parsed.contracts)) {
    if (!ADDRESS.test(deployment.address)) throw new Error(`Refusing FranchiseNFT migration: ${name} has an invalid manifest address.`);
  }
  return parsed;
}

function writeManifestAtomically(manifestPath: string, manifest: Manifest) {
  const temporaryPath = `${manifestPath}.franchise-${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, manifestPath);
}

async function main() {
  const manifestPath = path.resolve("deployments.json");
  const manifest = readManifest(manifestPath);
  const { ethers } = await network.connect();
  const provider = ethers.provider;
  const chain = await provider.getNetwork();
  if (chain.chainId !== LOCAL_CHAIN_ID) throw new Error(`Refusing FranchiseNFT migration on chain ${chain.chainId}; localhost 31337 only.`);

  for (const [name, deployment] of Object.entries(manifest.contracts)) {
    const code = await provider.getCode(deployment.address);
    if (code === "0x" || code === "0x0") throw new Error(`Refusing FranchiseNFT migration: ${name} has no bytecode at ${deployment.address}.`);
  }

  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== manifest.deployer.toLowerCase()) {
    throw new Error(`Refusing FranchiseNFT migration: signer ${deployer.address} does not match manifest deployer ${manifest.deployer}.`);
  }

  const factory = await ethers.getContractFactory("FranchiseNFT");
  const franchise = await factory.deploy(deployer.address, deployer.address);
  await franchise.waitForDeployment();
  const transaction = franchise.deploymentTransaction();
  const receipt = await transaction?.wait();
  if (!transaction || !receipt || receipt.status !== 1) throw new Error("FranchiseNFT deployment was not confirmed successfully.");

  const address = await franchise.getAddress();
  const code = await provider.getCode(address);
  if (address === ethers.ZeroAddress || code === "0x" || code === "0x0") throw new Error("FranchiseNFT deployment verification failed: address or bytecode is invalid.");
  const [name, symbol, defaultAdmin, minterRole, pauserRole, updaterRole] = await Promise.all([
    franchise.name(), franchise.symbol(), franchise.DEFAULT_ADMIN_ROLE(), franchise.MINTER_ROLE(), franchise.PAUSER_ROLE(), franchise.UPDATER_ROLE(),
  ]);
  if (name !== "ABCDeFi Legion Franchise NFT" || symbol !== "ABCD-FRANCHISE") throw new Error("FranchiseNFT deployment verification failed: ERC-721 identity mismatch.");
  for (const [roleName, role] of [["DEFAULT_ADMIN_ROLE", defaultAdmin], ["MINTER_ROLE", minterRole], ["PAUSER_ROLE", pauserRole], ["UPDATER_ROLE", updaterRole]] as const) {
    if (!await franchise.hasRole(role, deployer.address)) throw new Error(`FranchiseNFT deployment verification failed: deployer lacks ${roleName}.`);
  }

  const nextManifest: Manifest = {
    ...manifest,
    contracts: {
      ...manifest.contracts,
      FranchiseNFT: {
        address,
        deploymentTransactionHash: transaction.hash,
        deploymentBlock: receipt.blockNumber,
      },
    },
  };
  writeManifestAtomically(manifestPath, nextManifest);

  console.log("FranchiseNFT local migration complete");
  console.log(`CHAIN: ${chain.chainId}`);
  console.log(`FRANCHISE_NFT: ${address}`);
  console.log(`DEPLOYMENT_BLOCK: ${receipt.blockNumber}`);
  console.log(`DEPLOYMENT_TX: ${transaction.hash}`);
  console.log("ROLES: DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE, UPDATER_ROLE verified for manifest deployer");
  console.log("MANIFEST: updated");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
