import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

type Deployment = { address: string; deploymentTransactionHash: string; deploymentBlock: number };
type Manifest = { network: string; chainId: string; rpcUrl: string; deployer: string; deploymentVersion?: string; contracts: Record<string, Deployment> };

const LOCAL_CHAIN_ID = 31337n;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function requireLocalManifest(manifestPath: string): Manifest {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  if (manifest.network !== "localhost" || manifest.chainId !== LOCAL_CHAIN_ID.toString() || manifest.rpcUrl !== "http://127.0.0.1:8545") {
    throw new Error("Refusing Franchise foundation deployment: manifest is not canonical localhost/31337.");
  }
  if (!ADDRESS.test(manifest.deployer)) throw new Error("Refusing Franchise foundation deployment: manifest deployer is invalid.");
  if (manifest.contracts.FranchiseNFT || manifest.contracts.FranchiseRegistry) {
    throw new Error("Refusing Franchise foundation deployment: manifest already contains a Franchise deployment.");
  }
  return manifest;
}

function initializeIsolatedManifest(manifestPath: string) {
  if (fs.existsSync(manifestPath)) return;
  const basePath = path.resolve(process.env.FRANCHISE_BASE_MANIFEST_PATH || "deployments.json");
  const base = JSON.parse(fs.readFileSync(basePath, "utf8")) as Manifest;
  const { FranchiseNFT: _legacyNft, FranchiseRegistry: _legacyRegistry, ...contracts } = base.contracts;
  fs.writeFileSync(manifestPath, `${JSON.stringify({ ...base, contracts }, null, 2)}\n`, "utf8");
}

function writeManifestAtomically(manifestPath: string, manifest: Manifest) {
  const temporary = `${manifestPath}.franchise-${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, manifestPath);
}

async function deployed(factoryName: string, args: readonly string[]) {
  const { ethers } = await network.connect();
  const factory = await ethers.getContractFactory(factoryName);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const transaction = contract.deploymentTransaction();
  const receipt = await transaction?.wait();
  if (!transaction || !receipt || receipt.status !== 1) throw new Error(`${factoryName} deployment was not confirmed.`);
  const address = await contract.getAddress();
  if (address === ethers.ZeroAddress || (await ethers.provider.getCode(address)) === "0x") throw new Error(`${factoryName} has no deployed bytecode.`);
  return { contract, deployment: { address, deploymentTransactionHash: transaction.hash, deploymentBlock: receipt.blockNumber } };
}

async function main() {
  const manifestPath = path.resolve(process.env.FRANCHISE_MANIFEST_PATH || "deployments.json");
  initializeIsolatedManifest(manifestPath);
  const manifest = requireLocalManifest(manifestPath);
  const { ethers } = await network.connect();
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== LOCAL_CHAIN_ID) throw new Error(`Refusing Franchise foundation deployment on chain ${chain.chainId}.`);
  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== manifest.deployer.toLowerCase()) throw new Error("Manifest deployer and local signer differ.");

  // A single local signer is permitted only for this isolated development deployment.
  const nft = await deployed("FranchiseNFT", [deployer.address]);
  const registry = await deployed("FranchiseRegistry", [
    nft.deployment.address, deployer.address, deployer.address, deployer.address,
    deployer.address, deployer.address, deployer.address,
  ]);
  const bind = await nft.contract.setRegistry(registry.deployment.address);
  const bindReceipt = await bind.wait();
  if (!bindReceipt || bindReceipt.status !== 1 || (await nft.contract.registry()).toLowerCase() !== registry.deployment.address.toLowerCase()) {
    throw new Error("FranchiseNFT Registry binding was not confirmed.");
  }

  writeManifestAtomically(manifestPath, {
    ...manifest,
    deploymentVersion: "franchise-foundation-local-v1",
    contracts: { ...manifest.contracts, FranchiseNFT: nft.deployment, FranchiseRegistry: registry.deployment },
  });
  console.log(JSON.stringify({ chainId: chain.chainId.toString(), franchiseNFT: nft.deployment, franchiseRegistry: registry.deployment, registryBindingTransaction: bind.hash, manifestPath }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
